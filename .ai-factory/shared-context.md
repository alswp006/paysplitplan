# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

import type { SalaryPlan as Plan, MonthRecord as Record, ReviewPromptState as Review } from "./types";

/** (구현: 패킷 0001) */
export type RouteState = { current: 'home' | 'plan' | 'result' | 'history' | 'notfound'; planId?: string; recordDate?: string };

/** (구현: 패킷 0002) */
export type formatAmountFn = (amountKrw: number, opts?: { symbol?: boolean; decimals?: number }) => string;

/** (구현: 패킷 0002) */
export type formatDateFn = (date: string | Date, format?: 'YYYY-MM-DD' | 'M/D' | 'MMM D') => string;

/** (구현: 패킷 0002) */
export type generateIdFn = (prefix?: string) => string;

/** (구현: 패킷 0003) */
export type calculateDdayFn = (targetDate: string) => number;

/** (구현: 패킷 0004) */
export type calculateDistributionFn = (monthlyIncome: number, fixedCosts: number, ratios: { categoryId: string; percent: number }[]) => { categoryId: string; allocated: number }[];

/** (구현: 패킷 0005) */
export type validatePlanFn = (plan: unknown) => { valid: boolean; errors: string[] };

/** (구현: 패킷 0006) */
export type loadPlanFn = (planId: string) => Plan | null;

/** (구현: 패킷 0006) */
export type savePlanFn = (plan: Plan) => void;

/** (구현: 패킷 0006) */
export type loadRecordsFn = (planId: string, dateRange?: { start: string; end: string }) => Record[];

/** (구현: 패킷 0006) */
export type saveRecordFn = (record: Record) => void;

/** (구현: 패킷 0006) */
export type loadReviewFn = (planId: string) => Review | null;

/** (구현: 패킷 0006) */
export type saveReviewFn = (review: Review) => void;

/** (구현: 패킷 0007) */
export type toggleRecordItemFn = (records: Record[], recordId: string, toggleKey: 'status' | 'verified') => Record[];

/** (구현: 패킷 0011) */
export type calculateInsightsFn = (plan: Plan, records: Record[], monthCount?: number) => { tierComparison: { planned: number; actual: number }[]; trend6m: { month: string; rate: number }[] };

/** (구현: 패킷 0014) */
export type calculateChecklistStatusFn = (plan: Plan, records: Record[]) => { completed: number; total: number; items: { id: string; label: string; done: boolean }[] };

/** 홈 화면에서 과거 계획 목록 표시용 (구현: 패킷 0006) */
export type listPlansFn = () => { id: string; name: string; createdAt: string }[];

```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
// Domain entity types — type-only file (no runtime code)

// ── Core domain types ──

export type CategoryKey = "savings" | "expense" | "fun";

export type Ratios = globalThis.Record<CategoryKey, number>;

export type PresetId = string;

export interface Preset {
  id: PresetId;
  name: string;
  ratios: Ratios;
}

export interface FixedCost {
  id: string;
  name: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryPlan {
  version: 1;
  id: string;
  salary: number;
  fixedCosts: FixedCost[];
  presetId: PresetId;
  ratios: Ratios;
  payday: number;
  createdAt: string;
  updatedAt: string;
}

export type PlanDraft = Omit<SalaryPlan, "version" | "id" | "createdAt" | "updatedAt">;

export interface MonthRecord {
  id: string;
  planId: string | null;
  month: string; // ISO month like "2026-09"
  checked: globalThis.Record<CategoryKey, boolean>;
  eligible: CategoryKey[];
  rate: number;
  completedAt: string | null;
  snapshot: {
    salary: number;
    fixedTotal: number;
    available: number;
    ratios: Ratios;
    amounts: globalThis.Record<CategoryKey, number>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface RecordStore {
  version: 1;
  records: globalThis.Record<string, MonthRecord>;
}

export interface ReviewPromptState {
  version: 1;
  id: "review-prompt";
  createdAt: string;
  updatedAt: string;
}

// ── Allocation and other domain types ──

export interface Allocation {
  categoryKey: CategoryKey;
  amount: number;
  percentage: number;
}

// parseAmountInput 결과 (SPEC P-2a) — ok일 때만 value가 있다
export type ParsedAmount =
  | { kind: "empty"; value?: undefined }
  | { kind: "ok"; value: number } // 0 이상 정수
  | { kind: "negative"; value?: undefined }
  | { kind: "decimal"; value?: undefined }
  | { kind: "invalid"; value?: undefined };

// ── Result and route state types ──

export type SaveResult = { ok: true } | { ok: false; error: "QUOTA" | "NO_PLAN" };

export interface RouteState {
  draft: PlanDraft;
}

```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    __tests__/
    analytics.ts
    contract.ts
    date.ts
    format.ts
    id.ts
    review.ts
    share.ts
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    History.tsx
    Home.tsx
    NotFound.tsx
    Plan.tsx
    Result.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  test/
    setup.ts
  types/
  vite-env.d.ts

### Exports (src/lib/)
- analytics.ts: export type LogFields = Record<string, string | number | boolean | null>; export const DWELL_MS = 3000; export function fireAndForget(call: () => unknown): void; export function logScreen(page: string, extra?: LogFields): void; export function logClick(name: string, extra?: LogFields): void; export function logImpression(name: string, extra?: LogFields): void; export function useScreenLog(page: string): void
- contract.ts: export type RouteState =; export type formatAmountFn = (amountKrw: number, opts?:; export type formatDateFn = (date: string | Date, format?: 'YYYY-MM-DD' | 'M/D' | 'MMM D') => string; export type generateIdFn = (prefix?: string) => string; export type calculateDdayFn = (targetDate: string) => number; export type calculateDistributionFn = (monthlyIncome: number, fixedCosts: number, ratios:; export type validatePlanFn = (plan: unknown) =>; export type loadPlanFn = (planId: string) => Plan | null
- date.ts: export function getToday(): Date; export function nowIso(): string; export function isIsoTimestamp(x: unknown): x is string; export function monthKey(d: Date): string; export function shiftMonth(month: string, n: number): string; export type DateFormat = "YYYY-MM-DD" | "M/D" | "MMM D"; export function formatDate(date: string | Date, format: DateFormat = "YYYY-MM-DD"): string
- format.ts: export function formatWon(n: number): string; export function formatManwon(n: number): string; export function parseAmountInput(raw: string): ParsedAmount; export function formatMonthLabel(month: string): string; export function formatAmount( amountKrw: number, opts?:
- id.ts: export function createId(): string; export function generateId(prefix?: string): string
- review.ts: export function requestReviewOnce(key: string = REVIEW_REQUESTED_KEY): void
- share.ts: export interface ShareAppOptions; export async function shareApp(opts: ShareAppOptions): Promise<void>
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- types.ts: export type CategoryKey = "savings" | "expense" | "fun"; export type Ratios = globalThis.Record<CategoryKey, number>; export type PresetId = string; export interface Preset; export interface FixedCost; export interface SalaryPlan; export type PlanDraft = Omit<SalaryPlan, "version" | "id" | "createdAt" | "updatedAt">; export interface MonthRecord
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd

### Module Dependencies (import graph)
  lib/format.ts → imports: lib/types
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 엔티티 타입, RouteState 계약, 테스트 환경 (files: src/lib/types.ts, package.json, vitest.config.ts, src/test/setup.ts)
- 0002: 공용 유틸: 날짜, ID, 금액 포맷 (files: src/lib/date.ts, src/lib/id.ts, src/lib/format.ts, src/lib/__tests__/format.test.ts)