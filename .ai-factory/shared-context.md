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
 *
 * @deprecated 이 파일은 아무 곳에서도 import되지 않는다. `Plan`/`MonthRecord` 등의
 * 실제 정의는 `.ai-factory/spec.md`와 `src/lib/types.ts`가 확정본이며, 이 파일의
 * 필드명(amountKrw, ratios.food 등)은 그것과 어긋난다 — 이 파일이 아니라 `src/lib/types.ts`를
 * import하라.
 */

/** (구현: 패킷 0001) */
export type Plan = { id: string; salary: number; fixedCosts: Array<{ id: string; name: string; amountKrw: number }>; ratios: { food: number; transport: number; culture: number; savings: number; other: number } };

/** (구현: 패킷 0006) */
export type MonthRecord = { yearMonth: string; checked: Array<{ name: string; completed: boolean }>; totalExecuted: number };

/** (구현: 패킷 0001) */
export type RouteState = { isSetupDone: boolean; isRatioDone: boolean; isPremium?: boolean };

/** (구현: 패킷 0003) */
export type SaveResult = { success: boolean; error?: string };

/** (구현: 패킷 0002) */
export type formatKrwFn = (amount: number, opts?: { decimals?: number }) => string;

/** (구현: 패킷 0002) */
export type formatPercentFn = (value: number, decimals?: number) => string;

/** (구현: 패킷 0004) */
export type calculateAllocationFn = (salary: number, ratios: Plan['ratios']) => Record<string, number>;

/** (구현: 패킷 0004) */
export type calculateExecutionRateFn = (records: MonthRecord[], months?: number) => number;

/** (구현: 패킷 0004) */
export type calculateIncomeScenariosFn = (baseSalary: number, fixedCosts: Plan['fixedCosts'], ratios: Plan['ratios']) => Array<{ scenarioName: string; allocation: Record<string, number> }>;

/** (구현: 패킷 0005) */
export type getDdayStringFn = (targetDate: string) => string;

/** (구현: 패킷 0006) */
export type fillEmptyMonthsFn = (records: MonthRecord[], targetMonths: number) => MonthRecord[];

/** (구현: 패킷 0006) */
export type toggleCheckItemFn = (record: MonthRecord, itemName: string) => MonthRecord;

/** (구현: 패킷 0006) */
export type getRecentMonthRecordsFn = (records: MonthRecord[], count: number) => MonthRecord[];

/** (구현: 패킷 0007) */
export type validateSetupInputFn = (salary: number, fixedCosts: Plan['fixedCosts']) => { valid: boolean; error?: string };

/** (구현: 패킷 0008) */
export type usePlanStoreFn = () => { plan: Plan | null; records: MonthRecord[]; setPlan: (plan: Plan) => void; addRecord: (record: MonthRecord) => SaveResult; updateRecord: (record: MonthRecord) => SaveResult; loadFromStorage: () => void };

/** (구현: 패킷 0003) */
export type savePlanFn = (plan: Plan) => SaveResult;

/** (구현: 패킷 0003) */
export type loadPlanFn = () => Plan | null;

/** (구현: 패킷 0003) */
export type saveMonthRecordsFn = (records: MonthRecord[]) => SaveResult;

/** (구현: 패킷 0003) */
export type loadMonthRecordsFn = () => MonthRecord[];

/** (구현: 패킷 0002) */
export type CURRENCY_CODE = 'KRW';

```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
// Domain types — add your app-specific types here

export type BucketKey = string;
export type PresetId = string;

export interface FixedCost {
  id: string;
  name: string;
  amount: number;
}

export interface Plan {
  version: 1;
  salary: number;
  fixedCosts: FixedCost[];
  payday: number;
  presetId: PresetId;
  ratios: Record<BucketKey, number>;
  createdAt: string;
  updatedAt: string;
}

export interface PlanDraft {
  salary: number;
  payday: number;
  fixedCosts: FixedCost[];
  presetId?: PresetId;
}

export interface MonthRecord {
  month: string;
  checked: BucketKey[];
  total: number;
  rate: number;
  updatedAt: string;
}

export type MonthRecordMap = Record<string, MonthRecord>;

export interface Allocation {
  fixedTotal: number;
  remaining: number;
  buckets: Record<BucketKey, number>;
}

export interface IncomeScenario {
  salary: number;
  remaining: number;
  saving: number;
  yearlySaving: number;
}

export type SaveResult =
  | { ok: true; plan?: Plan }
  | { ok: false; error?: string; reason?: "quota" | "unknown" };

export interface SetupErrors {
  salary?: string;
  payday?: string;
  fixedTotal?: string;
}

export interface RouteState {
  "/ratio": { draft: PlanDraft } | undefined;
  "/result": { justSaved: boolean } | undefined;
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
    FixedCostSheet.tsx
    FloatingTabBar.tsx
    IncomeScenarioSection.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
    TrendSection.tsx
  hooks/
    __tests__/
    usePlanStore.tsx
  lib/
    __tests__/
    analytics.ts
    calc.ts
    constants.ts
    contract.ts
    date.ts
    format.ts
    records.ts
    review.ts
    share.ts
    storage.ts
    types.ts
    utils.ts
    validation.ts
  main.tsx
  pages/
    History.tsx
    Home.tsx
    Ratio.tsx
    Result.tsx
    Setup.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- analytics.ts: export type LogFields = Record<string, string | number | boolean | null>; export const DWELL_MS = 3000; export function fireAndForget(call: () => unknown): void; export function logScreen(page: string, extra?: LogFields): void; export function logClick(name: string, extra?: LogFields): void; export function logImpression(name: string, extra?: LogFields): void; export function useScreenLog(page: string): void
- calc.ts: export function calcAllocation( salary: number, fixedTotal: number, presetId: string ): Allocation; export function calcRate(value: number, total: number): number; export function activeBuckets(buckets: Record<string, number>): string[]; export function buildIncomeScenarios( salary: number, fixedTotal: number ): IncomeScenario[]; export function sumRatios(ratios: Record<string, number>): number; export function matchPreset(ratios: Record<string, number>): string
- constants.ts: export const BUCKET_ORDER = ["living", "saving", "emergency", "leisure"] as const; export type Bucket = (typeof BUCKET_ORDER)[number]; export const BUCKET_LABEL: Record<Bucket, string> =; export const PRESETS =; export const STORAGE_KEYS =; export const LIMITS =; export const MSG =
- contract.ts: export type Plan =; export type MonthRecord =; export type RouteState =; export type SaveResult =; export type formatKrwFn = (amount: number, opts?:; export type formatPercentFn = (value: number, decimals?: number) => string; export type calculateAllocationFn = (salary: number, ratios: Plan['ratios']) => Record<string, number>; export type calculateExecutionRateFn = (records: MonthRecord[], months?: number) => number
- date.ts: export function lastDayOfMonth(year: number, month: number): number; export function getNextPayday(payday: number, today: Date = new Date()): Date; export function getDday(payday: number, today: Date = new Date()): number; export function formatDday(dday: number): string; export function getDdayString(targetDate: string, today: Date = new Date()): string; export function toMonthKey(year: number, month: number): string; export function monthRange(startKey: string, endKey: string): string[]; export function formatMonthLabel(key: string): string
- format.ts: export function formatWon(amount: number): string; export function formatKrw(amount: number, opts?:; export function formatPercent(value: number, decimals = 0): string; export function formatComma(num: number): string; export function parseDigits(str: string): number | null; export function clampRatio(ratio: number): number; export function genId(): string
- records.ts: export function ensureMonthRecords( plan: Plan, today: Date, existing: MonthRecordMap ):; export function toggleCheck(map: MonthRecordMap, monthKey: string, bucket: string): MonthRecordMap; export function recentMonths(map: MonthRecordMap, today: Date, count: number): string[]
- review.ts: export function requestReviewOnce(key: string = REVIEW_REQUESTED_KEY): void
- share.ts: export interface ShareAppOptions; export async function shareApp(opts: ShareAppOptions): Promise<void>
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void; export function loadPlan(): Plan | null; export function isPlanCorrupted(): boolean; export function savePlan(plan: Plan): SaveResult; export function loadRecords(): MonthRecordMap; export function saveRecords(records: MonthRecordMap): SaveResult
- types.ts: export type BucketKey = string; export type PresetId = string; export interface FixedCost; export interface Plan; export interface PlanDraft; export interface MonthRecord; export type MonthRecordMap = Record<string, MonthRecord>; export interface Allocation
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string
- validation.ts: export interface ValidationError; export function validateSetup(draft: PlanDraft): SetupErrors; export function valid...
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 엔티티 타입과 RouteState 계약 정의 (files: src/lib/types.ts)
- 0002: 상수와 포맷·입력 헬퍼 (files: src/lib/constants.ts, src/lib/format.ts, src/lib/__tests__/format.test.ts, vitest.config.ts, package.json)
- 0003: localStorage 저장소 (예외 없는 SaveResult) (files: src/lib/storage.ts, src/lib/__tests__/storage.test.ts)
- 0004: 배분·이행률·소득 구간 계산 함수 (files: src/lib/calc.ts, src/lib/__tests__/calc.test.ts)
- 0005: 날짜·D-day 함수 (기기 로컬 시간) (files: src/lib/date.ts, src/lib/__tests__/date.test.ts)
- 0006: 월 기록 로직 (빈 달 채우기·체크 토글·최근 N개월) (files: src/lib/records.ts, src/lib/__tests__/records.test.ts)
- 0007: setup 입력 검증 함수 (files: src/lib/validation.ts, src/lib/__tests__/validation.test.ts)
- 0009: 고정비 추가 BottomSheet 컴포넌트 (files: src/components/FixedCostSheet.tsx)
- 0012: 소득 구간 비교 섹션 (Result 잠금 층 컴포넌트) (files: src/components/IncomeScenarioSection.tsx)
- 0015: [부가] 6개월 이행 추이 섹션 (History 잠금 층 컴포넌트) (files: src/components/TrendSection.tsx)
- 0008: PlanStore Context (상태 관리 훅) (files: src/hooks/usePlanStore.tsx, src/hooks/__tests__/usePlanStore.test.tsx)