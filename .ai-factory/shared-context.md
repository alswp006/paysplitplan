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
export {};

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
    analytics.ts
    review.ts
    share.ts
    storage.ts
    types.ts
    utils.ts
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
- review.ts: export function requestReviewOnce(key: string = REVIEW_REQUESTED_KEY): void
- share.ts: export interface ShareAppOptions; export async function shareApp(opts: ShareAppOptions): Promise<void>
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
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
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

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

// src/lib/analytics.ts
export type LogFields = Record<string, string | number | boolean | null>;
export const DWELL_MS = 3000;
export function fireAndForget(call: () => unknown): void {
export function logScreen(page: string, extra?: LogFields): void {
export function logClick(name: string, extra?: LogFields): void {
export function logImpression(name: string, extra?: LogFields): void {
export function useScreenLog(page: string): void {

// src/lib/contract.ts
export type Plan = { id: string; salary: number; fixedCosts: Array<{ id: string; name: string; amountKrw: number }>; ratios: { food: number; transport: number; culture: number; savings: number; other: number } };
export type MonthRecord = { yearMonth: string; checked: Array<{ name: string; completed: boolean }>; totalExecuted: number };
export type RouteState = { isSetupDone: boolean; isRatioDone: boolean; i

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(4), general(13), testing(2), ui(3)

Key lessons (verify against actual code before applying):
- [general] 파일 생성 전 디렉토리 구조 확인 — mkdir -p로 경로 보장 (60% · 타 앱 1회 — 맹신 금지)
- [general] 화면·라우팅 등 소비자 모듈은 그것이 import하는 생산자 모듈이 병합된 뒤에만 병합하고, 순서를 지킬 수 없으면 소비자 병합과 동시에 최소 플레이스홀더를 만들어 매 병합 직후 타입체크와 빌드가 항상 통과하도록 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 전역 라우팅·탭바·Provider 배선은 개별 화면보다 먼저(초반 20% 안에) 완료하고 미구현 화면은 스텁 라우트로 연결해, 시간 예산이 소진돼도 앱이 항상 실행 가능한 상태를 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)