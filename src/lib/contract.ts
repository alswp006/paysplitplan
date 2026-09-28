/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

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
