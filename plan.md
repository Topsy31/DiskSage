# DiskSage — Implementation Plan

Smart disk cleanup advisor that helps users identify space savings with appropriate caution.

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
| **UI polish** | Clean and readable |
| **Defer to v2** | Export/report, multiple AI providers, settings UI |

---

## Safety Model (HIGH PRIORITY)

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
15. **Open in Explorer** — button to navigate to folder

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
│  ├── Review summary screen                                   │
│  └── Report problem modal                                    │
├─────────────────────────────────────────────────────────────┤
│  Analysis Engine (Electron main process)                    │
│  ├── WizTree CSV parser                                     │
│  ├── Path validator (junctions, symlinks, OneDrive)         │
│  ├── Offline rule engine (with confidence)                  │
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
| **High** | Pattern matches exactly, well-understood folder | Known Windows paths, standard caches |
| **Medium** | Pattern matches but edge cases possible | User folders, app data |
| **Low** | Uncertain classification | Unknown apps, ambiguous paths, AI inference |

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
│  │   Needs investigation — [Ask AI]                         │   │
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

### Expanded Detail Panel

```
┌──────────────────────────────────────────────────────────────────┐
│ Windows Installer                                         30 GB  │
│ C:\Windows\Installer\                                            │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ Risk: Medium ●●●○○   Confidence: Medium                          │
│ Recommendation: Requires special tool                            │
│                                                                  │
│ ─── WHAT IS THIS? ───────────────────────────────────────────── │
│                                                                  │
│ When Windows and programs update, they save old update files    │
│ here in case you need to uninstall or repair. Over time this    │
│ grows large with outdated patches.                              │
│                                                                  │
│ Your folder: 1,133 files, mostly .msp files from 2017-2026      │
│                                                                  │
│ ─── WARNING ─────────────────────────────────────────────────── │
│                                                                  │
│ ⚠ Do NOT delete files from this folder directly.                │
│ ⚠ Microsoft explicitly warns against manual deletion.           │
│ ⚠ Wrong deletion can break application repair/uninstall.        │
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
  source: 'offline-rule' | 'ai';
  ruleId?: string;
  aiResponse?: string;
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
│   │   ├── RiskBadge.tsx
│   │   ├── ConfidenceBadge.tsx
│   │   └── ReportProblem.tsx
│   ├── hooks/
│   │   └── useAnalysis.ts
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

### Phase 5: AI Integration (~30 min)
- [ ] Path anonymiser
- [ ] Uncertainty-first prompt
- [ ] AI response capped at Medium confidence
- [ ] "AI suggests..." framing

### Phase 6: Testing & Polish (~30 min)
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

### Functional Criteria

6. **Works on my disk** — Correctly analyses my WizTree export
7. **Identifies wins** — Shows potential savings with appropriate caveats
8. **Feels trustworthy** — Conservative tone builds appropriate caution

---

## Future (v2+)

- Multiple AI providers (OpenAI, Ollama)
- Settings UI for API keys
- Export recommendations as report
- Problem report aggregation and rule improvement
- Community-contributed test cases
- Direct disk scan without WizTree
- Multi-drive support
- Locale detection and localised folder matching
