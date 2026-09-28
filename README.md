🇺🇸 [한국어](./README.ko.md)

# PaySplitPlan — Salary allocation and budgeting tracker

A mini-app that helps users plan and track how to divide their monthly salary across expense categories. Create allocation plans, set fixed costs, and view monthly records to manage your budget effectively.

## Features

- 📊 **Salary Allocation Planning** — Divide your salary by percentage ratios and fixed costs
- 📝 **Plan Management** — Create, edit, and save multiple salary plans
- 📈 **Monthly Tracking** — Record and view how actual spending aligns with your plan
- 🏠 **Home Dashboard** — Quick overview of your current plan with D-day countdown
- 📋 **History** — Browse past month records and plan snapshots
- 🎯 **Plan Templates** — Quick-start presets for common allocation patterns
- 🔔 **Haptic Feedback** — Physical feedback on key interactions
- 🌙 **Dark Mode** — Adaptive colors for day and night

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build**: Vite 6
- **Routing**: React Router DOM 7
- **UI**: Toss Design System (TDS Mobile)
- **Styling**: Emotion
- **Icons**: Lucide React
- **Platform**: App-in-Toss Web Framework (Toss mini-app SDK)
- **Testing**: Vitest + Playwright
- **Storage**: Browser localStorage only (no backend)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

Type checking:
```bash
npx tsc --noEmit
```

Run tests:
```bash
npx vitest run
```

Run visual regression tests:
```bash
npm run test:visual
```

### Production Build

For static Vite build:
```bash
npm run build
```

For Toss App-in-Toss deployment:
```bash
npx ait build
```

The build artifacts will be in the `dist/` directory, ready for deployment to Toss CDN.

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `VITE_SHARE_OG_URL` | Open Graph image URL for share previews (KakaoTalk, SMS) | No |
| `VITE_TOSS_AD_SLOT_ID` | Reward/interstitial ad slot ID from Toss console | No |
| `VITE_TOSS_IAP_SKU` | In-app purchase SKU from Toss console | No |
| `VITE_TOSS_PROMOTION_CODE` | Promotion reward code from Toss console | No |

Copy `.env.example` to `.env` and fill in values from your Toss developer console. Empty values degrade gracefully — the feature is simply unavailable.

## Project Structure

```
src/
├── pages/           # Route pages (Home, Plan, Result, History)
├── components/      # Reusable TDS components (ScreenScaffold, SummaryHero, etc.)
├── lib/             # Utilities (storage, analytics, date, formatting)
├── __tests__/       # Vitest unit and integration tests
e2e/
├── visual-smoke.spec.ts   # Playwright visual regression tests
├── __shots__/             # Baseline screenshots
```

Key utility modules:
- `src/lib/storage.ts` — localStorage persistence (plans, records, review prompt state)
- `src/lib/analytics.ts` — Toss SDK analytics wrapper
- `src/lib/date.ts` — Date utilities and ISO timestamp helpers
- `src/lib/format.ts` — Currency and amount parsing
- `src/lib/plan.ts` — Plan business logic and validation

## Deployment

### Prerequisites

1. Register your app in the Toss App-in-Toss developer console
2. Obtain your `appName` (must match exactly, case-sensitive)
3. Configure environment variables in `.env`

### Deployment Steps

1. **Build**:
   ```bash
   npm run build
   ```

2. **Verify**:
   - No TypeScript errors: `npx tsc --noEmit`
   - No test failures: `npx vitest run`
   - No visual regressions: `npm run test:visual`

3. **Deploy via Toss Console**:
   - Log into Toss App-in-Toss developer console
   - Upload the `dist/` folder
   - Submit for review

The app runs as CSR (Client-Side Rendering) only — no server-side rendering. All user data is stored locally in browser storage.

## License

MIT
