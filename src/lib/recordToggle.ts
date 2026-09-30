import { getToday, monthKey, nowIso } from "./date";
import { generateId } from "./id";
import { CATEGORY_ORDER, calculateAllocation } from "./plan";
import { loadPlan, loadRecords, writeMonthRecord } from "./storage";
import type { CategoryKey, MonthRecord, PlanDraft, SalaryPlan, SaveResult } from "./types";

/**
 * 모이는 돈 — 체크한 금액이 쌓여 비상금 목표(goal.summarizeGoal)와 "옮긴 돈"(insights.movedTotal)이 된다.
 * 생활비·여가는 쓰는 돈이라 금액이 바뀌어도 체크를 유지한다(이행률만 다시 센다).
 */
const MOVED_KEYS: readonly CategoryKey[] = ["saving", "emergency"];

/**
 * 계획이 바뀌어 **모이는 돈 통장의 금액이 달라졌으면** 그 체크를 푼다. 체크는 "그 달 금액을 옮겼다"는 뜻인데
 * snapshot은 지금 계획의 금액으로 다시 쓰이므로, 체크를 남기면 옮기지 않은 차액(월급을 올리면 +20만 원)까지
 * 목표에 모인 돈으로 세였다. 예전 금액을 모르면(snapshot 없는 옛 기록) 체크를 그대로 둔다 — 모르는 것을 지우지 않는다.
 * `keep`은 지금 사용자가 직접 누른 통장(그 체크는 새 금액 기준의 의사 표시다).
 */
function reconcileMovedChecks(
  checked: MonthRecord["checked"],
  existing: MonthRecord | undefined,
  amounts: Record<CategoryKey, number>,
  keep?: CategoryKey,
): MonthRecord["checked"] {
  if (!existing) return checked;
  const next = { ...checked };
  for (const k of MOVED_KEYS) {
    if (k === keep || !next[k]) continue;
    const before = existing.snapshot?.amounts?.[k];
    if (typeof before === "number" && Number.isFinite(before) && before !== amounts[k]) next[k] = false;
  }
  return next;
}

/**
 * 계획을 `draft`로 바꾸면 이번 달 체크 중 풀리는 통장(모이는 돈 통장 중 금액이 바뀐 것) — 덮어쓰기 다이얼로그가
 * 저장 **전에** 미리 알린다. 읽기만 한다. 던지지 않는다.
 */
export function movedChecksToReset(
  draft: Pick<PlanDraft, "salary" | "fixedCosts" | "ratios">,
  today: Date = getToday(),
): CategoryKey[] {
  try {
    const existing = loadRecords().records[monthKey(today)];
    if (!existing) return [];
    const { amounts } = calculateAllocation(draft.salary, draft.fixedCosts, draft.ratios);
    const next = reconcileMovedChecks(existing.checked, existing, amounts);
    return MOVED_KEYS.filter((k) => existing.checked[k] && !next[k]);
  } catch {
    return [];
  }
}

/**
 * 현재 계획 기준으로 그 달 기록을 조립한다. checked는 넘겨받은 값을 쓰되 모이는 돈 통장의 금액이 바뀌었으면
 * 그 체크를 푼다(reconcileMovedChecks). eligible·rate·snapshot·planId는 계획으로 다시 계산한다.
 * id·createdAt은 기존 기록이 있으면 유지한다.
 */
function buildMonthRecord(
  plan: SalaryPlan,
  month: string,
  requested: MonthRecord["checked"],
  existing: MonthRecord | undefined,
  now: string,
  keep?: CategoryKey,
): MonthRecord {
  const { fixedTotal, available, amounts } = calculateAllocation(plan.salary, plan.fixedCosts, plan.ratios);
  const checked = reconcileMovedChecks(requested, existing, amounts, keep);
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

    return writeMonthRecord(buildMonthRecord(plan, month, checked, existing, nowIso(), key));
  } catch {
    return { ok: false, error: "QUOTA" };
  }
}

/**
 * 계획을 바꿔 저장한 직후, **이번 달** 기록을 새 계획에 맞춘다.
 * 체크 상태(checked)는 보존하되 저축·비상금은 금액이 바뀌었으면 푼다(옮기지 않은 차액을 모인 돈으로 세지 않게).
 * planId·eligible·rate·snapshot·updatedAt을 다시 계산한다.
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
