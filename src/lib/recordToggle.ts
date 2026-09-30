import { getToday, monthKey, nowIso } from "./date";
import { generateId } from "./id";
import { CATEGORY_ORDER, calculateAllocation } from "./plan";
import { loadPlan, loadRecords, writeMonthRecord } from "./storage";
import type { CategoryKey, MonthRecord, SalaryPlan, SaveResult } from "./types";

/**
 * 현재 계획 기준으로 그 달 기록을 조립한다. checked는 넘겨받은 값을 그대로 쓰고,
 * eligible·rate·snapshot·planId는 계획으로 다시 계산한다. id·createdAt은 기존 기록이 있으면 유지한다.
 */
function buildMonthRecord(
  plan: SalaryPlan,
  month: string,
  checked: MonthRecord["checked"],
  existing: MonthRecord | undefined,
  now: string,
): MonthRecord {
  const { fixedTotal, available, amounts } = calculateAllocation(plan.salary, plan.fixedCosts, plan.ratios);
  const eligible = CATEGORY_ORDER.filter((k) => amounts[k] > 0);
  const checkedCount = eligible.filter((k) => checked[k]).length;
  const rate = eligible.length === 0 ? 0 : Math.round((checkedCount / eligible.length) * 100);
  return {
    id: existing ? existing.id : generateId("rec"),
    planId: plan.id,
    month,
    checked,
    eligible,
    rate,
    completedAt: rate === 100 ? (existing?.completedAt ?? now) : null,
    snapshot: { salary: plan.salary, fixedTotal, available, ratios: plan.ratios, amounts },
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
}

/**
 * 월별 기록에서 특정 카테고리의 체크 상태를 토글한다.
 * 계획이 없으면 NO_PLAN 에러, 저장 실패(용량 초과)는 QUOTA 에러.
 * 이미 같은 값이면 멱등하게 쓰지 않고 ok를 반환한다. 어떤 경우에도 던지지 않는다.
 * 저장은 storage.writeMonthRecord 하나로 한다(다른 달 원문 보존·24개월 정리·백업은 거기서).
 */
export function toggleRecordItem(key: CategoryKey, value: boolean): SaveResult {
  try {
    const plan = loadPlan();
    if (!plan) return { ok: false, error: "NO_PLAN" };

    const month = monthKey(getToday());
    const store = loadRecords();
    const existing: MonthRecord | undefined = store.records[month];
    if ((existing ? existing.checked[key] : false) === value) return { ok: true };

    const checked: MonthRecord["checked"] = existing
      ? { ...existing.checked, [key]: value }
      : { living: false, saving: false, emergency: false, leisure: false, [key]: value };

    return writeMonthRecord(buildMonthRecord(plan, month, checked, existing, nowIso()));
  } catch {
    return { ok: false, error: "QUOTA" };
  }
}

/**
 * 계획을 바꿔 저장한 직후, **이번 달** 기록을 새 계획에 맞춘다.
 * 체크 상태(checked)는 보존하고 planId·eligible·rate·snapshot·updatedAt을 다시 계산한다.
 * completedAt은 rate가 100이면 기존 값(없으면 지금), 100 미만이면 null.
 * 이번 달의 유효한 기록이 없으면 아무것도 쓰지 않고 ok. 던지지 않는다.
 */
export function resyncCurrentMonth(plan: SalaryPlan, today: Date = getToday()): SaveResult {
  try {
    const month = monthKey(today);
    const existing = loadRecords().records[month];
    if (!existing) return { ok: true };
    return writeMonthRecord(buildMonthRecord(plan, month, { ...existing.checked }, existing, nowIso()));
  } catch {
    return { ok: false, error: "QUOTA" };
  }
}
