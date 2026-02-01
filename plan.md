# DiskSage — Implementation Plan

Smart disk cleanup advisor that combines offline analysis with AI-powered recommendations.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                      │
├─────────────────────────────────────────────────────────────┤
│  React Frontend                                              │
│  ├── Dashboard (drive overview, space breakdown)            │
│  ├── Recommendations list (sortable by risk/size/type)      │
│  ├── File browser (drill into folders)                      │
│  └── Settings (AI provider config, privacy options)         │
├─────────────────────────────────────────────────────────────┤
│  Analysis Engine (Node.js backend)                          │
│  ├── WizTree CSV parser                                     │
│  ├── Direct disk scanner (fallback)                         │
│  ├── Offline rule engine (pattern matching, known paths)    │
│  ├── Path anonymiser (hash usernames, project names)        │
│  └── AI orchestrator (batches queries, manages costs)       │
├─────────────────────────────────────────────────────────────┤
│  AI Adapters (configurable)                                 │
│  ├── Claude API                                             │
│  ├── OpenAI API                                             │
│  └── Ollama (local)                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Offline Analysis (No AI Needed)

The app will classify ~80% of files without any API calls using pattern matching:

| Category | Detection Method | Default Risk |
|----------|------------------|--------------|
| **Windows system** | Known paths (`C:\Windows\*`, `C:\$Recycle.Bin\*`) | 5 (Do not delete) |
| **Installer cache** | `.msi`, `.msp` in `Windows\Installer` | 2 (Safe with tool) |
| **Temp files** | `*\Temp\*`, `*.tmp`, `~$*` | 1 (Safe to delete) |
| **Browser cache** | Known Chrome/Firefox/Edge cache paths | 1 (Safe to delete) |
| **Package managers** | `node_modules`, `.npm`, `.nuget`, `pip-cache` | 2 (Rebuildable) |
| **IDE caches** | `.vscode`, `.idea`, `__pycache__` | 1 (Safe to delete) |
| **Logs** | `*.log`, `*\Logs\*` | 1 (Usually safe) |
| **Backups/Installers** | `*.bak`, `*.old`, `SWSETUP`, recovery partitions | 2 (Review first) |
| **Media files** | `*.mp4`, `*.mov`, `*.iso` (large files) | 3 (Move/backup) |
| **User documents** | `Documents\*`, `Desktop\*` | 4 (Backup first) |
| **Application data** | `AppData\Local\*` (unknown apps) | 3 (AI review) |

### Risk Score Scale

| Score | Meaning | Recommended Action |
|-------|---------|-------------------|
| 1 | Safe to delete | Delete immediately |
| 2 | Low risk | Delete after review |
| 3 | Medium risk | Backup before deleting, or move |
| 4 | Higher risk | Backup required before any action |
| 5 | Do not delete | System critical, leave alone |

---

## AI-Assisted Analysis

For items that don't match known patterns, we batch-query the AI with anonymised data:

### Example Query

```
Folder: C:\Users\[USER]\AppData\Local\[HASH_ABC123]\DataCollection\
Size: 2.3 GB
File count: 847
File types: .log (98%), .json (2%)
Oldest file: 2024-03-15
Newest file: 2026-02-01

Question: What is this likely to be? Risk score 1-5? Recommended action?
```

### Anonymisation Strategy

1. Replace username in paths with `[USER]`
2. Hash application/project folder names that aren't in known-apps list
3. Preserve file extensions and folder structure patterns
4. Include size, file counts, and date ranges (non-identifying)

---

## Output Categories

Each analysed item receives:

| Field | Description |
|-------|-------------|
| **Path** | Full path to file/folder |
| **Size** | Size in bytes (formatted for display) |
| **Category** | e.g., "Browser Cache", "Windows Installer", "Unknown App Data" |
| **Risk Score** | 1-5 scale |
| **Recommended Action** | Delete / Review / Backup / Move / Keep |
| **Reasoning** | Brief explanation (from rules or AI) |
| **Source** | "Offline" or "AI" — indicates how classification was determined |

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
│   ├── preload.ts                 # Secure bridge to renderer
│   └── services/
│       ├── disk-scanner.ts        # Direct disk scanning (fallback)
│       ├── wiztree-parser.ts      # WizTree CSV import
│       ├── analyzer.ts            # Offline rule engine
│       ├── anonymizer.ts          # Path sanitisation
│       ├── ai-orchestrator.ts     # Batches AI queries, manages costs
│       └── ai-adapters/
│           ├── types.ts           # Common interface
│           ├── claude.ts          # Anthropic Claude adapter
│           ├── openai.ts          # OpenAI GPT adapter
│           └── ollama.ts          # Local Ollama adapter
│
├── src/                           # React frontend
│   ├── main.tsx                   # Entry point
│   ├── App.tsx                    # Root component
│   ├── components/
│   │   ├── Dashboard.tsx          # Drive overview, charts
│   │   ├── RecommendationList.tsx # Sortable/filterable results
│   │   ├── RecommendationCard.tsx # Individual item display
│   │   ├── FolderTree.tsx         # Drill-down file browser
│   │   ├── ImportPanel.tsx        # WizTree CSV import UI
│   │   ├── ProgressBar.tsx        # Analysis progress
│   │   └── Settings.tsx           # AI provider configuration
│   ├── hooks/
│   │   ├── useAnalysis.ts         # Analysis state management
│   │   └── useSettings.ts         # Persistent settings
│   ├── types/
│   │   └── index.ts               # Shared TypeScript types
│   └── styles/
│       └── globals.css            # Tailwind imports
│
├── rules/
│   ├── known-paths.json           # Path patterns for offline classification
│   ├── known-apps.json            # Application names (don't anonymise)
│   └── file-extensions.json       # Extension-based classification
│
└── assets/
    └── icon.png                   # App icon
```

---

## Implementation Phases

### Phase 1: Project Setup
- [ ] Initialise Electron + Vite + React project
- [ ] Configure TypeScript, Tailwind CSS
- [ ] Set up electron-builder for packaging
- [ ] Create basic window with dev tools

### Phase 2: Data Import
- [ ] Build WizTree CSV parser
- [ ] Validate and normalise imported data
- [ ] Create data model for file entries
- [ ] Build import UI with drag-and-drop

### Phase 3: Offline Analysis Engine
- [ ] Create rule definitions (known-paths.json)
- [ ] Build pattern matching engine
- [ ] Implement risk scoring algorithm
- [ ] Generate recommendations from rules

### Phase 4: AI Integration
- [ ] Define AI adapter interface
- [ ] Implement path anonymiser
- [ ] Build Claude API adapter
- [ ] Build OpenAI API adapter
- [ ] Build Ollama adapter
- [ ] Create AI orchestrator (batching, cost management)

### Phase 5: Frontend UI
- [ ] Dashboard with drive overview
- [ ] Recommendation list with sorting/filtering
- [ ] Folder tree browser
- [ ] Settings panel for AI configuration

### Phase 6: Polish & Packaging
- [ ] Error handling and edge cases
- [ ] Loading states and progress indicators
- [ ] Package as Windows executable
- [ ] Create installer

---

## Key Files Detail

### known-paths.json

```json
{
  "patterns": [
    {
      "pattern": "C:\\\\Windows\\\\Temp\\\\.*",
      "category": "Windows Temp",
      "risk": 1,
      "action": "delete",
      "reasoning": "Windows temporary files, safe to delete"
    },
    {
      "pattern": "C:\\\\Windows\\\\Installer\\\\.*\\.msp$",
      "category": "Windows Installer Patches",
      "risk": 2,
      "action": "delete",
      "reasoning": "Old installer patches. Use PatchCleaner for safe removal"
    },
    {
      "pattern": "C:\\\\Users\\\\[^\\\\]+\\\\AppData\\\\Local\\\\Google\\\\Chrome\\\\User Data\\\\.*\\\\Cache.*",
      "category": "Chrome Cache",
      "risk": 1,
      "action": "delete",
      "reasoning": "Browser cache, will be rebuilt automatically"
    }
  ]
}
```

### AI Adapter Interface

```typescript
interface AIAdapter {
  name: string;
  isConfigured(): boolean;
  analyze(items: AnonymisedItem[]): Promise<AIRecommendation[]>;
}

interface AnonymisedItem {
  id: string;
  anonymisedPath: string;
  size: number;
  fileCount: number;
  fileTypes: Record<string, number>;  // extension -> count
  oldestFile: Date;
  newestFile: Date;
}

interface AIRecommendation {
  id: string;
  category: string;
  risk: number;
  action: 'delete' | 'review' | 'backup' | 'move' | 'keep';
  reasoning: string;
}
```

---

## Cost Management

To minimise AI API costs:

1. **Batch queries:** Send multiple items per API call (up to token limit)
2. **Cache responses:** Same anonymised patterns get same recommendations
3. **Progressive disclosure:** Only query AI for items user expands/clicks
4. **Size threshold:** Only AI-analyse items above configurable size (default 100MB)
5. **Show estimates:** Display estimated API cost before running AI analysis

---

## Future Enhancements (v2+)

- [ ] Action execution (delete, move with confirmation)
- [ ] Analysis history and trend tracking
- [ ] Scheduled scans
- [ ] Export recommendations as report
- [ ] Direct disk scan without WizTree
- [ ] Multi-drive support
- [ ] Cloud storage analysis (OneDrive, Google Drive)

---

## Dependencies

### Production
- electron
- react
- react-dom
- @anthropic-ai/sdk (Claude)
- openai (OpenAI)
- recharts (charts)
- lucide-react (icons)
- zustand (state management)

### Development
- typescript
- vite
- electron-builder
- tailwindcss
- @types/react
- @types/node
