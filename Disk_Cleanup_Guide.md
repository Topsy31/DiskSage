# Disk Cleanup Guide — Summary of Steps

**Prepared for:** Mark  
**Date:** February 2026  
**Starting state:** C: drive full (219 GB, ~0% free)  
**Final state:** 69.3 GB free (31.6%)

---

## Phase 1: Identify Duplicate Files

We built a Python script (`find_duplicates.py`) that uses a three-pass approach to find true duplicates efficiently:

1. **Pass 1 — Group by file size.** Files with a unique size are eliminated instantly with no I/O beyond `stat`.
2. **Pass 2 — Partial hash (first 8 KB).** Quickly filters out same-size files that differ early on.
3. **Pass 3 — Full SHA-256 hash.** Confirms true duplicates with certainty.

The script runs in dry-run mode by default (reports only, moves nothing). When confirmed, it moves duplicates to `L:\DuplicatesStaging`, preserving the original folder structure for traceability. A timestamped CSV report logs every decision.

**Usage:**

```powershell
python L:\find_duplicates.py                          # Dry run
python L:\find_duplicates.py --move                   # Move duplicates
python L:\find_duplicates.py --move --min-size 1048576  # Skip files under 1 MB
```

**Key findings from the C: drive scan:**

- 209,527 duplicate groups found across 851,911 files scanned.
- ~5.5 GB reclaimable from genuine duplicates.
- Norton sandbox accounted for 91% of duplicate files by count, but negligible size (312 bytes total). It was excluded from subsequent scans.
- The biggest space wasters were WebView2/Widevine DRM DLLs (109 copies of the same 18.9 MB file across apps like Edge, Teams, WhatsApp, Zoom, Power BI), Electron app caches, and Node.js/npm package duplication.

The script was also adapted for the E: drive by changing `SOURCE_ROOT` and the `relpath` reference.

---

## Phase 2: Manual Cleanup Targets

Several items were identified through TreeSize/WizTree analysis:

- **Raspberry Pi Imager cache** (`C:\Users\markc\AppData\Local\Raspberry Pi\Imager\cache\lastdownload.cache`) — 872 MB. A cached OS image that can be safely deleted; the Imager re-downloads when needed.
- **Claude Code old versions** (`C:\Users\markc\.local\share\claude\versions\`) — 219 MB. Delete version folders other than the one currently in use.
- **SQL Server 2019 installer leftovers** (`C:\SQL2019\Developer_ENU\`) — 177 MB. Safe to delete if SQL Server is already installed.
- **WebEx old cached versions** (`C:\Users\markc\AppData\Local\WebEx\wbxcache\webexdelta\`) — 278 MB. Delete version folders other than the current one.
- **SRM / Safran duplicate zip** — 81 MB duplicate download.

---

## Phase 3: Windows Built-in Cleanup

### Disk Cleanup utility

```powershell
cleanmgr /sageset:1    # Opens dialog — tick everything, especially Windows Update Cleanup
cleanmgr /sagerun:1    # Runs the cleanup
```

Typically reclaims 5–30 GB depending on accumulated Windows updates.

### DISM Component Store cleanup

Windows keeps old versions of every system component for rollback. This grows substantially over time.

```powershell
# Conservative (preserves rollback ability):
Dism /Online /Cleanup-Image /StartComponentCleanup

# Aggressive (removes rollback ability for old updates, reclaims more space):
Dism /Online /Cleanup-Image /StartComponentCleanup /ResetBase
```

Takes 10–15 minutes. Can free several GB.

### Temp files

```powershell
Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
```

---

## Phase 4: Developer Cache Cleanup

### npm cache

```powershell
npm cache verify          # Check size
npm cache clean --force   # Clear it
```

Also consider deleting `node_modules` folders in projects you're not actively working on. They rebuild in seconds with `npm install`.

### pip cache

```powershell
pip cache purge
```

### NuGet cache

```powershell
dotnet nuget locals all --clear
```

### Azure CLI cache

```powershell
Remove-Item "$env:USERPROFILE\.azure\cliextensions" -Recurse -Force -ErrorAction SilentlyContinue
```

---

## Phase 5: Optional — Hibernation File

The hibernation file (`hiberfil.sys`) equals your RAM size. If you have 16 GB RAM, that's 16 GB consumed. Sleep mode still works without it.

```powershell
powercfg /hibernation off     # Deletes hiberfil.sys immediately
powercfg /hibernation on      # Restores it if ever needed
```

---

## Ongoing Maintenance

The main sources of disk bloat that will recur over time:

- **Windows Update accumulation** — run Disk Cleanup and DISM every few months.
- **npm/pip/NuGet caches** — clear periodically during active development.
- **WebView2/Widevine DLLs** — reappear after app updates; not worth fighting.
- **App caches** (Electron, WebEx, Teams) — old versions accumulate silently.

Running TreeSize Free or WizTree periodically gives a quick visual map of where space is being consumed, making it easy to spot new offenders before the drive fills up again.
