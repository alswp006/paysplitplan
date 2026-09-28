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

export type CategoryKey = "living" | "saving" | "emergency" | "leisure";

// CATEGORY_ORDER 순서(생활비·저축·비상금·여가)의 비율 4개, 합계 100
export type Ratios = [number, number, number, number];

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

// ── Insights (저장하지 않는 파생 값) ──

export interface BracketScenario {
  salary: number;
  saving: number;
  annualSaving: number;
  isCurrent: boolean;
}

export interface TrendSummary {
  points: { month: string; rate: number | null }[];
  average: number | null;
  streak: number;
  hasEnoughTrend: boolean;
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
    home/
    plan/
    result/
  hooks/
  lib/
    __tests__/
    analytics.ts
    contract.ts
    date.ts
    dday.ts
    fixedCostForm.ts
    format.ts
    homeView.ts
    id.ts
    insights.ts
    plan.ts
    planForm.ts
    ratioForm.ts
    recordToggle.ts
    review.ts
    share.ts
    storage.ts
    types.ts
    utils.ts
    validate.ts
  main.tsx
  pages/
    History.tsx
    Home.tsx
    NotFound.tsx
    Plan.tsx
    Result.tsx
    __TdsGallery.tsx
    __tests__/
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
- dday.ts: export interface NextPayday; export function getNextPayday(today: Date, payday: number): NextPayday; export function calculateDday(targetDate: string): number
- fixedCostForm.ts: export const FIXED_COST_NAME_MAX = 20; export const FIXED_COST_AMOUNT_MAX = 100_000_000; export interface FixedCostInputResult; export function validateFixedCostInput(rawName: string, rawAmount: string): FixedCostInputResult
- format.ts: export function formatWon(n: number): string; export function formatManwon(n: number): string; export function parseAmountInput(raw: string): ParsedAmount; export function formatMonthLabel(month: string): string; export function formatAmount( amountKrw: number, opts?:
- homeView.ts: export interface ChecklistRow; export interface ChecklistView; export function buildChecklist(plan: SalaryPlan, store: RecordStore, today: Date): ChecklistView; export function isCompletionTransition(prevPercent: number, nextPercent: number): boolean; export function calculateChecklistStatus( plan: SalaryPlan, records: MonthRecord[], ):
- id.ts: export function createId(): string; export function generateId(prefix?: string): string
- insights.ts: export function getBracketScenarios( plan: Pick<PlanDraft, "salary" | "fixedCosts" | "ratios">, ): BracketScenario[]; export function getTrend(today: Date, store: RecordStore): TrendSummary; export const calculateInsights: calculateInsightsFn = (plan: SalaryPlan, records: MonthRecord[], monthCount = TREND_MONT
- plan.ts: export const CATEGORY_LABEL: Record<CategoryKey, string> =; export const CATEGORY_ORDER: CategoryKey[] = ["living", "saving", "emergency", "leisure"]; export const PRESETS: Record<"p532" | "p442" | "p622", Preset> =; export interface AllocationResult; export function calculateAllocation( salary: number, fixedCosts: Pick<FixedCost, "amount">[], ratios: Ratios, ): Allocat; export function resolvePresetId(ratios: Ratios): string; export function isSamePlan(a: PlanDraft, b: PlanDraft): boolean; export function calculateDistribution( monthlyIncome: number, fixedCosts: number, ratios:
- planForm.ts: export const SALARY_MAX = 100_000_000; export const FIXED_COST_LIMIT = 10; export const SALARY_EMPTY_ERROR = "월급을 입력해주세요"; export const PAYDAY_HELP = "매달 25일처럼 날짜만 입력해요"; export interface SalaryResult; export function sumFixedCosts(costs: Pick<FixedCost, "amount">[]): number; export function validateSalaryInput(raw: string, fixedTotal: number): SalaryResult; export interface PaydayResult
- ratioForm.ts: export const RATIO_STEP = 5; export function sumRatios(ratios: Ratios): number; export function stepRatio(value: number, delta: number): number; export function getRatioRowText(key: CategoryKey, ratios: Ratios, available...
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 엔티티 타입, RouteState 계약, 테스트 환경 (files: src/lib/types.ts, package.json, vitest.config.ts, src/test/setup.ts)
- 0002: 공용 유틸: 날짜, ID, 금액 포맷 (files: src/lib/date.ts, src/lib/id.ts, src/lib/format.ts, src/lib/__tests__/format.test.ts)
- 0003: 계측·공유·D-day 유틸 (files: src/lib/analytics.ts, src/lib/share.ts, src/lib/dday.ts, src/lib/__tests__/dday.test.ts)
- 0004: 도메인 상수 + 배분 계산 (plan.ts) (files: src/lib/plan.ts, src/lib/__tests__/plan.test.ts)
- 0005: 검증 + 레거시 정규화 (validate.ts) (files: src/lib/validate.ts, src/lib/__tests__/validate.test.ts)
- 0006: localStorage 저장소: 계획, 기록 읽기, 리뷰 1회 (files: src/lib/storage.ts, src/lib/review.ts, src/lib/__tests__/storage.test.ts, src/lib/__tests__/review.test.ts)
- 0007: 기록 토글 (toggleRecordItem) (files: src/lib/recordToggle.ts, src/lib/__tests__/recordToggle.test.ts)
- 0008: 비율 블록 컴포넌트 (RatioBlock) (files: src/lib/ratioForm.ts, src/components/plan/RatioBlock.tsx, src/components/plan/__tests__/RatioBlock.test.tsx)
- 0009: 고정비 추가 BottomSheet (FixedCostSheet) (files: src/lib/fixedCostForm.ts, src/components/plan/FixedCostSheet.tsx, src/components/plan/__tests__/FixedCostSheet.test.tsx)
- 0011: 결과 잠금 층: 소득 구간 비교 + 6개월 추이 (files: src/lib/insights.ts, src/components/result/LockedTierSection.tsx, src/lib/__tests__/insights.test.ts, src/components/result/__tests__/LockedTierSection.test.tsx)
- 0012: 결과 저장 버튼 + 덮어쓰기 확인 (ResultSaveFooter) (files: src/components/result/ResultSaveFooter.tsx, src/components/result/__tests__/ResultSaveFooter.test.tsx)
- 0014: 홈 이체 체크리스트 카드 (ChecklistCard) (files: src/lib/homeView.ts, src/components/home/ChecklistCard.tsx, src/lib/__tests__/homeView.test.ts, src/components/home/__tests__/ChecklistCard.test.tsx)
- 0010: 계획 짜기 화면 (/plan) (files: src/lib/planForm.ts, src/pages/Plan.tsx, src/pages/__tests__/Plan.test.tsx)
- 0015: 홈 화면 (/) (files: src/pages/Home.tsx, src/pages/__tests__/Home.test.tsx)
- 0016: 404 화면 (*) (files: src/pages/NotFound.tsx, src/pages/__tests__/NotFound.test.tsx)
- 0017: 이행 기록 화면 (/history) (files: src/pages/History.tsx, src/pages/__tests__/History.test.tsx)
- 0018: 라우팅 연결 (App.tsx 단일 소유) (files: src/App.tsx, src/__tests__/routes.test.tsx)

## Available exports from existing files
// src/App.tsx
export default function App() {

// src/components/AdSlot.tsx
export function AdSlot({ adGroupId, className, variant, theme }: AdSlotProps) {

// src/components/Amount.tsx
export function Amount({

// src/components/BottomCTA.tsx
export function SubmitFooter({
export function ButtonStack({

// src/components/Card.tsx
export function Card({

// src/components/CountUp.tsx
export function CountUp({

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

// src/components/MiniBar.tsx
export function MiniBar({

// src/components/PageShell.tsx
export function PageShell({

// src/components/ScreenScaffold.tsx
export function ScreenScaffold({

// src/components/Sparkline.tsx
export function Sparkline({

// src/components/StateView.tsx
export function EmptyState({
export function LoadingState({

// src/components/SummaryHero.tsx
export function SummaryHero({

// src/components/TossPurchase.tsx
export interface TossPurchaseResult {
export function TossPurchase({

// src/components/TossRewardAd.tsx
export function TossRewardAd({

// src/components/home/ChecklistCard.tsx
export function ChecklistCard({ plan }: { plan: SalaryPlan }) {

// src/components/plan/FixedCostSheet.tsx
export function FixedCostSheet({

// src/components/plan/RatioBlock.tsx
export function RatioBlock({

// src/components/result/LockedTierSection.tsx
export function LockedTierSection({

// src/components/result/ResultSaveFooter.tsx
export function ResultSaveFooter({

// src/lib/analytics.ts
export type LogFields = Record<string, string | number | boolean | null>;
export const DWELL_MS = 3000;
export function fireAndForget(call: () => unknown): void {
export function logScreen(page: string, extra?: LogFields): void {
export function logClick(name: string, extra?: LogFields): void {
export function logImpression(name: string, extra?: LogFields): void {
export function useScreenLog(page: string): void {

// src/lib/contrac

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(4), general(14), testing(2), ui(3)

Key lessons (verify against actual code before applying):
- [general] 진입점 라우터 배선은 맨 끝에 두지 말고 기반 패킷 직후 플레이스홀더 페이지와 함께 먼저 병합하라. 화면 패킷은 그 플레이스홀더를 교체하게 해서, 언제 중단돼도 병합된 화면에 도달할 수 있게 하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 파일 생성 전 디렉토리 구조 확인 — mkdir -p로 경로 보장 (60% · 타 앱 1회 — 맹신 금지)
- [general] 화면·라우팅 등 소비자 모듈은 그것이 import하는 생산자 모듈이 병합된 뒤에만 병합하고, 순서를 지킬 수 없으면 소비자 병합과 동시에 최소 플레이스홀더를 만들어 매 병합 직후 타입체크와 빌드가 항상 통과하도록 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 전역 라우팅·탭바·Provider 배선은 개별 화면보다 먼저(초반 20% 안에) 완료하고 미구현 화면은 스텁 라우트로 연결해, 시간 예산이 소진돼도 앱이 항상 실행 가능한 상태를 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)