# PaySplitPlan

앱인토스 (Vite + React + TDS) 월급날 통장 쪼개기, 월급 300만원이면 어디에 얼마씩? 내 비율로 계획 짜고 지켰는지 체크 통장 쪼개기를 하고 싶지만 비율을 어떻게 잡을지 모르고, 엑셀로 짜면 한두 달 뒤에 흐지부지된다.

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/History` | History |
| `/Home` | Home |
| `/Ratio` | Ratio |
| `/Result` | Result |
| `/Setup` | Setup |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-09-22
