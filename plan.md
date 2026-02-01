# DiskSage — Implementation Plan

Smart disk cleanup advisor that helps users identify safe space savings quickly.

---

## ICE Framework Summary

### Intent

| Aspect | Answer |
|--------|--------|
| **Core problem** | WizTree shows data but no guidance; cleanup tools feel scary; users don't understand their file system |
| **Value proposition** | Convenience + personalised analysis + trust (not speed or learning) |
| **User state** | Panic + anxiety (disk full, scared of breaking things) |
| **Job to be done** | Free up space + avoid disaster |
| **Definition of done** | Proves the concept — core flow works, usable to clean my drive |
| **One thing to do well** | Identify safe wins — show obvious stuff that can be deleted now |

### Constraints

| Aspect | Answer |
|--------|--------|
| **Safety model** | Informative — show everything with clear risk indicators, user decides |
| **Action scope** | Never delete files — recommendations only |
| **Jargon level** | Explain everything — assume user doesn't know what AppData is |
| **Accuracy strategy** | Conservative defaults + err toward "keep" when uncertain |
| **Validation** | Test on own WizTree export |
| **Failure modes** | Wrong recommendation → data loss; Poor UX → undermines trust |
| **Tech stack** | Electron + React (proven fast to build) |
| **Timeframe** | Weekend project |
| **Privacy** | Anonymise paths before sending to AI |

### Expectations

| Aspect | Answer |
|--------|--------|
| **First experience** | Dual mode: quick scan for panic, guided intro for anxiety |
| **Explanation depth** | Progressive — summary first, details on expand |
| **AI scope** | On-demand only — "Ask AI" button for specific unknown items |
| **UI polish** | Clean and readable (Tailwind defaults) |
| **Defer to v2** | Export/report, multiple AI providers, settings UI, polish |

---

## MVP Scope (v1)

### Must Have

1. **WizTree CSV import** — drag-drop or file picker
2. **Offline rule engine** — ~30 patterns covering common space hogs
3. **Recommendation list** — sorted by size (biggest wins first)
4. **Risk badge** — 1-5 scale with colour coding
5. **One-line recommendation** — per item (safe/review/backup/keep)
6. **Expandable detail panel** — plain-English explanation on click
7. **"Ask AI" button** — for unknown items (Claude only)
8. **Open in Explorer** — button to navigate to folder

### Won't Have (v1)

- Onboarding wizard (just brief intro text)
- Multiple AI providers (Claude only, API key via prompt or env)
- Export/report functionality
- Settings panel
- Direct disk scan (WizTree import only)
- Persistent history

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                      │
├─────────────────────────────────────────────────────────────┤
│  React Frontend                                              │
│  ├── Import panel (drag-drop CSV)                           │
│  ├── Drive summary bar                                       │
│  ├── Recommendation list (sortable)                         │
│  └── Detail panel (expandable explanations)                 │
├─────────────────────────────────────────────────────────────┤
│  Analysis Engine (Electron main process)                    │
│  ├── WizTree CSV parser                                     │
│  ├── Offline rule engine                                    │
│  ├── Path anonymiser                                        │
│  └── Claude API adapter                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Risk Score Scale

| Score | Label | Colour | Meaning |
|-------|-------|--------|---------|
| 1 | Very Low | Green | Safe to delete without consequences |
| 2 | Low | Light green | Minor inconvenience if wrong |
| 3 | Medium | Yellow | Could cause issues, review first |
| 4 | High | Orange | Likely important, backup recommended |
| 5 | Critical | Red | Do not delete, system may break |

---

## Recommendation Types

| Recommendation | When to use |
|----------------|-------------|
| **Safe to delete** | Temp files, caches, old logs |
| **Probably safe** | Installer caches, package caches |
| **Review first** | Unknown app data, ambiguous folders |
| **Backup first** | Old projects, documents, downloads |
| **Move to another drive** | Media, archives, rarely accessed |
| **Leave alone** | System files, active app data |

---

## Offline Analysis Rules

### Safe to Delete (Risk 1)

| Pattern | Category | Explanation |
|---------|----------|-------------|
| `*\Temp\*` | Temporary files | Scratch space for programs. Safe to clear. |
| `*\Cache\*` | Cached data | Speeds up apps but rebuilds automatically. |
| `*.tmp` | Temp file | Leftover from crashed or finished programs. |
| `~$*` | Office temp file | Created while editing Office docs. Safe if file closed. |
| `*\Google\Chrome\*\Cache*` | Chrome cache | Browser cache, rebuilds automatically. |
| `*\Mozilla\Firefox\*\cache*` | Firefox cache | Browser cache, rebuilds automatically. |
| `*\Microsoft\Edge\*\Cache*` | Edge cache | Browser cache, rebuilds automatically. |
| `*\Thumbs.db` | Thumbnail cache | Windows thumbnail previews. Rebuilds automatically. |
| `*\desktop.ini` | Folder settings | Folder customisation. Tiny files, low priority. |

### Low Risk (Risk 2)

| Pattern | Category | Explanation |
|---------|----------|-------------|
| `C:\Windows\Installer\*.msp` | Windows patches | Old update files. Use PatchCleaner for safe removal. |
| `C:\Windows\Installer\*.msi` | Windows installers | Installation files. Use PatchCleaner for safe removal. |
| `*\node_modules\*` | JavaScript packages | Downloaded packages. Recreate with `npm install`. |
| `*\.nuget\*` | .NET packages | Downloaded packages. Recreate by building project. |
| `*\__pycache__\*` | Python cache | Compiled Python files. Recreated automatically. |
| `*\.npm\*` | NPM cache | Package manager cache. Safe to clear. |
| `*\pip\cache\*` | Pip cache | Python package cache. Safe to clear. |
| `C:\SWSETUP\*` | HP drivers | Driver installers. Safe after system is stable. |

### Medium Risk (Risk 3)

| Pattern | Category | Explanation |
|---------|----------|-------------|
| `*\Downloads\*` | Downloads | Could be important. Check contents before deleting. |
| `*\AppData\Local\*` (unknown) | App data | Application settings/data. Needs investigation. |
| `C:\SQL2019\*` | SQL installer | Installation media. Safe if SQL already installed. |

### High Risk (Risk 4)

| Pattern | Category | Explanation |
|---------|----------|-------------|
| `*\Documents\*` | Documents | Personal files. Backup before any action. |
| `*\Desktop\*` | Desktop files | Often contains important files. Review carefully. |
| `*\Pictures\*` | Photos | Personal memories. Never delete without backup. |
| `*\OneDrive\*` | OneDrive | Cloud-synced files. Changes may sync. |

### Critical (Risk 5)

| Pattern | Category | Explanation |
|---------|----------|-------------|
| `C:\Windows\System32\*` | Windows system | Core Windows files. Never delete. |
| `C:\Windows\WinSxS\*` | Windows components | Shared libraries. Looks big but necessary. |
| `C:\Program Files\*` | Programs (64-bit) | Installed applications. |
| `C:\Program Files (x86)\*` | Programs (32-bit) | Installed applications. |
| `C:\ProgramData\*` | Program data | Application data. Usually needed. |
| `C:\Recovery\*` | Recovery partition | Windows recovery files. |
| `C:\System Volume Information\*` | System restore | Restore points. Manage via System Properties. |

---

## AI Integration

### When to Use

- User clicks "Ask AI" on an item the rules don't recognise
- Only for `AppData\Local\*` or other ambiguous paths

### Anonymisation

```
Original: C:\Users\Mark\AppData\Local\SomeApp\DataCollection\logs
Becomes:  C:\Users\[USER]\AppData\Local\[APP]\DataCollection\logs
```

Preserved: folder structure, file extensions, sizes, dates
Removed: username, app name (unless recognised)

### Prompt Template

```
I'm helping a non-technical user understand what's using space on their Windows computer.

Path: C:\Users\[USER]\AppData\Local\[APP]\DataCollection\
Size: 2.3 GB
Files: 847 (.log 94%, .json 5%, .txt 1%)
Date range: March 2024 to February 2026

In 2-3 sentences for a non-technical user:
1. What type of data is this likely to be?
2. Is it safe to delete? (Risk 1-5, where 1=safe, 5=critical)
3. What should they do?
```

---

## User Interface

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  DiskSage                                                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Drop WizTree CSV here or click to browse]                     │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  C: Drive — 229 GB used of 235 GB          ████████████████░░░  │
│  Potential savings: 47 GB                                        │
├──────────────────────────────────────────────────────────────────┤
│  Sort: [Size ▼]  Filter: [All ▼]                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ● Windows Installer Patches              30.0 GB    [>]  │   │
│  │   Probably safe — Use PatchCleaner tool                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ● Chrome Browser Cache                    2.3 GB    [>]  │   │
│  │   Safe to delete — Rebuilds automatically                │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ● HP Driver Installers                    3.7 GB    [>]  │   │
│  │   Probably safe — Keep if you might reinstall drivers    │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ● Unknown: Power Automate Data            2.1 GB    [>]  │   │
│  │   Needs review — [Ask AI]                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Expanded Detail Panel

```
┌──────────────────────────────────────────────────────────────────┐
│ Windows Installer Patches                                 30 GB  │
│ C:\Windows\Installer\                                            │
│ ─────────────────────────────────────────────────────────────── │
│ Risk: Low ●●○○○                                                  │
│ Recommendation: Probably safe to delete                          │
│                                                                  │
│ WHAT IS THIS?                                                    │
│ When Windows and programs update, they save old update files    │
│ here in case you need to uninstall. Over time this grows large  │
│ with outdated patches that are no longer needed.                │
│                                                                  │
│ Your folder: 1,133 files, mostly .msp files from 2017-2026      │
│                                                                  │
│ IF YOU DELETE THIS:                                              │
│ • You may not be able to uninstall old Windows updates          │
│ • Installed programs will keep working                          │
│ • Windows Update will keep working                              │
│                                                                  │
│ HOW TO CLEAN SAFELY:                                             │
│ Don't delete directly. Download "PatchCleaner" (free) and run   │
│ as Administrator. It finds orphaned patches safe to remove.     │
│ Expected savings: 20-25 GB                                       │
│                                                                  │
│ [Open in Explorer]  [Copy Path]                                  │
└──────────────────────────────────────────────────────────────────┘
```

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
│       ├── analyzer.ts      # Rule engine
│       ├── rules.ts         # Rule definitions
│       └── claude.ts        # Claude API adapter
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── ImportPanel.tsx
│   │   ├── DriveSummary.tsx
│   │   ├── RecommendationList.tsx
│   │   ├── RecommendationCard.tsx
│   │   ├── DetailPanel.tsx
│   │   └── RiskBadge.tsx
│   ├── hooks/
│   │   └── useAnalysis.ts
│   ├── types.ts
│   └── styles.css
│
└── assets/
    └── icon.png
```

---

## Implementation Phases

### Phase 1: Scaffolding (~30 min)
- [ ] Create Electron + Vite + React project
- [ ] Configure TypeScript and Tailwind
- [ ] Basic window with import panel

### Phase 2: Parser + Rules (~1 hour)
- [ ] WizTree CSV parser
- [ ] Rule definitions (30 patterns)
- [ ] Analysis engine with risk scoring

### Phase 3: UI (~1 hour)
- [ ] Drive summary bar
- [ ] Recommendation list with sorting
- [ ] Expandable detail cards
- [ ] Risk badges with colours

### Phase 4: AI Integration (~30 min)
- [ ] Path anonymiser
- [ ] Claude API call
- [ ] "Ask AI" button on unknown items

### Phase 5: Polish (~30 min)
- [ ] Error handling
- [ ] Loading states
- [ ] Open in Explorer button
- [ ] Brief intro text

---

## Explanations Content

Each rule needs:
- **What it is** — plain English, no jargon
- **If you delete** — specific consequences
- **How to clean** — step-by-step if needed

### Tone
- Friendly but not patronising
- Specific and actionable
- Acknowledge uncertainty when present

---

## Success Criteria

1. **Works on my disk** — Correctly analyses my WizTree export
2. **Identifies wins** — Shows 30+ GB of potential savings
3. **Feels safe** — Clear explanations build confidence to act
4. **No false positives** — Doesn't recommend deleting critical files

---

## Future (v2+)

- Multiple AI providers (OpenAI, Ollama)
- Settings UI for API keys
- Export recommendations as report
- Onboarding wizard
- Direct disk scan without WizTree
- Multi-drive support
- Trend tracking over time
