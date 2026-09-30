import { getToday, isIsoTimestamp, monthKey, nowIso, shiftMonth } from "./date";
import { calculateAllocation } from "./plan";
import { isValidRecord, normalizeLegacyRecord } from "./validate";
import type { EmergencyGoal, GoalMonths, GoalSummary, PlanDraft, RecordStore, SaveResult } from "./types";

/**
 * 비상금 N개월 목표 — 이미 입력한 고정비·생활비로 "한 달 필수 지출"을 정하고, 체크한 비상금 이체를 쌓아
 * "몇 달 치 모였나"를 보여 준다. 새 입력은 목표 개월 수와(선택) 지금 잔액뿐이다.
 *
 * 모은 돈(saved) = baseBalance + Σ(baseMonth보다 뒤의 달 중 비상금을 체크한 기록의 그 달 비상금 금액).
 * - 잔액 맞추기는 baseBalance = 입력값, baseMonth = 이번 달(이번 달 체크가 두 번 세어지지 않게).
 * - 기록 24개월 정리로 지워지는 달은 storage.writeMonthRecord가 foldPrunedIntoGoal로 baseBalance에 합친다(총합 불변).
 * 이 모듈은 storage를 import하지 않는다(storage가 이 모듈을 부른다 — 순환 방지).
 */
export const GOAL_KEY = "paysplit:goal:v1";
/** 검증에 실패한 목표 원문을 **덮어쓰기 전에** 여기 복사한다(사용자 데이터를 잃지 않는다). */
export const GOAL_BACKUP_KEY = "paysplit:goal:v1:bak";
export const GOAL_MONTH_OPTIONS: GoalMonths[] = [3, 6, 12];
export const GOAL_BALANCE_MAX = 10_000_000_000;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

type PlanLike = Pick<PlanDraft, "salary" | "fixedCosts" | "ratios">;

export function isGoalMonths(x: unknown): x is GoalMonths {
  return x === 3 || x === 6 || x === 12;
}

export function isValidGoal(x: unknown): x is EmergencyGoal {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return (
    o.version === 1 &&
    isGoalMonths(o.months) &&
    typeof o.baseBalance === "number" &&
    Number.isInteger(o.baseBalance) &&
    o.baseBalance >= 0 &&
    o.baseBalance <= GOAL_BALANCE_MAX &&
    typeof o.baseMonth === "string" &&
    MONTH_RE.test(o.baseMonth) &&
    isIsoTimestamp(o.createdAt) &&
    isIsoTimestamp(o.updatedAt)
  );
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseGoal(raw: string): EmergencyGoal | null {
  try {
    const data: unknown = JSON.parse(raw);
    return isValidGoal(data) ? data : null;
  } catch {
    return null;
  }
}

/** 저장된 목표. 없거나 무효면 null — **절대 지우지 않는다.** 던지지 않는다. */
export function loadGoal(): EmergencyGoal | null {
  const raw = readRaw(GOAL_KEY);
  return raw === null ? null : parseGoal(raw);
}

/**
 * 목표를 저장한다. 기존 원문이 있는데 무효면 먼저 GOAL_BACKUP_KEY에 복사하고, 복사하지 못하면 쓰지 않는다(원문 보존).
 * 모양이 틀린 목표는 쓰지 않는다. 던지지 않는다 — 쓰기 실패면 {ok:false, error:"QUOTA"}.
 */
export function saveGoal(goal: EmergencyGoal): SaveResult {
  if (!isValidGoal(goal)) return { ok: false, error: "QUOTA" };
  try {
    const raw = readRaw(GOAL_KEY);
    if (raw !== null && parseGoal(raw) === null) localStorage.setItem(GOAL_BACKUP_KEY, raw);
    localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
    return { ok: true };
  } catch {
    return { ok: false, error: "QUOTA" };
  }
}

/** 새 목표 — baseBalance 0, baseMonth = 지난달(이번 달 체크가 바로 집계된다). */
export function createGoal(months: GoalMonths, today: Date = getToday()): EmergencyGoal {
  const now = nowIso();
  return { version: 1, months, baseBalance: 0, baseMonth: shiftMonth(monthKey(today), -1), createdAt: now, updatedAt: now };
}

/** 잔액 맞추기 — 입력값이 이번 달 이체까지 포함한 잔액이다. baseMonth = 이번 달. */
export function adjustBalance(goal: EmergencyGoal, balance: number, today: Date = getToday()): EmergencyGoal {
  return { ...goal, baseBalance: balance, baseMonth: monthKey(today), updatedAt: nowIso() };
}

export function withMonths(goal: EmergencyGoal, months: GoalMonths): EmergencyGoal {
  return { ...goal, months, updatedAt: nowIso() };
}

/** 한 달 필수 지출 = 고정비 합 + 생활비(현재 계획). 목표가 없을 때도 카드가 보여 준다. */
export function essentialOf(plan: PlanLike): { fixedTotal: number; living: number; essential: number } {
  const { fixedTotal, amounts } = calculateAllocation(plan.salary, plan.fixedCosts, plan.ratios);
  return { fixedTotal, living: amounts.living, essential: fixedTotal + amounts.living };
}

/** 순수 함수 — 저장소를 읽거나 쓰지 않는다. store는 검증된 기록(loadRecords)이다. */
export function summarizeGoal(goal: EmergencyGoal, plan: PlanLike, store: RecordStore, today: Date): GoalSummary {
  const { fixedTotal, living, essential } = essentialOf(plan);
  const monthlyEmergency = calculateAllocation(plan.salary, plan.fixedCosts, plan.ratios).amounts.emergency;
  const current = monthKey(today);

  let saved = goal.baseBalance;
  for (const [month, record] of Object.entries(store.records)) {
    if (month > goal.baseMonth && record.checked.emergency) saved += record.snapshot.amounts.emergency;
  }

  const thisRecord = store.records[current];
  const checkedThisMonth = thisRecord?.checked.emergency === true;
  const thisMonthAdded = current > goal.baseMonth && checkedThisMonth ? thisRecord.snapshot.amounts.emergency : 0;

  if (essential <= 0) {
    return {
      fixedTotal, living, essential, target: 0, saved, monthsCovered: null, progress: 0, reached: false,
      thisMonthAdded, reachMonth: null, monthlyEmergency,
    };
  }

  const target = goal.months * essential;
  const reached = saved >= target;
  let reachMonth: string | null = null;
  if (!reached && monthlyEmergency > 0) {
    const n = Math.ceil((target - saved) / monthlyEmergency);
    // 이번 달 비상금을 이미 옮겼으면 다음 이체는 다음 달부터, 아니면 이번 달 이체가 첫 번째다.
    reachMonth = shiftMonth(current, checkedThisMonth ? n : n - 1);
  }

  return {
    fixedTotal,
    living,
    essential,
    target,
    saved,
    monthsCovered: Math.floor((saved / essential) * 10) / 10,
    progress: Math.min(1, saved / target),
    reached,
    thisMonthAdded,
    reachMonth,
    monthlyEmergency,
  };
}

/** 1.9 → "1.9", 2 → "2" */
export function formatMonthsCovered(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * 기록 24개월 정리로 지워지는 달을 목표의 baseBalance에 합친다(saved 총합이 변하지 않게).
 * 목표가 있고, 지운 달이 baseMonth보다 뒤이고, 유효한 기록이며 비상금을 체크했으면 그 금액을 더한다.
 * baseMonth는 지운 달 중 최댓값으로 옮긴다(남은 기록은 모두 그보다 뒤다).
 * 합칠 것이 없거나 목표가 없으면 아무것도 쓰지 않고 true. 쓰기에 실패하면 false — 호출부는 정리를 되돌린다.
 */
export function foldPrunedIntoGoal(pruned: [month: string, raw: unknown][]): boolean {
  try {
    if (pruned.length === 0) return true;
    const raw = readRaw(GOAL_KEY);
    if (raw === null) return true;
    const goal = parseGoal(raw);
    if (!goal) return true; // 무효 원문은 건드리지 않는다 — 합칠 곳이 없다.

    let add = 0;
    let maxMonth = goal.baseMonth;
    for (const [month, value] of pruned) {
      if (!MONTH_RE.test(month) || month <= goal.baseMonth) continue;
      if (month > maxMonth) maxMonth = month;
      const record = normalizeLegacyRecord(month, value);
      if (isValidRecord(month, record) && record.checked.emergency) add += record.snapshot.amounts.emergency;
    }
    if (maxMonth === goal.baseMonth) return true;

    const next: EmergencyGoal = {
      ...goal,
      baseBalance: Math.min(GOAL_BALANCE_MAX, goal.baseBalance + add),
      baseMonth: maxMonth,
      updatedAt: nowIso(),
    };
    localStorage.setItem(GOAL_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
