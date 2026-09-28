import { getToday, monthKey, nowIso } from "./date";
import { generateId } from "./id";
import { CATEGORY_ORDER, calculateAllocation } from "./plan";
import { RECORDS_KEY, loadPlan, loadRecords } from "./storage";
import type { CategoryKey, MonthRecord, RecordStore, SaveResult } from "./types";

const MAX_RECORD_MONTHS = 24;

/**
 * 월별 기록에서 특정 카테고리의 체크 상태를 토글한다.
 * 계획이 없으면 NO_PLAN 에러, 저장 실패(용량 초과)는 QUOTA 에러.
 * 이미 같은 값이면 멱등하게 쓰지 않고 ok를 반환한다. 어떤 경우에도 던지지 않는다.
 */
export function toggleRecordItem(key: CategoryKey, value: boolean): SaveResult {
  try {
    const plan = loadPlan();
    if (!plan) return { ok: false, error: "NO_PLAN" };

    const month = monthKey(getToday());
    const store = loadRecords();
    const existing: MonthRecord | undefined = store.records[month];
    if ((existing ? existing.checked[key] : false) === value) return { ok: true };

    const now = nowIso();
    const { fixedTotal, available, amounts } = calculateAllocation(plan.salary, plan.fixedCosts, plan.ratios);
    const eligible = CATEGORY_ORDER.filter((k) => amounts[k] > 0);
    const checked: MonthRecord["checked"] = existing
      ? { ...existing.checked, [key]: value }
      : { living: false, saving: false, emergency: false, leisure: false, [key]: value };
    const checkedCount = eligible.filter((k) => checked[k]).length;
    const rate = eligible.length === 0 ? 0 : Math.round((checkedCount / eligible.length) * 100);

    const record: MonthRecord = {
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

    const records: RecordStore["records"] = { ...store.records, [month]: record };
    const months = Object.keys(records).sort();
    for (const old of months.slice(0, Math.max(0, months.length - MAX_RECORD_MONTHS))) delete records[old];

    const next: RecordStore = { version: 1, records };
    localStorage.setItem(RECORDS_KEY, JSON.stringify(next));
    return { ok: true };
  } catch {
    return { ok: false, error: "QUOTA" };
  }
}
