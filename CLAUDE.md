# CLAUDE.md - DiskSage

Smart disk cleanup advisor that combines offline analysis with AI-powered recommendations.

## Project Overview

DiskSage analyses disk usage (via WizTree CSV import or direct scan) and provides risk-based recommendations for cleanup, backup, or transfer. It maximises offline analysis using pattern matching and known paths, only calling AI APIs for ambiguous items.

## Tech Stack

- **Framework:** Electron + React 18
- **Language:** TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS
- **AI Providers:** Configurable (Claude, OpenAI, Ollama)

## Key Design Decisions

1. **Privacy-first:** Paths are anonymised (usernames, project names hashed) before sending to AI
2. **Offline-first:** ~80% of files classified without API calls using rule engine
3. **Single-shot analysis:** No persistent history storage
4. **Read-only:** v1 provides recommendations only — user acts manually

## Build Commands

```bash
npm install          # Install dependencies
npm run dev          # Start in development mode
npm run build        # Build for production
npm run package      # Package as Windows executable
```

## Project Structure

```
DiskSage/
├── electron/           # Main process + backend services
│   ├── main.ts
│   ├── preload.ts
│   └── services/
├── src/                # React frontend
│   ├── components/
│   └── hooks/
└── rules/              # Offline classification rules
```

## Conventions

- British English throughout
- No emojis in code or UI
- Follow existing patterns in the codebase
- Document significant decisions in this file

## Reference Documents

- [plan.md](plan.md) — Full architecture and implementation plan
