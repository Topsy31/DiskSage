# DiskSage Development History

This document tracks the evolution of DiskSage from its original specification to its current state. It serves as a record of decisions made, features added, and scope changes during development.

---

## Original Specification (plan.md)

The original plan specified a **recommendations-only** tool:
- Line 37: "Action scope: Never delete files — recommendations only"
- Core principle: User reviews recommendations in DiskSage, then acts in File Explorer
- Safety-first approach with conservative language and dual-axis classification (Risk + Confidence)

---

## Development Timeline

### Session 1: Foundation (Initial Build)

**Implemented as specified:**
- Electron + React + TypeScript + Vite + Tailwind CSS setup
- WizTree CSV parser
- Offline rule engine with ~30 patterns
- Dual-axis classification (Risk 1-5 + Confidence High/Medium/Low)
- Safety intro screen with checkboxes
- Audit logging to `%APPDATA%\DiskSage\audit.log`
- Claude AI integration for unknown items
- Web research with curated sources
- "Open in Explorer" functionality
- Report Problem modal

### Session 2: UI Improvements

**Implemented as specified:**
- Tree view for hierarchical exploration
- Detail panel for expanded information
- Drive summary display
- Sorting and filtering

### Session 3: Scope Expansion - Test Removal Feature

**SCOPE CHANGE:** Added deletion capability (not in original spec)

User requested ability to actually remove files, not just recommend. Implemented "Test Removal" feature:

- **In-situ rename approach:** Files renamed with `.disksage-backup` suffix
- **Manifest-first safety:** State written BEFORE any renames for crash recovery
- **Instant undo:** Restore items by renaming back
- **Confirm & Delete:** Permanent deletion only after user confirms test was successful

**Rationale:** Original "recommendations only" approach created friction — users had to manually navigate to each folder in Explorer. Test Removal provides safety through reversibility rather than inaction.

**Files added/modified:**
- `electron/services/removalService.ts` - Core rename/restore/delete logic
- `electron/services/removalState.ts` - Manifest persistence
- `electron/services/removalLogger.ts` - Operation logging
- `src/types.ts` - RemovalTestJob, RemovalTestItem types

### Session 4: Tab-Based UI Refactor

**Problems being solved:**
1. No way to cancel/back from import screen
2. Unclear which files were marked for deletion
3. UI cluttered with multiple concerns competing for space
4. Quick Wins only showed low-risk items

**Implemented:**

New three-tab structure:
1. **Explore** - Full tree view with slide-in detail panel
2. **By Risk** - Sub-filtered view (Low/Moderate/High/Unknown) with checkboxes
3. **Marked for Deletion** - Items selected for removal with Test/Undo/Confirm actions

**Files added:**
- `src/components/TabContainer.tsx`
- `src/components/ExploreTab.tsx`
- `src/components/ByRiskTab.tsx`
- `src/components/MarkedTab.tsx`

**Files removed:**
- `src/components/QuickWins.tsx` (replaced by ByRiskTab)

### Session 5: Quick Scan Feature

**Added:** Direct scanning of common locations without WizTree

User requested simpler workflow for common cleanup tasks. Added Quick Scan:

- Pre-defined scan targets (Windows Temp, User Temp, Browser Caches, npm cache, etc.)
- Checkbox selection of locations to scan
- Progress reporting during scan
- Can still import WizTree CSV for full drive analysis

**Files added:**
- `electron/services/scanner.ts` - Scan targets and recursive scanning

**Files modified:**
- `src/components/StartScreen.tsx` - Replaced SafetyIntro + ImportPanel
- `electron/main.ts` - IPC handlers for scan
- `electron/preload.ts` - API bridge

### Session 6: Session Persistence & Flow Fixes

**Implemented:**
- Session saved to `%APPDATA%\DiskSage\session.json`
- Continue Previous Session banner on StartScreen
- Active Test warning if test in progress
- Marked paths persisted across restarts
- Fixed StartScreen flow to always show first (user must click Continue)
- Fixed MarkedTab to display items from active test with status badges

### Session 7: Backup Location Feature

**SCOPE CHANGE:** Added configurable backup location (user request)

User requested ability to back up files to a specified location before Test Removal. This provides an additional safety layer beyond in-situ rename.

**Requirements gathered via plan mode:**
- **When:** Backup happens at Test Removal stage (before rename)
- **Persistence:** Remember backup location across sessions
- **Space handling:** Block and warn if insufficient space
- **Retention:** Forever (manual cleanup by user)

**New workflow:**
1. Mark items → Select/confirm backup location
2. Test Removal (copy to backup location, then rename in-place)
3. Verify system works
4. Confirm & Delete (deletes renamed files, backups remain)

**Files added:**
- `electron/services/settingsService.ts` - Persist backup location to `%APPDATA%\DiskSage\settings.json`
- `electron/services/backupService.ts` - Disk space validation, recursive file copying
- `src/components/BackupLocationPanel.tsx` - UI for backup location selection with validation

**Files modified:**
- `electron/main.ts` - Added 5 IPC handlers for backup operations
- `electron/preload.ts` - Exposed backup APIs to renderer
- `src/types.ts` - Added BackupValidation interface, backupPath/backupLocation fields
- `src/electron.d.ts` - Type declarations for new APIs
- `src/components/MarkedTab.tsx` - Integrated BackupLocationPanel, validation gating
- `src/App.tsx` - Added backupLocation state management
- `electron/services/removalService.ts` - Integrated backup step before rename

**Features:**
- Backup folder picker with persistent storage
- Available space vs required space validation
- Same-drive warning (yellow) when backup on same drive as source
- Insufficient space blocking (red) prevents Test Removal
- Backup structure: `{backupLocation}/DiskSage-{jobId}/{original-structure}`
- Backups preserved after Confirm & Delete

---

## Current State vs Original Spec

| Feature | Original Spec | Current State |
|---------|---------------|---------------|
| Action scope | Recommendations only | Test Removal + Delete |
| Input method | WizTree CSV only | Quick Scan + CSV |
| UI structure | Single scrolling list | Three-tab layout |
| Session persistence | Not specified | Implemented |
| Backup approach | Not specified (user responsibility) | Configurable backup location + in-situ rename |

---

## Lessons Learned

1. **"Recommendations only" created friction** - Users wanted to act, not just observe
2. **Test Removal is the safety mechanism** - Reversibility replaces inaction
3. **Quick Scan reduces barrier to entry** - Not everyone has WizTree installed
4. **Tab UI clarifies workflow** - Explore → Select → Review → Act
5. **Layered safety builds confidence** - Backup + rename + undo provides multiple recovery paths

### Session 8: Path Deduplication and Flat List By Risk Tab

**Problem identified:** User discovered that marking both a parent folder and a nested child showed misleading totals (e.g., 2.4GB when actual savings would be 1.2GB since deleting the parent already deletes the child).

**Initial attempt:** Hierarchical tree view in By Risk tab — but this created a new problem: selecting a low-risk parent folder could accidentally delete high-risk children nested inside it.

**User feedback:** "This file structure approach is not working. I think we need to only show the files at the risk level and not the folders to avoid the accidental deletion of high risk values."

**Final solution:**

1. **Flat list in By Risk tab** — Shows only individual classified items at that risk level, no parent folders, no tree structure
2. **Path deduplication utilities** — New functions to handle cases where user manually marks overlapping paths
3. **Visual indicators for nested items in MarkedTab** — Shows "Nested" badge when items overlap

**Why flat list is safer:**
- You can only select items that have actually been classified at that risk level
- No risk of accidentally selecting a parent that contains differently-classified children
- Clear, unambiguous selection — what you see is exactly what you'll delete

**Files modified:**

- `src/utils/treeBuilder.ts` — Added deduplication functions:
  - `deduplicatePaths()` — Returns root-level paths only
  - `calculateDeduplicatedSize()` — Calculates total size excluding nested paths

- `src/components/ByRiskTab.tsx` — Flat list view:
  - Simple list of classified items sorted by size
  - Each item shows path, size, and risk badge
  - Detail panel slides in when clicking an item
  - No tree hierarchy, no expand/collapse

- `src/components/MarkedTab.tsx` — Deduplication display:
  - Shows "Nested" badge for items covered by a parent
  - Accurate totals excluding nested items
  - Only root-level items passed to Test Removal

- `src/components/TreeView.tsx` — Added expand/collapse all button for Explore tab

---

## Pending Decisions

1. **plan.md updates:** Should plan.md be updated to reflect current scope, or preserved as original specification with HISTORY.md tracking changes?

---

## Version History

| Date | Version | Key Changes |
|------|---------|-------------|
| 2026-01-XX | 0.1.0 | Initial MVP with recommendations only |
| 2026-01-XX | 0.2.0 | Test Removal feature added |
| 2026-01-XX | 0.3.0 | Tab-based UI refactor |
| 2026-01-XX | 0.4.0 | Quick Scan + Session persistence |
| 2026-02-01 | 0.5.0 | Configurable backup location |
| 2026-02-01 | 0.6.0 | Hierarchical By Risk tab, path deduplication |
