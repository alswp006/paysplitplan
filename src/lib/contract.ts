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
