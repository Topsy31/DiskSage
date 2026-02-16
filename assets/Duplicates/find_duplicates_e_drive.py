"""
Duplicate File Finder & Mover
Scans a source drive for duplicate files, keeps one copy in place,
and moves the rest to a staging folder on another drive for later deletion.

Usage:
    python find_duplicates.py                  # Dry run (report only)
    python find_duplicates.py --move           # Actually move duplicates
    python find_duplicates.py --min-size 1048576  # Only check files >= 1MB
"""

import os
import hashlib
import shutil
import argparse
import csv
import logging
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# ── Configuration ────────────────────────────────────────────────────────────
SOURCE_ROOT = r"E:\\"
DEST_ROOT = r"L:\find_duplicates\DuplicatesStaging"
LOG_FILE = r"L:\find_duplicates\duplicate_scan.log"
REPORT_CSV = r"L:\find_duplicates\duplicate_report.csv"

# Folders to skip (lowercase) — add more as needed
SKIP_DIRS = {
    "windows", "$recycle.bin", "system volume information",
    "$windows.~bt", "$windows.~ws", "recovery",
    "program files", "program files (x86)", "programdata",
    "norton sandbox",
}

# ── Helpers ──────────────────────────────────────────────────────────────────
def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s  %(message)s",
        handlers=[
            logging.FileHandler(LOG_FILE, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )

def partial_hash(path: str, chunk_size: int = 8192) -> str:
    """Fast hash using only the first 8 KB — used as a pre-filter."""
    h = hashlib.md5(usedforsecurity=False)
    try:
        with open(path, "rb") as f:
            h.update(f.read(chunk_size))
    except (OSError, PermissionError):
        return ""
    return h.hexdigest()

def full_hash(path: str, chunk_size: int = 65536) -> str:
    """SHA-256 hash of the entire file."""
    h = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            while chunk := f.read(chunk_size):
                h.update(chunk)
    except (OSError, PermissionError):
        return ""
    return h.hexdigest()

def should_skip(dirpath: str) -> bool:
    parts = Path(dirpath).parts
    return any(p.lower() in SKIP_DIRS for p in parts)

# ── Main logic ───────────────────────────────────────────────────────────────
def scan_files(source_root: str, min_size: int = 1) -> dict[int, list[str]]:
    """Pass 1: group every file by size."""
    size_map = defaultdict(list)
    file_count = 0
    for dirpath, dirnames, filenames in os.walk(source_root):
        if should_skip(dirpath):
            dirnames.clear()  # don't descend
            continue
        for fname in filenames:
            fpath = os.path.join(dirpath, fname)
            try:
                st = os.stat(fpath)
                if st.st_size >= min_size:
                    size_map[st.st_size].append(fpath)
                    file_count += 1
                    if file_count % 10_000 == 0:
                        logging.info(f"  scanned {file_count:,} files...")
            except (OSError, PermissionError):
                continue
    logging.info(f"Pass 1 complete: {file_count:,} files scanned")
    return size_map

def find_duplicates(size_map: dict[int, list[str]]) -> list[list[str]]:
    """Pass 2 & 3: partial-hash then full-hash to confirm true duplicates."""
    duplicate_groups = []
    candidates = {sz: paths for sz, paths in size_map.items() if len(paths) > 1}
    logging.info(f"Pass 2: {sum(len(p) for p in candidates.values()):,} files share a size with at least one other")

    for size, paths in candidates.items():
        # Pass 2: partial hash
        partial_map = defaultdict(list)
        for p in paths:
            ph = partial_hash(p)
            if ph:
                partial_map[ph].append(p)

        # Pass 3: full hash only where partial hashes collide
        for ph, plist in partial_map.items():
            if len(plist) < 2:
                continue
            full_map = defaultdict(list)
            for p in plist:
                fh = full_hash(p)
                if fh:
                    full_map[fh].append(p)
            for fh, flist in full_map.items():
                if len(flist) >= 2:
                    duplicate_groups.append(flist)

    logging.info(f"Pass 3 complete: {len(duplicate_groups):,} duplicate groups found")
    return duplicate_groups

def pick_keeper(group: list[str]) -> tuple[str, list[str]]:
    """
    Choose which file to KEEP. Heuristic: prefer the shortest path
    (likely the most 'canonical' location). The rest are movers.
    """
    group_sorted = sorted(group, key=lambda p: (len(p), p))
    return group_sorted[0], group_sorted[1:]

def move_duplicates(duplicate_groups: list[list[str]], dest_root: str, dry_run: bool):
    """Move (or report) duplicate files to the staging folder."""
    os.makedirs(dest_root, exist_ok=True)
    moved = 0
    freed_bytes = 0

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = REPORT_CSV.replace(".csv", f"_{timestamp}.csv")

    with open(report_path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["group", "action", "original_path", "destination", "size_bytes"])

        for gid, group in enumerate(duplicate_groups, 1):
            keeper, movers = pick_keeper(group)
            try:
                file_size = os.path.getsize(keeper)
            except (OSError, PermissionError):
                logging.debug(f"  Skipping group {gid}: cannot access {keeper}")
                continue

            writer.writerow([gid, "KEEP", keeper, "", file_size])

            for src in movers:
                # Mirror the folder structure under the staging root
                rel = os.path.relpath(src, "C:\\")
                dst = os.path.join(dest_root, rel)

                if dry_run:
                    writer.writerow([gid, "WOULD_MOVE", src, dst, file_size])
                    logging.debug(f"  [DRY RUN] {src}  →  {dst}")
                else:
                    try:
                        os.makedirs(os.path.dirname(dst), exist_ok=True)
                        shutil.move(src, dst)
                        writer.writerow([gid, "MOVED", src, dst, file_size])
                        moved += 1
                        freed_bytes += file_size
                    except (OSError, PermissionError) as e:
                        writer.writerow([gid, "ERROR", src, str(e), file_size])
                        logging.warning(f"  Could not move {src}: {e}")

    logging.info(f"{'[DRY RUN] ' if dry_run else ''}Report saved to {report_path}")
    if not dry_run:
        logging.info(f"Moved {moved:,} files — freed ~{freed_bytes / (1024**2):,.1f} MB on C:")
    return report_path

# ── Entry point ──────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Find and move duplicate files.")
    parser.add_argument("--move", action="store_true", help="Actually move files (default is dry-run)")
    parser.add_argument("--min-size", type=int, default=1, help="Minimum file size in bytes (default: 1)")
    parser.add_argument("--source", default=SOURCE_ROOT, help=f"Root folder to scan (default: {SOURCE_ROOT})")
    parser.add_argument("--dest", default=DEST_ROOT, help=f"Staging folder for duplicates (default: {DEST_ROOT})")
    args = parser.parse_args()

    setup_logging()
    dry_run = not args.move

    logging.info("=" * 60)
    logging.info(f"Duplicate File Scanner — {'DRY RUN' if dry_run else 'LIVE MODE'}")
    logging.info(f"Source: {args.source}  |  Dest: {args.dest}  |  Min size: {args.min_size:,} bytes")
    logging.info("=" * 60)

    size_map = scan_files(args.source, min_size=args.min_size)
    duplicate_groups = find_duplicates(size_map)

    if not duplicate_groups:
        logging.info("No duplicates found!")
        return

    total_waste = 0
    for g in duplicate_groups:
        try:
            total_waste += os.path.getsize(g[0]) * (len(g) - 1)
        except (OSError, PermissionError):
            continue
    logging.info(f"Potential space savings: ~{total_waste / (1024**3):,.2f} GB")

    report = move_duplicates(duplicate_groups, args.dest, dry_run=dry_run)
    logging.info(f"Done. Review the CSV report: {report}")

if __name__ == "__main__":
    main()