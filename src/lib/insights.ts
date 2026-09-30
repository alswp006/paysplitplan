import { CATEGORY_ORDER, calculateAllocation } from "./plan";
import { getToday, monthKey, shiftMonth } from "./date";
import { SALARY_MAX } from "./planForm";
import type { calculateInsightsFn } from "./contract";
import type { BracketScenario, MonthRecord, PlanDraft, RecordStore, SalaryPlan, TrendSummary } from "./types";

const BRACKET_STEP = 500_000;
const BRACKET_OFFSETS = [-2, -1, 0, 1, 2];
const TREND_MONTHS = 6;

/**
 * 월급 −100만~+100만 원을 50만 원 단위 5구간으로 나눠 저축액을 비교한다.
 * 월급이 0 이하이거나 고정비 합 이하인 구간, 입력 상한(SALARY_MAX)을 넘는 구간,
 * 내 월급이 아닌데 저축이 0원인 구간은 뺀다(비교할 것이 없는 행).
 */
export function getBracketScenarios(
  plan: Pick<PlanDraft, "salary" | "fixedCosts" | "ratios">,
): BracketScenario[] {
  const rows: BracketScenario[] = [];
  for (const offset of BRACKET_OFFSETS) {
    const salary = plan.salary + offset * BRACKET_STEP;
    const { fixedTotal, amounts } = calculateAllocation(salary, plan.fixedCosts, plan.ratios);
    if (salary <= 0 || salary <= fixedTotal || salary > SALARY_MAX) continue;
    if (offset !== 0 && amounts.saving === 0) continue;
    rows.push({
      salary,
      saving: amounts.saving,
      annualSaving: amounts.saving * 12,
      isCurrent: offset === 0,
    });
  }
  return rows;
}

/** 오늘 기준 6개월 이행 추이. 기록 없는 달은 rate null. */
export function getTrend(today: Date, store: RecordStore): TrendSummary {
  const current = monthKey(today);
  const points = Array.from({ length: TREND_MONTHS }, (_, i) => {
    const month = shiftMonth(current, i - (TREND_MONTHS - 1));
    const record = store.records[month];
    return { month, rate: record ? record.rate : null };
  });

  const rates = points.flatMap((p) => (p.rate === null ? [] : [p.rate]));
  const average = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;

  // 이번 달이 아직 100 미만이면 지난달부터 센다(진행 중인 달이 연속 기록을 끊지 않는다).
  let cursor = current;
  if (store.records[cursor]?.rate !== 100) cursor = shiftMonth(cursor, -1);
  let streak = 0;
  while (store.records[cursor]?.rate === 100) {
    streak += 1;
    cursor = shiftMonth(cursor, -1);
  }

  return { points, average, streak, hasEnoughTrend: rates.length >= 2 };
}

/**
 * 통장별 계획 vs 실제, 최근 N개월 이행률 (contract: calculateInsightsFn).
 * - tierComparison: CATEGORY_ORDER(생활비·저축·비상금·여가) 순서. planned는 현재 계획의 월 배분액,
 *   actual은 최근 monthCount개월 중 기록이 있는 달의 "체크한 통장 배분액" 월평균(내림). 기록이 없으면 0.
 * - trend6m: 이번 달을 포함한 최근 monthCount개월(기본 6), 오래된 순. 기록 없는 달은 rate 0.
 * 같은 달 기록이 여럿이면 마지막 것을 쓴다. 예외는 던지지 않는다.
 */
export const calculateInsights: calculateInsightsFn = (plan: SalaryPlan, records: MonthRecord[], monthCount = TREND_MONTHS) => {
  const count = Number.isInteger(monthCount) && monthCount > 0 ? monthCount : TREND_MONTHS;
  const current = monthKey(getToday());
  const months = Array.from({ length: count }, (_, i) => shiftMonth(current, i - (count - 1)));

  const byMonth = new Map<string, MonthRecord>();
  for (const r of records) byMonth.set(r.month, r);
  const inWindow = months.flatMap((m) => {
    const r = byMonth.get(m);
    return r ? [r] : [];
  });

  const planned = calculateAllocation(plan.salary, plan.fixedCosts, plan.ratios).amounts;
  const tierComparison = CATEGORY_ORDER.map((key) => {
    const kept = inWindow.reduce((sum, r) => sum + (r.checked?.[key] ? (r.snapshot?.amounts?.[key] ?? 0) : 0), 0);
    return {
      planned: planned[key],
      actual: inWindow.length > 0 ? Math.floor(kept / inWindow.length) : 0,
    };
  });

  const trend6m = months.map((month) => ({ month, rate: byMonth.get(month)?.rate ?? 0 }));

  return { tierComparison, trend6m };
};
