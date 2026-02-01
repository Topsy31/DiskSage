# DiskSage — Implementation Plan

Smart disk cleanup advisor that helps non-technical users understand and manage disk space safely.

---

## ICE Framework Summary

### Intent

**Primary goal:** Help non-technical users understand and manage disk space across:
- Emergency cleanup (disk full now)
- Routine maintenance (prevent future problems)
- Understanding usage (know where space goes)

**Success criteria:**
- Identify measurable space recovery potential
- User understands what each item is and feels confident in decisions
- Analysis completes quickly (target: under 2 minutes for WizTree import)

**User context:** Non-technical users with unknown file relationships. Mistakes are potentially catastrophic — lost files could mean lost work, memories, or irreplaceable data.

### Constraints

| Constraint | Decision |
|------------|----------|
| **Safety model** | Informative — show everything with clear risk indicators, user decides |
| **Action scope** | Never delete files — recommendations only |
| **Jargon level** | Explain everything — assume user doesn't know what AppData is |
| **AI costs** | User provides API key, pays per use |
| **Privacy** | Anonymise paths before sending to AI |
| **Tracking** | No persistent tracking — fresh analysis every time |
| **Offline mode** | Degraded but functional — core features work without AI |

### Expectations

| Aspect | Expectation |
|--------|-------------|
| **First run** | Guided setup explaining what the app does |
| **Organisation** | User chooses — sortable/filterable by size, safety, category |
| **Explanations** | Expandable — summary by default, click for full detail |
| **Action types** | Full spectrum — delete, move, archive, backup, leave alone |
| **Move support** | Recommendations only — user moves files manually |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                      │
├─────────────────────────────────────────────────────────────┤
│  React Frontend                                              │
│  ├── Onboarding wizard (first-run setup)                    │
│  ├── Dashboard (drive overview, space breakdown)            │
│  ├── Recommendations list (sortable, filterable)            │
│  ├── Detail panel (expandable explanations)                 │
│  ├── Folder browser (drill into structure)                  │
│  └── Settings (AI provider config)                          │
├─────────────────────────────────────────────────────────────┤
│  Analysis Engine (Node.js backend)                          │
│  ├── WizTree CSV parser                                     │
│  ├── Direct disk scanner (fallback)                         │
│  ├── Offline rule engine (pattern matching)                 │
│  ├── Education database (plain-English explanations)        │
│  ├── Path anonymiser                                        │
│  └── AI orchestrator (batched queries)                      │
├─────────────────────────────────────────────────────────────┤
│  AI Adapters (user-configured)                              │
│  ├── Claude API                                             │
│  ├── OpenAI API                                             │
│  └── Ollama (local)                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Design Principles

### 1. Education First

Every item shows:
- **What it is** (plain English, no jargon)
- **Why it exists** (what created it, what uses it)
- **What happens if deleted** (consequences explained clearly)
- **Recommended action** (with reasoning)

Example for a non-technical user:

```
┌────────────────────────────────────────────────────────────┐
│ Chrome Browser Cache                              2.3 GB   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ Risk: Very Low ●○○○○                                       │
│ Recommendation: Safe to delete                             │
│                                                            │
│ [▼ What is this?]                                          │
│                                                            │
│ This is temporary data stored by Google Chrome to make     │
│ websites load faster. It includes copies of images,        │
│ scripts, and other files from websites you've visited.     │
│                                                            │
│ If you delete this:                                        │
│ • Websites may load slightly slower the first time         │
│ • You won't lose any bookmarks, passwords, or history      │
│ • Chrome will rebuild the cache automatically              │
│                                                            │
│ This is completely safe to delete.                         │
└────────────────────────────────────────────────────────────┘
```

### 2. Conservative Recommendations

When uncertain, the app should:
- Label items as "Review needed" rather than guessing
- Suggest "Leave alone" when risk outweighs benefit
- Never pressure users toward deletion
- Make "I don't know" a valid answer

### 3. Transparency

- Show whether classification came from offline rules or AI
- Display AI query cost before running (if applicable)
- Explain why AI couldn't classify something (if offline-only)

---

## Recommendation Categories

Each item receives one of these recommendations:

| Recommendation | Meaning | When to use |
|----------------|---------|-------------|
| **Safe to delete** | Very low risk, no consequences | Temp files, caches, old logs |
| **Probably safe** | Low risk, minor consequences | Installer caches, package caches |
| **Review first** | Uncertain — user should check | Unknown app data, ambiguous folders |
| **Backup first** | Medium value, delete after backup | Old projects, documents, downloads |
| **Move to another drive** | Valuable but rarely accessed | Media, archives, completed projects |
| **Leave alone** | Necessary or high risk | System files, active app data |

### Risk Score Scale (1-5)

| Score | Label | Colour | Meaning |
|-------|-------|--------|---------|
| 1 | Very Low | Green | Safe to delete without consequences |
| 2 | Low | Light green | Minor inconvenience if wrong |
| 3 | Medium | Yellow | Could cause issues, review first |
| 4 | High | Orange | Likely important, backup recommended |
| 5 | Critical | Red | Do not delete, system may break |

---

## Offline Analysis Rules

The app classifies ~80% of items without AI using pattern matching:

### Windows System (Risk 5 - Critical)

| Pattern | What it is | Explanation |
|---------|-----------|-------------|
| `C:\Windows\System32\*` | Core Windows files | Windows needs these to run. Never delete. |
| `C:\Windows\WinSxS\*` | Windows component store | Shared libraries Windows uses. Looks big but necessary. |
| `C:\Program Files\*` | Installed programs | Your applications live here. |

### Safe to Delete (Risk 1)

| Pattern | What it is | Explanation |
|---------|-----------|-------------|
| `*\Temp\*` | Temporary files | Scratch space for programs. Safe to clear. |
| `*\Cache\*` | Cached data | Speeds up apps but rebuilds automatically. |
| `*.tmp` | Temp file | Leftover from crashed or finished programs. |
| `~$*` | Office temp file | Created while editing Office docs. Safe if file closed. |
| `*\Cookies\*` | Browser cookies | Website login data. May need to re-login to sites. |

### Low Risk (Risk 2)

| Pattern | What it is | Explanation |
|---------|-----------|-------------|
| `C:\Windows\Installer\*.msp` | Windows patches | Old update files. Use PatchCleaner tool to safely remove. |
| `*\node_modules\*` | JavaScript dependencies | Downloaded packages. Can recreate with `npm install`. |
| `*\.nuget\*` | .NET packages | Downloaded packages. Can recreate by building project. |
| `*\__pycache__\*` | Python cache | Compiled Python files. Recreated automatically. |

### Needs Review (Risk 3)

| Pattern | What it is | Explanation |
|---------|-----------|-------------|
| `*\AppData\Local\*` (unknown) | Application data | Settings and data for programs. Ask AI what specific app does. |
| `*\Downloads\*` | Downloaded files | Could be important. Check before deleting. |
| `C:\SWSETUP\*` | HP driver installers | Safe after setup, but keep if you might reinstall drivers. |

### Backup Recommended (Risk 4)

| Pattern | What it is | Explanation |
|---------|-----------|-------------|
| `*\Documents\*` | Your documents | Personal files. Backup before any cleanup. |
| `*\Desktop\*` | Desktop files | Files saved to desktop. Often important. |
| `*\Pictures\*` | Your photos | Personal memories. Never delete without backup. |

---

## AI Integration

### When to Query AI

AI is used when:
1. Path doesn't match any known pattern
2. Item is in AppData but app name not recognised
3. Large folder (>100MB) with ambiguous contents

### Anonymisation

Before sending to AI:

```
Original: C:\Users\Mark\AppData\Local\SomeApp\DataCollection\logs
Becomes:  C:\Users\[USER]\AppData\Local\[APP_HASH_A1B2]\DataCollection\logs
```

Preserved: folder structure, file types, sizes, dates
Removed: usernames, specific app names (unless in known-apps list)

### AI Prompt Template

```
I'm analysing disk usage on a Windows computer. Please help me understand this folder:

Path pattern: C:\Users\[USER]\AppData\Local\[APP_HASH]\DataCollection\
Total size: 2.3 GB
File count: 847 files
File types: .log (94%), .json (5%), .txt (1%)
Oldest file: March 2024
Newest file: February 2026

Please tell me:
1. What type of application likely created this? (e.g., "diagnostic logging", "analytics")
2. What is this data used for?
3. Risk score 1-5 for deletion (1=safe, 5=critical)
4. Plain-English explanation suitable for a non-technical user
5. Recommended action: delete / review / backup / move / leave alone
```

### Cost Management

- Show estimated cost before AI analysis
- Batch multiple queries into single API call
- Cache responses for identical anonymised patterns
- Allow user to skip AI and mark as "Unknown"

---

## User Interface

### Onboarding Wizard (First Run)

**Step 1: Welcome**
> DiskSage helps you understand what's using space on your computer and what's safe to clean up.
>
> It will never delete anything — it only gives recommendations. You stay in control.

**Step 2: How It Works**
> 1. You export your disk data from WizTree (we'll show you how)
> 2. DiskSage analyses the data and explains what everything is
> 3. You decide what to clean up using File Explorer

**Step 3: AI Setup (Optional)**
> For folders we don't recognise, AI can help identify what they are.
> This is optional — DiskSage works without it.
>
> [Configure AI] or [Skip for now]

**Step 4: Get Started**
> [Import WizTree File] or [Learn how to export from WizTree]

### Main Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│  DiskSage                                    [Settings] [Help]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Drive C: — 229 GB used of 235 GB (97%)  ████████████████████░  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Potential savings identified: 47.2 GB                       │ │
│  │                                                              │ │
│  │  Safe to delete      ████████████████  18.3 GB             │ │
│  │  Review first        ████████          12.1 GB             │ │
│  │  Move/archive        ████████████      16.8 GB             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Sort by: [Size ▼]  Filter: [All categories ▼]  [Export report]  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┬────┐ │
│  │ Windows Installer Patches                              │ 30GB│ │
│  │ Risk: Low ●●○○○  |  Probably safe to delete           │     │ │
│  ├────────────────────────────────────────────────────────┼────┤ │
│  │ Chrome Browser Cache                                   │ 2.3G│ │
│  │ Risk: Very Low ●○○○○  |  Safe to delete               │     │ │
│  ├────────────────────────────────────────────────────────┼────┤ │
│  │ HP Driver Installers (SWSETUP)                        │ 3.7G│ │
│  │ Risk: Low ●●○○○  |  Review first                      │     │ │
│  ├────────────────────────────────────────────────────────┼────┤ │
│  │ Downloads folder                                       │ 8.2G│ │
│  │ Risk: Medium ●●●○○  |  Review contents                │     │ │
│  └────────────────────────────────────────────────────────┴────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Detail Panel (Expanded View)

When user clicks an item, show full explanation:

```
┌────────────────────────────────────────────────────────────────┐
│ Windows Installer Patches                               30 GB  │
│ Location: C:\Windows\Installer\                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                                │
│ Risk Level: Low ●●○○○                                          │
│ Recommendation: Probably safe to delete                        │
│ Analysis: Offline rules                                        │
│                                                                │
│ ─── What is this? ───────────────────────────────────────────  │
│                                                                │
│ When Windows and other programs update, they save the old      │
│ update files here in case you need to uninstall the update.    │
│ Over time, this folder grows very large with outdated patches  │
│ that are no longer needed.                                     │
│                                                                │
│ Your folder contains 1,133 files, mostly .msp (patch) files    │
│ dating from 2017 to 2026.                                      │
│                                                                │
│ ─── What happens if I delete this? ─────────────────────────   │
│                                                                │
│ • You may not be able to uninstall old Windows updates         │
│ • Your installed programs will continue working                │
│ • Windows Update will continue working                         │
│                                                                │
│ ─── How to clean this safely ────────────────────────────────  │
│                                                                │
│ Don't delete these files directly. Instead:                    │
│                                                                │
│ 1. Download "PatchCleaner" (free tool)                         │
│ 2. Run it as Administrator                                     │
│ 3. It identifies which patches are orphaned (truly not needed) │
│ 4. Delete only the orphaned ones                               │
│                                                                │
│ Estimated safe savings: 20-25 GB                               │
│                                                                │
│ [Open folder in Explorer]  [Copy path]                         │
└────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
DiskSage/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── CLAUDE.md
├── plan.md
│
├── electron/
│   ├── main.ts                    # Electron main process
│   ├── preload.ts                 # Secure IPC bridge
│   └── services/
│       ├── wiztree-parser.ts      # CSV import and validation
│       ├── disk-scanner.ts        # Direct scan fallback
│       ├── analyzer.ts            # Offline rule engine
│       ├── education.ts           # Plain-English explanations
│       ├── anonymizer.ts          # Path sanitisation
│       ├── ai-orchestrator.ts     # AI query management
│       └── ai-adapters/
│           ├── types.ts
│           ├── claude.ts
│           ├── openai.ts
│           └── ollama.ts
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Onboarding/
│   │   │   ├── Welcome.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── AISetup.tsx
│   │   │   └── GetStarted.tsx
│   │   ├── Dashboard/
│   │   │   ├── DriveOverview.tsx
│   │   │   ├── SavingsSummary.tsx
│   │   │   └── CategoryBreakdown.tsx
│   │   ├── Recommendations/
│   │   │   ├── RecommendationList.tsx
│   │   │   ├── RecommendationCard.tsx
│   │   │   ├── DetailPanel.tsx
│   │   │   └── FilterSort.tsx
│   │   ├── Import/
│   │   │   ├── ImportPanel.tsx
│   │   │   └── WizTreeGuide.tsx
│   │   ├── Settings/
│   │   │   ├── SettingsPanel.tsx
│   │   │   └── AIProviderConfig.tsx
│   │   └── common/
│   │       ├── RiskBadge.tsx
│   │       ├── SizeDisplay.tsx
│   │       └── ProgressBar.tsx
│   ├── hooks/
│   │   ├── useAnalysis.ts
│   │   ├── useSettings.ts
│   │   └── useOnboarding.ts
│   ├── types/
│   │   └── index.ts
│   └── styles/
│       └── globals.css
│
├── data/
│   ├── known-paths.json           # Offline classification rules
│   ├── known-apps.json            # Recognised application names
│   ├── explanations.json          # Plain-English descriptions
│   └── cleanup-guides.json        # Step-by-step cleanup instructions
│
└── assets/
    └── icon.png
```

---

## Implementation Phases

### Phase 1: Project Scaffolding
- [ ] Create Electron + Vite + React project
- [ ] Configure TypeScript and Tailwind
- [ ] Set up electron-builder
- [ ] Create basic window structure

### Phase 2: Data Layer
- [ ] Build WizTree CSV parser
- [ ] Create data model for analysis items
- [ ] Build file tree structure from flat data
- [ ] Add import UI with drag-and-drop

### Phase 3: Offline Analysis
- [ ] Create known-paths.json rules database
- [ ] Build pattern matching engine
- [ ] Create explanations.json content
- [ ] Implement risk scoring

### Phase 4: User Interface
- [ ] Build onboarding wizard
- [ ] Create dashboard with charts
- [ ] Build recommendation list with sort/filter
- [ ] Create expandable detail panel

### Phase 5: AI Integration
- [ ] Define adapter interface
- [ ] Implement path anonymiser
- [ ] Build Claude adapter
- [ ] Build OpenAI adapter
- [ ] Build Ollama adapter
- [ ] Create cost estimation

### Phase 6: Polish
- [ ] Error handling
- [ ] Loading states
- [ ] Export report feature
- [ ] Package for Windows

---

## Content Requirements

### Explanations Database

Need plain-English explanations for:
- ~50 common Windows paths
- ~30 common applications
- ~20 file types
- ~10 cleanup procedures (e.g., how to use PatchCleaner)

### Tone Guidelines

- Friendly but not patronising
- Explain *why* something is safe/risky
- Give specific, actionable guidance
- Acknowledge when uncertain

---

## Success Metrics

1. **Accuracy:** >95% of known-path classifications are correct
2. **Coverage:** >80% of items classified without AI
3. **Clarity:** Non-technical user understands recommendations (user testing)
4. **Speed:** Analysis completes in <30 seconds for typical WizTree export
5. **Trust:** User feels confident enough to act on recommendations

---

## Future Considerations (v2+)

- Direct disk scan without WizTree dependency
- Scheduled analysis reminders
- Disk space trend tracking over time
- Integration with Windows Disk Cleanup
- Multi-drive support
- Cloud storage analysis
