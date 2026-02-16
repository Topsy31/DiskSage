# DiskSage — Implementation Plan

Smart disk cleanup advisor that helps users identify space savings with appropriate caution.

---

## Current Scope (Updated)

> **Note:** This section reflects the actual implemented state. See `HISTORY.md` for development timeline and rationale for changes from original specification.

### Implemented Features (Beyond Original Spec)

| Feature | Original Spec | Current Implementation |
|---------|---------------|------------------------|
| **Action scope** | Recommendations only | Test Removal + Permanent Delete |
| **Input method** | WizTree CSV only | Quick Scan + WizTree CSV |
| **UI structure** | Single scrolling list | Three-tab layout (Explore, By Risk, Marked) |
| **Session persistence** | Not specified | Full session restore |
| **Backup mechanism** | User responsibility | Configurable backup location + in-situ rename |

### Test Removal Feature

Instead of "recommendations only", DiskSage now provides safe deletion through reversibility:

1. **Mark items** — User selects items for deletion across Explore/By Risk tabs
2. **Select backup location** — User chooses where to preserve files (persisted across sessions)
3. **Test Removal** — Files copied to backup, then renamed with `.disksage-backup` suffix
4. **Verify** — User tests system functionality with items disabled
5. **Undo or Confirm** — Restore items if problems occur, or permanently delete (backups remain)

**Safety guarantees:**
- Configurable backup location with space validation
- Manifest written BEFORE any renames (crash recovery)
- Instant undo capability at any time during test
- Nothing permanently deleted without explicit confirmation
- Backups preserved indefinitely for manual recovery

### Quick Scan Feature

Direct scanning of common cleanup locations:
- Windows Temp, User Temp
- Browser caches (Chrome, Firefox, Edge)
- Development caches (node_modules, npm, NuGet, pip)
- Downloads folder

---

## Original Specification

> **The sections below represent the original design intent. Some aspects have been superseded by the "Current Scope" section above.**

---

## Safety Philosophy

**Core principle:** This app could cause real harm. A wrong recommendation leading to data loss is not an acceptable outcome. Every design decision must prioritise user safety over convenience.

**Key commitments:**
1. Never use language that implies certainty ("Safe to delete" → "Typically safe")
2. Always communicate uncertainty honestly
3. Actively slow down panicked users rather than enable rapid decisions
4. Take full moral responsibility for recommendations — "we just gave advice" is not a defence

---

## ICE Framework Summary

### Intent

| Aspect | Answer |
|--------|--------|
| **Core problem** | WizTree shows data but no guidance; cleanup tools feel scary; users don't understand their file system |
| **Value proposition** | Convenience + personalised analysis + trust |
| **User state** | Panic + anxiety (disk full, scared of breaking things) |
| **Job to be done** | Free up space + avoid disaster |
| **Definition of done** | Proves the concept — core flow works, usable to clean my drive |
| **One thing to do well** | Identify likely-safe wins with honest uncertainty |

### Constraints

| Aspect | Answer |
|--------|--------|
| **Safety model** | Conservative — err heavily toward "keep" when uncertain |
| **Action scope** | Never delete files — recommendations only |
| **Jargon level** | Explain everything — assume user doesn't know what AppData is |
| **Accuracy strategy** | Multiple safety layers + honest confidence levels |
| **Validation** | Diverse test samples + negative test cases |
| **Failure modes** | Wrong recommendation → data loss; False confidence → user harm |
| **Tech stack** | Electron + React |
| **Timeframe** | Weekend project |
| **Privacy** | Anonymise paths before sending to AI |

### Expectations

| Aspect | Answer |
|--------|--------|
| **First experience** | Safety-first intro: backup reminder, confidence explanation |
| **Explanation depth** | Progressive — summary first, details on expand |
| **AI scope** | On-demand only, always with uncertainty language |
| **Web research** | On-demand, curated sources only |
| **UI polish** | Clean and readable |
| **Defer to v2** | Export/report, multiple AI providers, settings UI |

---

## Safety Model (HIGH PRIORITY)

### Triple-Source Verification

DiskSage uses three sources of truth, each with different trust levels:

| Source | Trust Level | Max Confidence | When Used |
|--------|-------------|----------------|-----------|
| **Offline Rules** | Highest | High | Known patterns, well-documented folders |
| **Web Research** | Medium | High (if consensus) | On-demand, curated sources |
| **AI Inference** | Lowest | Medium (capped) | On-demand, unknown items |

When sources agree, confidence increases. When they disagree, flag prominently.

### Dual-Axis Classification

Every item receives TWO scores:

| Axis | Meaning | Display |
|------|---------|---------|
| **Risk** | Potential harm if deleted wrongly | 1-5 scale with colour |
| **Confidence** | How certain we are in classification | High / Medium / Low |

**Decision matrix:**

| Confidence | Risk 1-2 | Risk 3 | Risk 4-5 |
|------------|----------|--------|----------|
| **High** | Show as "Typically safe" | Show as "Review first" | Show as "Do not delete" |
| **Medium** | Show as "Probably safe" | Show as "Needs investigation" | Show as "Do not delete" |
| **Low** | Show as "Unknown — investigate" | Show as "Unknown — investigate" | Show as "Unknown — do not delete" |

**Critical rule:** Low confidence ALWAYS downgrades the recommendation, regardless of risk score.

### Language Standards

| Never Say | Instead Say |
|-----------|-------------|
| Safe to delete | Typically safe to delete |
| Definitely | Likely / Probably |
| You can delete this | This is typically safe, but verify first |
| Risk: Very Low | Risk: Low (Confidence: High) |

### Mandatory Disclaimers

Every session shows:
> DiskSage provides guidance based on common patterns, not guarantees. Before deleting anything:
> 1. Ensure you have a recent backup
> 2. Verify the recommendation makes sense for your situation
> 3. When in doubt, don't delete

---

## MVP Scope (v1)

### Must Have (Safety-Critical)

1. **Dual-axis scoring** — Risk + Confidence for every item
2. **Conservative language** — No "safe" without "typically"
3. **Backup reminder** — Shown before any recommendations
4. **Unknown = Don't touch** — Low confidence defaults to "investigate"
5. **Review summary screen** — Before user acts, show what they're considering
6. **Audit log** — Record all recommendations made (local file)
7. **Report problem button** — Flag incorrect recommendations

### Must Have (Functional)

8. **WizTree CSV import** — drag-drop or file picker
9. **Offline rule engine** — ~30 patterns with confidence levels
10. **Recommendation list** — sorted by size, filterable by confidence
11. **Risk + Confidence badges** — dual indicators per item
12. **One-line recommendation** — with appropriate uncertainty
13. **Expandable detail panel** — plain-English explanation
14. **"Ask AI" button** — for unknown items, with uncertainty
15. **"Research Online" button** — curated web search for validation
16. **Open in Explorer** — button to navigate to folder

### Won't Have (v1)

- Multiple AI providers (Claude only)
- Export/report functionality
- Settings panel
- Direct disk scan (WizTree import only)
- Persistent history across sessions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                      │
├─────────────────────────────────────────────────────────────┤
│  React Frontend                                              │
│  ├── Safety intro screen                                    │
│  ├── Import panel (drag-drop CSV)                           │
│  ├── Drive summary bar                                       │
│  ├── Recommendation list (sortable, filterable)             │
│  ├── Detail panel (expandable explanations)                 │
│  ├── Web research results panel                              │
│  ├── Review summary screen                                   │
│  └── Report problem modal                                    │
├─────────────────────────────────────────────────────────────┤
│  Analysis Engine (Electron main process)                    │
│  ├── WizTree CSV parser                                     │
│  ├── Path validator (junctions, symlinks, OneDrive)         │
│  ├── Offline rule engine (with confidence)                  │
│  ├── Web research engine (curated sources)                  │
│  ├── Audit logger                                            │
│  ├── Path anonymiser                                        │
│  └── Claude API adapter (with uncertainty prompting)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Risk Score Scale

| Score | Label | Colour | Meaning |
|-------|-------|--------|---------|
| 1 | Low | Green | Typically safe — temp files, caches |
| 2 | Low-Medium | Light green | Usually safe — rebuilable packages |
| 3 | Medium | Yellow | Could cause issues — review first |
| 4 | High | Orange | Likely important — backup required |
| 5 | Critical | Red | System files — do not delete |

## Confidence Scale

| Level | Meaning | When Applied |
|-------|---------|--------------|
| **High** | Pattern matches exactly, well-understood folder, or web consensus | Known Windows paths, standard caches, multiple sources agree |
| **Medium** | Pattern matches but edge cases possible, or single source | User folders, app data, AI inference |
| **Low** | Uncertain classification | Unknown apps, ambiguous paths, sources disagree |

---

## Recommendation Language

| Risk + Confidence | Display Text |
|-------------------|--------------|
| Risk 1, High | "Typically safe — temporary files that rebuild automatically" |
| Risk 1, Medium | "Probably safe — but verify these aren't files you created" |
| Risk 1, Low | "Unknown — investigate before taking action" |
| Risk 2, High | "Usually safe — can be recreated if needed" |
| Risk 2, Medium | "Probably safe — review contents first" |
| Risk 2, Low | "Unknown — investigate before taking action" |
| Risk 3, any | "Review required — could contain important data" |
| Risk 4, any | "Backup first — likely contains personal files" |
| Risk 5, any | "Do not delete — system or application files" |

---

## Web Research Integration (HIGH PRIORITY)

### Design Principles

1. **On-demand only** — User explicitly clicks "Research Online" button
2. **Curated sources** — Only query trusted sites, not general web
3. **Surface findings, don't decide** — Show what was found, let user interpret
4. **Highlight disagreement** — If sources conflict, flag prominently
5. **Cache results** — Same folder pattern doesn't need repeat searches
6. **Surface edge cases** — Actively look for "but be careful if..." warnings

### Trusted Source Whitelist

| Domain | Type | Trust Level | Why Trusted |
|--------|------|-------------|-------------|
| `docs.microsoft.com` | Official | Highest | Microsoft's own documentation |
| `learn.microsoft.com` | Official | Highest | Microsoft Learn platform |
| `support.microsoft.com` | Official | Highest | Microsoft support articles |
| `answers.microsoft.com` | Official | High | Microsoft community (moderated) |
| `superuser.com` | Community | High | Stack Exchange, moderated, voted |
| `serverfault.com` | Community | High | Stack Exchange for IT pros |
| `bleepingcomputer.com` | Expert | High | Established, security-focused |
| `howtogeek.com` | Expert | Medium | Established, consumer-focused |
| `tenforums.com` | Community | Medium | Windows-specific, active moderation |

### Search Strategy

For a folder like `C:\Windows\Installer`:

```
Query: "Windows Installer folder" safe to delete site:docs.microsoft.com OR site:superuser.com OR site:bleepingcomputer.com
```

**Parse results for:**
- Explicit "safe to delete" / "do not delete" statements
- Mentions of consequences
- Recommended tools or procedures
- Edge cases and warnings (actively seek these)

### Edge Case Detection

Research specifically looks for phrases like:
- "but be careful if..."
- "exception when..."
- "do not delete if..."
- "may cause issues with..."
- "only safe if..."
- "make sure first..."

**These get highlighted as warnings even if overall consensus is "safe."**

### Implementation

```typescript
interface WebResearchResult {
  query: string;
  sources: SourceResult[];
  consensus: 'safe' | 'dangerous' | 'conditional' | 'conflicting' | 'insufficient';
  edgeCases: string[];  // Warnings found in sources
  confidenceAdjustment: -1 | 0 | 1;
  summary: string;
  cachedAt: string;
}

interface SourceResult {
  domain: string;
  title: string;
  url: string;
  snippet: string;
  trustLevel: 'official' | 'expert' | 'community';
  sentiment: 'safe' | 'dangerous' | 'conditional' | 'neutral';
  votes?: number;  // For Stack Exchange
  warnings?: string[];  // Edge cases mentioned
}

const TRUSTED_DOMAINS = [
  { domain: 'docs.microsoft.com', trustLevel: 'official', weight: 3 },
  { domain: 'learn.microsoft.com', trustLevel: 'official', weight: 3 },
  { domain: 'support.microsoft.com', trustLevel: 'official', weight: 3 },
  { domain: 'answers.microsoft.com', trustLevel: 'official', weight: 2 },
  { domain: 'superuser.com', trustLevel: 'community', weight: 2 },
  { domain: 'serverfault.com', trustLevel: 'community', weight: 2 },
  { domain: 'bleepingcomputer.com', trustLevel: 'expert', weight: 2 },
  { domain: 'howtogeek.com', trustLevel: 'expert', weight: 1 },
  { domain: 'tenforums.com', trustLevel: 'community', weight: 1 },
];
```

### Consensus Calculation

```typescript
function calculateConsensus(sources: SourceResult[]): ConsensusResult {
  // Weight by trust level
  let safeWeight = 0;
  let dangerWeight = 0;

  for (const source of sources) {
    const weight = TRUSTED_DOMAINS.find(d => source.domain.includes(d.domain))?.weight || 1;
    if (source.sentiment === 'safe') safeWeight += weight;
    if (source.sentiment === 'dangerous') dangerWeight += weight;
  }

  // Check for edge cases in any source
  const hasEdgeCases = sources.some(s => s.warnings && s.warnings.length > 0);

  if (sources.length < 2) return { consensus: 'insufficient', adjustment: 0 };
  if (safeWeight > 0 && dangerWeight > 0) return { consensus: 'conflicting', adjustment: -1 };
  if (hasEdgeCases) return { consensus: 'conditional', adjustment: 0 };
  if (safeWeight > dangerWeight * 2) return { consensus: 'safe', adjustment: 1 };
  if (dangerWeight > safeWeight * 2) return { consensus: 'dangerous', adjustment: 0 };

  return { consensus: 'conditional', adjustment: 0 };
}
```

### Confidence Adjustment from Web Research

| Scenario | Confidence Effect |
|----------|-------------------|
| Multiple official sources agree "safe" | Can upgrade to High |
| Multiple sources agree "dangerous" | Upgrade risk score |
| Edge cases found | Add warnings, keep confidence |
| Sources disagree | Downgrade to Low, flag "Conflicting" |
| No relevant results | No change, note "Limited info online" |
| Official Microsoft guidance found | Weight heavily |

### Caching

- **Cache key:** Anonymised path pattern (not full path)
- **Cache duration:** 7 days
- **Cache location:** `%APPDATA%\DiskSage\research-cache.json`
- **Cache invalidation:** Manual clear option in UI

---

## Offline Analysis Rules

### Risk 1 (Low) — High Confidence

| Pattern | Category | Confidence | Explanation |
|---------|----------|------------|-------------|
| `C:\Windows\Temp\*` | Windows temp | High | System temporary files. Rebuilt automatically. |
| `C:\Users\*\AppData\Local\Temp\*` | User temp | High | Application temporary files. Rebuilt automatically. |
| `C:\Users\*\AppData\Local\Google\Chrome\*\Cache\*` | Chrome cache | High | Browser cache. Rebuilt automatically. |
| `C:\Users\*\AppData\Local\Mozilla\Firefox\*\cache2\*` | Firefox cache | High | Browser cache. Rebuilt automatically. |
| `C:\Users\*\AppData\Local\Microsoft\Edge\*\Cache\*` | Edge cache | High | Browser cache. Rebuilt automatically. |
| `*.tmp` (in Temp folders only) | Temp file | High | Temporary file. Typically safe if not in use. |

### Risk 1 (Low) — Medium Confidence

| Pattern | Category | Confidence | Explanation |
|---------|----------|------------|-------------|
| `*\Cache\*` (general) | Generic cache | Medium | Appears to be cache. Verify not user-created folder. |
| `*\Caches\*` | Generic cache | Medium | Appears to be cache. Verify not user-created folder. |
| `~$*` | Office temp | Medium | Office temporary file. Safe if document is closed. |

### Risk 2 (Low-Medium) — High Confidence

| Pattern | Category | Confidence | Explanation |
|---------|----------|------------|-------------|
| `*\node_modules\*` | JavaScript packages | High | Downloaded packages. Recreate with `npm install`. |
| `*\__pycache__\*` | Python cache | High | Compiled Python files. Recreated automatically. |
| `*\.nuget\packages\*` | .NET packages | High | Downloaded packages. Recreate by building project. |
| `*\.npm\_cacache\*` | NPM cache | High | Package manager cache. Safe to clear. |

### Risk 2 (Low-Medium) — Medium Confidence

| Pattern | Category | Confidence | Explanation |
|---------|----------|------------|-------------|
| `C:\SWSETUP\*` | HP drivers | Medium | Driver installers. Usually safe after setup complete. |

### Risk 3 (Medium) — Requires Review

**IMPORTANT:** Windows Installer upgraded to Risk 3 due to complexity.

| Pattern | Category | Confidence | Explanation |
|---------|----------|------------|-------------|
| `C:\Windows\Installer\*` | Windows patches | Medium | **Do not delete directly.** Requires PatchCleaner tool. Wrong deletion can break application repair/uninstall. Microsoft warns against manual deletion. |
| `*\Downloads\*` | Downloads | Medium | Could contain important files. Review contents. |
| `*\AppData\Local\*` (unknown app) | App data | Low | Unknown application data. Needs investigation. |
| `C:\SQL2019\*` | SQL installer | Medium | Installation media. Probably safe if SQL installed. |

### Risk 4 (High) — Backup Required

| Pattern | Category | Confidence | Explanation |
|---------|----------|------------|-------------|
| `*\Documents\*` | Documents | High | Personal files. Never delete without backup. |
| `*\Desktop\*` | Desktop files | High | Often contains important files. Backup first. |
| `*\Pictures\*` | Photos | High | Personal memories. Never delete without backup. |
| `*\Videos\*` | Videos | High | Personal videos. Never delete without backup. |
| `*\OneDrive\*` | OneDrive | High | **Warning:** Cloud-synced. Deletion affects cloud copy. |

### Risk 5 (Critical) — Do Not Delete

| Pattern | Category | Confidence | Explanation |
|---------|----------|------------|-------------|
| `C:\Windows\System32\*` | Windows system | High | Core Windows files. Never delete. |
| `C:\Windows\WinSxS\*` | Windows components | High | Shared libraries. Appears large but necessary. |
| `C:\Windows\SysWOW64\*` | Windows 32-bit system | High | 32-bit Windows files. Never delete. |
| `C:\Program Files\*` | Programs (64-bit) | High | Installed applications. Uninstall via Settings. |
| `C:\Program Files (x86)\*` | Programs (32-bit) | High | Installed applications. Uninstall via Settings. |
| `C:\ProgramData\*` | Program data | High | Application data. Usually required. |
| `C:\Recovery\*` | Recovery partition | High | Windows recovery files. Do not delete. |
| `C:\System Volume Information\*` | System restore | High | Restore points. Manage via System Properties. |
| `C:\$Recycle.Bin\*` | Recycle bin | High | Use "Empty Recycle Bin" instead. |

---

## Path Validation (HIGH PRIORITY)

Before classifying any path, check for:

### Junction Points and Symlinks
```typescript
// Detect if path is a junction/symlink
async function isRealPath(path: string): Promise<boolean> {
  // Use fs.lstat to detect symlinks
  // If symlink, resolve and re-evaluate
}
```

**If junction/symlink detected:** Add warning "This folder may point to another location. Verify before acting."

### OneDrive Paths
```typescript
// Detect OneDrive-synced folders
function isOneDrivePath(path: string): boolean {
  return path.includes('\\OneDrive\\') ||
         path.includes('\\OneDrive -');
}
```

**If OneDrive detected:** Add warning "This folder syncs to the cloud. Deleting here will also delete from OneDrive."

### Locale-Aware Matching

Common folder names by locale:

| English | German | French | Spanish | Italian |
|---------|--------|--------|---------|---------|
| Documents | Dokumente | Documents | Documentos | Documenti |
| Pictures | Bilder | Images | Imágenes | Immagini |
| Downloads | Downloads | Téléchargements | Descargas | Download |

**Implementation:** Use Windows Known Folders API or check common variants.

---

## AI Integration

### Uncertainty-First Prompting

```
I'm helping a user understand what's using space on their Windows computer.
I need your help identifying a folder, but please be honest about uncertainty.

Path: C:\Users\[USER]\AppData\Local\[APP]\DataCollection\
Size: 2.3 GB
Files: 847 (.log 94%, .json 5%, .txt 1%)
Date range: March 2024 to February 2026

Please respond with:
1. What this MIGHT be (acknowledge if you're uncertain)
2. Confidence level: HIGH (I'm quite sure), MEDIUM (educated guess), or LOW (uncertain)
3. Risk level 1-5 if deleted (1=typically safe, 5=critical)
4. Recommended action with appropriate caveats
5. What could go wrong if this recommendation is incorrect

Be conservative. When in doubt, recommend "investigate further" rather than "delete."
```

### AI Response Handling

- AI confidence becomes the classification confidence (capped at Medium for AI responses)
- Always append: "This assessment is based on pattern matching and may be incorrect."
- Never display AI response as authoritative — frame as "AI suggests..."

---

## User Interface

### Safety Intro Screen (First Thing Users See)

```
┌──────────────────────────────────────────────────────────────────┐
│  DiskSage                                                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Before we start, a few important things:                        │
│                                                                  │
│  1. BACKUP FIRST                                                 │
│     When did you last back up your important files?             │
│     DiskSage provides guidance, not guarantees.                 │
│                                                                  │
│  2. YOU DECIDE                                                   │
│     DiskSage will never delete anything. You review             │
│     recommendations and act in File Explorer.                   │
│                                                                  │
│  3. WHEN IN DOUBT, DON'T                                         │
│     If a recommendation doesn't feel right, skip it.            │
│     It's better to keep something than lose it.                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ○ I have a recent backup of my important files            │ │
│  │ ○ I understand I should verify before deleting            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                                         [Continue →]             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Main Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│  DiskSage                                      [Report Problem]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  C: Drive — 229 GB used of 235 GB          ████████████████░░░  │
│  Potential savings identified: 47 GB                             │
│  (Verify each item before acting)                                │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Sort: [Size ▼]  Show: [All ▼]  Confidence: [All ▼]             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ● Chrome Browser Cache                    2.3 GB    [>]  │   │
│  │   Risk: Low  |  Confidence: High                         │   │
│  │   Typically safe — Rebuilds automatically                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ● Windows Installer                      30.0 GB    [>]  │   │
│  │   Risk: Medium  |  Confidence: Medium                    │   │
│  │   Requires special tool — Do not delete directly         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ● HP Driver Installers                    3.7 GB    [>]  │   │
│  │   Risk: Low-Medium  |  Confidence: Medium                │   │
│  │   Probably safe — Verify you don't need to reinstall     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ● Unknown: Power Automate Data            2.1 GB    [>]  │   │
│  │   Risk: Unknown  |  Confidence: Low                      │   │
│  │   Needs investigation — [Ask AI] [Research Online]       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ⚠ Documents                              12.4 GB    [>]  │   │
│  │   Risk: High  |  Confidence: High                        │   │
│  │   Backup required — Contains personal files              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Expanded Detail Panel with Web Research

```
┌──────────────────────────────────────────────────────────────────┐
│ Windows Installer                                         30 GB  │
│ C:\Windows\Installer\                                            │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ Risk: Medium ●●●○○   Confidence: Medium                          │
│ Recommendation: Requires special tool                            │
│                                                                  │
│ [Ask AI]  [Research Online]                                      │
│                                                                  │
│ ─── WHAT IS THIS? ───────────────────────────────────────────── │
│                                                                  │
│ When Windows and programs update, they save old update files    │
│ here in case you need to uninstall or repair. Over time this    │
│ grows large with outdated patches.                              │
│                                                                  │
│ Your folder: 1,133 files, mostly .msp files from 2017-2026      │
│                                                                  │
│ ─── WEB RESEARCH RESULTS ────────────────────────────────────── │
│                                                                  │
│ Found 4 relevant sources (cached 2 days ago):                   │
│                                                                  │
│ ✓ Microsoft Support (official)                                  │
│   "Do not manually delete files from the Windows Installer      │
│   folder. Doing so can prevent programs from running..."        │
│   → support.microsoft.com/kb/2276496                            │
│                                                                  │
│ ✓ Super User (community, 127 votes)                              │
│   "Use PatchCleaner or similar tools. Never delete directly."   │
│   → superuser.com/questions/707767                              │
│                                                                  │
│ ✓ BleepingComputer (expert)                                      │
│   "Orphaned MSI/MSP files can be removed with care using..."    │
│   → bleepingcomputer.com/forums/t/629647                        │
│                                                                  │
│ ⚠ CONSENSUS: Do not delete directly. Use specialised tool.      │
│                                                                  │
│ ⚠ EDGE CASES FOUND:                                              │
│   • "Be careful if you have pending Windows updates"            │
│   • "Some applications may break if wrong files removed"        │
│                                                                  │
│ ─── IF YOU DELETE INCORRECTLY ───────────────────────────────── │
│                                                                  │
│ • Applications may fail to repair or uninstall                  │
│ • Windows updates may fail                                       │
│ • You may not notice problems until months later                │
│                                                                  │
│ ─── HOW TO CLEAN SAFELY ─────────────────────────────────────── │
│                                                                  │
│ 1. Download "PatchCleaner" (free third-party tool)              │
│ 2. Run as Administrator                                          │
│ 3. It identifies orphaned patches that are safe to remove       │
│ 4. Even then, keep a system backup first                        │
│                                                                  │
│ Note: Even PatchCleaner can occasionally misidentify files.     │
│ Estimated savings: 20-25 GB (varies by system)                  │
│                                                                  │
│ [Open in Explorer]  [Copy Path]  [Report Incorrect Info]        │
└──────────────────────────────────────────────────────────────────┘
```

### Report Problem Modal

```
┌──────────────────────────────────────────────────────────────────┐
│  Report Incorrect Recommendation                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Item: Chrome Browser Cache (2.3 GB)                            │
│  Our recommendation: Typically safe                              │
│                                                                  │
│  What went wrong?                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ○ Recommendation was wrong — caused data loss             │ │
│  │ ○ Recommendation was wrong — caused application problems  │ │
│  │ ○ Folder was misidentified (it's actually something else) │ │
│  │ ○ Explanation was confusing or unclear                    │ │
│  │ ○ Other                                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Additional details (optional):                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  This helps improve DiskSage for everyone.                      │
│                                                                  │
│                              [Cancel]  [Submit Report]           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Audit Logging (HIGH PRIORITY)

Every recommendation is logged locally:

```typescript
interface AuditEntry {
  timestamp: string;
  sessionId: string;
  path: string;
  size: number;
  riskScore: number;
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
  source: 'offline-rule' | 'ai' | 'web-research';
  ruleId?: string;
  aiResponse?: string;
  webResearchSummary?: string;
}
```

**Log location:** `%APPDATA%\DiskSage\audit.log`

**Purpose:**
- Debug if something goes wrong
- Identify patterns in incorrect recommendations
- Improve rules over time

---

## Testing Strategy (HIGH PRIORITY)

### Positive Test Cases

For each rule, verify it matches expected paths:

```typescript
const testCases = [
  { path: 'C:\\Windows\\Temp\\file.tmp', expectedRule: 'windows-temp', expectedRisk: 1 },
  { path: 'C:\\Users\\Test\\AppData\\Local\\Temp\\file.tmp', expectedRule: 'user-temp', expectedRisk: 1 },
  // ... more cases
];
```

### Negative Test Cases (CRITICAL)

Verify rules DON'T match paths they shouldn't:

```typescript
const negativeCases = [
  { path: 'C:\\Users\\Test\\Documents\\ProjectCache\\data.json', shouldNotMatch: 'generic-cache' },
  { path: 'C:\\ImportantApp\\Cache\\settings.db', shouldNotMatch: 'generic-cache' },
  { path: 'C:\\Users\\Test\\MyFiles.tmp\\important.doc', shouldNotMatch: 'temp-file' },
  // ... more cases
];
```

### Diverse Sample Testing

Before release, test against WizTree exports from:
- [ ] Your machine (developer)
- [ ] At least 2 other Windows machines
- [ ] Non-English Windows if possible
- [ ] Machine with OneDrive enabled
- [ ] Machine with corporate folder redirection (if available)

---

## Project Structure

```
DiskSage/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── CLAUDE.md
├── plan.md
│
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # IPC bridge
│   └── services/
│       ├── parser.ts        # WizTree CSV parser
│       ├── pathValidator.ts # Junction/symlink/OneDrive detection
│       ├── analyzer.ts      # Rule engine with confidence
│       ├── rules.ts         # Rule definitions
│       ├── webResearch.ts   # Curated web search
│       ├── researchCache.ts # Research result caching
│       ├── auditLog.ts      # Local audit logging
│       └── claude.ts        # Claude API adapter
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── SafetyIntro.tsx
│   │   ├── ImportPanel.tsx
│   │   ├── DriveSummary.tsx
│   │   ├── RecommendationList.tsx
│   │   ├── RecommendationCard.tsx
│   │   ├── DetailPanel.tsx
│   │   ├── WebResearchPanel.tsx
│   │   ├── RiskBadge.tsx
│   │   ├── ConfidenceBadge.tsx
│   │   └── ReportProblem.tsx
│   ├── hooks/
│   │   ├── useAnalysis.ts
│   │   └── useWebResearch.ts
│   ├── types.ts
│   └── styles.css
│
├── tests/
│   ├── rules.test.ts        # Positive test cases
│   ├── negative.test.ts     # Negative test cases
│   └── fixtures/            # Sample WizTree exports
│
└── assets/
    └── icon.png
```

---

## Implementation Phases

### Phase 1: Safety Foundation (FIRST — ~45 min)
- [ ] Set up project structure
- [ ] Implement audit logging
- [ ] Create path validator (junctions, symlinks, OneDrive)
- [ ] Write test framework for rules
- [ ] Create negative test cases

### Phase 2: Rule Engine (~1 hour)
- [ ] WizTree CSV parser
- [ ] Rule definitions with confidence levels
- [ ] Analysis engine returning Risk + Confidence
- [ ] Run positive and negative tests
- [ ] Fix any rule conflicts

### Phase 3: Safety UI (~1 hour)
- [ ] Safety intro screen with checkboxes
- [ ] Dual-badge display (Risk + Confidence)
- [ ] Conservative language throughout
- [ ] Report problem modal
- [ ] Warnings for OneDrive/junction paths

### Phase 4: Core UI (~45 min)
- [ ] Import panel with drag-drop
- [ ] Drive summary bar
- [ ] Recommendation list with sorting/filtering
- [ ] Expandable detail cards

### Phase 5: Web Research (~45 min)
- [ ] Web search with site restriction
- [ ] Result parsing and sentiment detection
- [ ] Edge case extraction
- [ ] Consensus calculation
- [ ] Cache implementation
- [ ] "Research Online" button in UI
- [ ] Research results display panel

### Phase 6: AI Integration (~30 min)
- [ ] Path anonymiser
- [ ] Uncertainty-first prompt
- [ ] AI response capped at Medium confidence
- [ ] "AI suggests..." framing

### Phase 7: Testing & Polish (~30 min)
- [ ] Test on own WizTree export
- [ ] Test on at least one other machine's export
- [ ] Error handling
- [ ] Loading states

---

## Success Criteria

### Safety Criteria (Must Pass)

1. **No false positives on critical files** — System32, Program Files never shown as deletable
2. **Confidence accurately reflects certainty** — Unknown items never shown as High confidence
3. **Language never implies certainty** — No "safe to delete" anywhere
4. **Audit log captures all recommendations** — Complete record exists
5. **All negative test cases pass** — Rules don't match what they shouldn't
6. **Web research surfaces edge cases** — Warnings shown even when consensus is "safe"

### Functional Criteria

7. **Works on my disk** — Correctly analyses my WizTree export
8. **Identifies wins** — Shows potential savings with appropriate caveats
9. **Feels trustworthy** — Conservative tone builds appropriate caution
10. **Web research adds value** — Provides useful context beyond offline rules

---

## Future (v2+)

- Multiple AI providers (OpenAI, Ollama)
- Export recommendations as report
- Problem report aggregation and rule improvement
- Community-contributed test cases
- Multi-drive support
- Locale detection and localised folder matching
- Automatic web research for all Medium confidence items

---

## AI Advisor Feature — Implementation Plan

### Context

A manual disk cleanup guided by Claude recovered ~150 GB. The biggest wins came from system-level actions (DISM, cleanmgr, hibernation), app-specific caches (Raspberry Pi Imager 872 MB, WebEx versions 278 MB, Claude Code old versions 219 MB), and developer caches. DiskSage currently classifies individual folders via 33 offline rules and lets users mark/delete them, but has no strategic layer — it doesn't look at the whole picture and suggest a plan of attack.

This plan adds an **AI Advisor tab** that sends the full scan summary to Claude, receives a structured cleanup plan categorised by action type, and lets the user act on each recommendation — either within DiskSage or by copying commands to run manually.

The AI service (`claude.ts`) is currently a stub returning placeholder responses. The settings service only stores backup location. All three Electron wrapper files (main.ts, preload.ts, electron.d.ts) need new IPC channels.

### Design Decisions

- **Claude API only** — no multi-provider abstraction for now
- **System actions shown as commands to copy** — DiskSage recommends and explains, user runs in PowerShell
- **New "Advisor" tab** — fourth tab alongside Explore, By Risk, Marked
- **Settings panel** — modal dialog for API key entry (previously deferred to v2)

---

### Step 1: Install Anthropic SDK

**File:** `package.json`

- Add `"@anthropic-ai/sdk": "^0.39.0"` to `dependencies`
- Run `npm install`

---

### Step 2: Add New Types

**File:** `src/types.ts`

Add at the end of the file:

```typescript
// AI Advisor types
export interface SystemAction {
  id: string
  name: string
  command: string
  explanation: string
  estimatedSavings: string
  riskLevel: 'low' | 'medium' | 'high'
}

export interface AdvisorItemReference {
  path: string
  size: number
  reason: string
}

export interface AdvisorCategory {
  type: 'disksage' | 'system' | 'investigate' | 'external'
  title: string
  description: string
  items?: AdvisorItemReference[]
  actions?: SystemAction[]
  guidance?: string
  totalSize?: number
}

export interface AdvisorPlan {
  categories: AdvisorCategory[]
  summary: string
  createdAt: string
}
```

---

### Step 3: Create System Actions Catalogue

**File:** `electron/services/systemActions.ts` (NEW)

Hardcoded catalogue of known Windows cleanup actions the AI can reference:

| ID | Action | Est. Savings |
|---|---|---|
| `dism-cleanup` | DISM Component Store (conservative) | 2-10 GB |
| `dism-resetbase` | DISM Component Store (aggressive) | 5-20 GB |
| `disk-cleanup` | Windows Disk Cleanup utility | 5-30 GB |
| `hibernation-off` | Disable hibernation (deletes hiberfil.sys) | 8-32 GB |
| `temp-cleanup` | Clear Windows + User temp folders | 0.5-5 GB |
| `npm-cache-clear` | npm cache clean | 0.5-5 GB |
| `pip-cache-purge` | pip cache purge | 0.5-3 GB |
| `nuget-cache-clear` | dotnet nuget locals all --clear | 0.5-3 GB |

Each entry has: `id`, `name`, `command` (PowerShell), `explanation`, `estimatedSavings`, `riskLevel`.

Export: `SYSTEM_ACTIONS` record and `getAllSystemActions()` helper.

---

### Step 4: Extend Settings Service

**File:** `electron/services/settingsService.ts`

- Add `claudeApiKey: string | null` to `AppSettings` interface and `DEFAULT_SETTINGS`
- Add `getClaudeApiKey()` and `setClaudeApiKey()` helper functions (same pattern as backup location)

---

### Step 5: Replace Claude Service Stub with Real Implementation

**File:** `electron/services/claude.ts`

Replace the entire file. Key changes:

**`askClaudeAI(entry)` — existing per-item function:**
- Check for API key via `getClaudeApiKey()` — return "not configured" classification if missing
- Instantiate `Anthropic` client with key
- Call `client.messages.create()` with existing `buildPrompt()` (model: `claude-sonnet-4-20250514`)
- Parse response with existing `parseClaudeResponse()` (confidence capped at medium)
- Error handling: return graceful error classification

**`getAdvisorPlan(entries, totalSize)` — new advisor function:**
- Check for API key — throw if missing
- Sort entries by size, take top 50
- Anonymise all paths via existing `anonymisePath()`
- Build advisor prompt (see Prompt Design below)
- Call Claude with `max_tokens: 4096`
- Parse structured JSON response
- Map system action IDs to full `SystemAction` objects from catalogue
- Calculate `totalSize` per category
- Return `AdvisorPlan`

**Advisor Prompt Design:**
- Sends: scan summary (total items, total size) + top 50 folders (anonymised path, size, modified date)
- Requests JSON response with 4 categories:
  - `disksage`: items with paths and reasons (for marking in DiskSage)
  - `system`: action IDs referencing the catalogue (for PowerShell commands)
  - `investigate`: items needing manual review (AI explains what it thinks each is)
  - `external`: guidance text (duplicate detection, app uninstalls, etc.)
- Constraints: use only catalogue action IDs for system category; be conservative; put uncertain items in investigate

**Keep:** `anonymisePath()`, `parseClaudeResponse()`, `extractRecommendation()`, `formatSize()`, `guessFileTypes()` — these existing helpers stay, with `anonymisePath` and `parseClaudeResponse` reused.

---

### Step 6: Extend Session Service

**File:** `electron/services/sessionService.ts`

- Add `advisorPlan?: AdvisorPlan | null` to `SessionData` interface
- Update `saveSession()` signature to accept optional `advisorPlan` parameter
- `loadSession()` already returns the full object, so it will include `advisorPlan` automatically

---

### Step 7: Update Electron Main Process

**File:** `electron/main.ts`

Add imports:
- `getAdvisorPlan` from `./services/claude`
- `getClaudeApiKey`, `setClaudeApiKey` from `./services/settingsService`

Add 3 new IPC handlers:
- `'get-advisor-plan'` → calls `getAdvisorPlan(entries, totalSize)`
- `'get-claude-api-key'` → calls `getClaudeApiKey()`
- `'set-claude-api-key'` → calls `setClaudeApiKey(apiKey)`

Update existing handler:
- `'save-session'` → add `advisorPlan` as 5th parameter, pass through to `saveSession()`

---

### Step 8: Update Electron Preload Bridge

**File:** `electron/preload.ts`

Add import of `AdvisorPlan` type.

Add 3 new methods to `electronAPI` object:
- `getAdvisorPlan: (entries, totalSize) => ipcRenderer.invoke('get-advisor-plan', entries, totalSize)`
- `getClaudeApiKey: () => ipcRenderer.invoke('get-claude-api-key')`
- `setClaudeApiKey: (apiKey) => ipcRenderer.invoke('set-claude-api-key', apiKey)`

Update existing method:
- `saveSession` — add `advisorPlan?: AdvisorPlan | null` as 5th parameter
- `loadSession` return type — add `advisorPlan?: AdvisorPlan | null`

---

### Step 9: Update Type Declarations

**File:** `src/electron.d.ts`

Add `AdvisorPlan` to the import from `./types`.

Add to `ElectronAPI` interface:
- `getAdvisorPlan: (entries: FileEntry[], totalSize: number) => Promise<AdvisorPlan>`
- `getClaudeApiKey: () => Promise<string | null>`
- `setClaudeApiKey: (apiKey: string | null) => Promise<void>`

Update:
- `saveSession` signature — add `advisorPlan?: AdvisorPlan | null`
- `loadSession` return type — add `advisorPlan?: AdvisorPlan | null`

---

### Step 10: Update TabContainer

**File:** `src/components/TabContainer.tsx`

Change `TabId` type to: `'explore' | 'by-risk' | 'marked' | 'advisor'`

No other changes needed — the component is already data-driven via the `tabs` prop.

---

### Step 11: Create Settings Panel Component

**File:** `src/components/SettingsPanel.tsx` (NEW)

Modal dialog for API key entry:
- Input field for Claude API key (placeholder: `sk-ant-...`)
- Validation: key must start with `sk-ant-` if provided
- Loads existing key on mount (displays masked: `sk-ant-api...last4`)
- Save/Cancel/Clear buttons
- Success/error feedback
- Link to console.anthropic.com for getting a key

Props: `onClose: () => void`

---

### Step 12: Create Advisor Tab Component

**File:** `src/components/AdvisorTab.tsx` (NEW)

Three states:

**State 1 — No API key:** Prompt to configure key, button opens SettingsPanel.

**State 2 — Ready (no plan yet):** "Generate Cleanup Plan" button with scan summary. Note that top 50 folders will be sent (anonymised).

**State 3 — Plan displayed:** Structured view with collapsible category cards:

- **Category A (green) — "DiskSage Can Handle":** List of items with size, reason. Per-item "Mark" button. Bulk "Mark All" button that calls `onMarkForDeletion` with all paths.
- **Category B (blue) — "System Actions":** Cards with action name, explanation, estimated savings, risk badge. Dark code block showing the command. "Copy Command" button using clipboard API.
- **Category C (amber) — "Investigate":** Items with AI's assessment of what each likely is. "Open in Explorer" button.
- **Category D (grey) — "External Tools":** Guidance text block.

Header shows AI's summary in a blue info box. "Regenerate" button to re-run.

Props:
```typescript
entries: FileEntry[]
recommendations: RecommendationItem[]
advisorPlan: AdvisorPlan | null
advisorLoading: boolean
hasApiKey: boolean
onGeneratePlan: () => Promise<void>
onMarkForDeletion: (paths: string[]) => void
onOpenInExplorer: (path: string) => void
onOpenSettings: () => void
```

---

### Step 13: Update App.tsx

**File:** `src/App.tsx`

**New imports:** `AdvisorPlan`, `AdvisorTab`, `SettingsPanel`

**New state:**
- `advisorPlan: AdvisorPlan | null` (init: null)
- `advisorLoading: boolean` (init: false)
- `hasApiKey: boolean` (init: false)
- `showSettings: boolean` (init: false)

**New useEffect:** On mount, check for API key: `getClaudeApiKey().then(key => setHasApiKey(!!key))`

**Update `loadPreviousSession`:** Restore `advisorPlan` from session if present.

**Update `handleScanComplete`:** Clear `advisorPlan` to null on new scan.

**Update `tabs` array:** Add `{ id: 'advisor', label: 'Advisor' }` as 4th tab.

**New handler `handleGenerateAdvisorPlan`:**
- Set `advisorLoading = true`
- Call `window.electronAPI.getAdvisorPlan(state.entries, totalSize)`
- Set `advisorPlan` with result
- Save to session via `saveSession` with plan
- Set `advisorLoading = false`
- Error handling: set `state.error`

**New handler `handleOpenSettings` / `handleCloseSettings`:**
- Toggle `showSettings`
- On close, recheck API key

**Update header:** Add "Settings" button before "New Scan"

**Add AdvisorTab render:** In TabContainer children, add `{activeTab === 'advisor' && <AdvisorTab ... />}`

**Add SettingsPanel render:** After error toast, add `{showSettings && <SettingsPanel onClose={handleCloseSettings} />}`

---

### Verification

1. `npm install` — confirm `@anthropic-ai/sdk` installs
2. `npm run dev` — app starts, no TypeScript errors
3. Navigate to Advisor tab with no API key — shows "Configure API Key" prompt
4. Open Settings, enter valid API key, save — key persists
5. Advisor tab now shows "Generate Cleanup Plan" — click it
6. Claude API call succeeds, plan renders with 4 categories
7. Click "Mark All" on Category A items — items appear in Marked tab
8. Click "Copy Command" on a system action — command copies to clipboard
9. Close and reopen app — advisor plan restored from session
10. Click "New Scan" — advisor plan cleared
11. Re-import CSV, generate new plan — fresh analysis

---

### Files Modified (Summary)

| File | Change |
|---|---|
| `package.json` | Add @anthropic-ai/sdk dependency |
| `src/types.ts` | Add AdvisorPlan, AdvisorCategory, SystemAction, AdvisorItemReference types |
| `electron/services/systemActions.ts` | **NEW** — system actions catalogue |
| `electron/services/settingsService.ts` | Add claudeApiKey to AppSettings |
| `electron/services/claude.ts` | Replace stub with real Anthropic API + advisor prompt |
| `electron/services/sessionService.ts` | Add advisorPlan to SessionData + saveSession |
| `electron/main.ts` | Add 3 IPC handlers, update save-session handler |
| `electron/preload.ts` | Add 3 bridge methods, update saveSession + loadSession |
| `src/electron.d.ts` | Add 3 API methods, update saveSession + loadSession types |
| `src/components/TabContainer.tsx` | Add 'advisor' to TabId union |
| `src/components/SettingsPanel.tsx` | **NEW** — API key settings modal |
| `src/components/AdvisorTab.tsx` | **NEW** — advisor tab with 4 category cards |
| `src/App.tsx` | Add advisor state, settings state, 4th tab, handlers |
