import { isIsoTimestamp } from "@/lib/date";
import type { CategoryKey, MonthRecord, PlanDraft, SalaryPlan } from "@/lib/types";

const MAX_AMOUNT = 100_000_000;
const MAX_FIXED_COSTS = 10;
const MAX_NAME_LENGTH = 20;
const PRESET_IDS = ["p532", "p442", "p622", "custom"];
const CATEGORY_KEYS: CategoryKey[] = ["living", "saving", "emergency", "leisure"];
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

type Obj = Record<string, unknown>;

function isObj(x: unknown): x is Obj {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isIntIn(x: unknown, min: number, max: number): x is number {
  return typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x !== "";
}

function isValidFixedCost(x: unknown): boolean {
  if (!isObj(x)) return false;
  if (!isNonEmptyString(x.id)) return false;
  if (typeof x.name !== "string") return false;
  const nameLength = x.name.trim().length;
  if (nameLength < 1 || nameLength > MAX_NAME_LENGTH) return false;
  if (!isIntIn(x.amount, 1, MAX_AMOUNT)) return false;
  return isIsoTimestamp(x.createdAt) && isIsoTimestamp(x.updatedAt);
}

function isValidRatios(x: unknown): boolean {
  if (!Array.isArray(x) || x.length !== CATEGORY_KEYS.length) return false;
  if (!x.every((v) => isIntIn(v, 0, 100))) return false;
  return x.reduce((sum: number, v: number) => sum + v, 0) === 100;
}

/** 초안 규칙(SPEC F1). 어떤 입력에도 던지지 않는다. */
export function isValidDraft(x: unknown): x is PlanDraft {
  try {
    if (!isObj(x)) return false;
    if (!isIntIn(x.salary, 1, MAX_AMOUNT)) return false;
    if (!isIntIn(x.payday, 1, 31)) return false;
    if (typeof x.presetId !== "string" || !PRESET_IDS.includes(x.presetId)) return false;
    if (!isValidRatios(x.ratios)) return false;

    const costs = x.fixedCosts;
    if (!Array.isArray(costs) || costs.length > MAX_FIXED_COSTS) return false;
    if (!costs.every(isValidFixedCost)) return false;
    const ids = new Set(costs.map((c: Obj) => c.id));
    if (ids.size !== costs.length) return false;
    const total = costs.reduce((sum: number, c: Obj) => sum + (c.amount as number), 0);
    return total < x.salary;
  } catch {
    return false;
  }
}

export function isValidPlan(x: unknown): x is SalaryPlan {
  try {
    if (!isValidDraft(x)) return false;
    const p = x as unknown as Obj;
    return p.version === 1 && isNonEmptyString(p.id) && isIsoTimestamp(p.createdAt) && isIsoTimestamp(p.updatedAt);
  } catch {
    return false;
  }
}

/**
 * 새 필드가 없던 v1 계획을 메모리에서만 채운다. 값이 undefined인 필드만 채우고 입력은 바꾸지 않는다.
 * version !== 1이거나 updatedAt이 ISO가 아니면 입력을 그대로 돌려준다.
 */
export function normalizeLegacyPlan<T>(x: T): T {
  try {
    if (!isObj(x) || x.version !== 1 || !isIsoTimestamp(x.updatedAt)) return x;
    const updatedAt = x.updatedAt;
    const next: Obj = { ...x };
    if (next.id === undefined) next.id = "legacy-" + Date.parse(updatedAt).toString(36);
    if (next.createdAt === undefined) next.createdAt = updatedAt;
    if (Array.isArray(x.fixedCosts)) {
      next.fixedCosts = x.fixedCosts.map((c: unknown) => {
        if (!isObj(c)) return c;
        const cost: Obj = { ...c };
        if (cost.createdAt === undefined) cost.createdAt = updatedAt;
        if (cost.updatedAt === undefined) cost.updatedAt = updatedAt;
        return cost;
      });
    }
    return next as T;
  } catch {
    return x;
  }
}

/** 레거시 레코드를 메모리에서만 채운다. 값이 undefined인 필드만 채우고 입력은 바꾸지 않는다. */
export function normalizeLegacyRecord<T>(month: string, x: T): T {
  try {
    if (!isObj(x)) return x;
    const next: Obj = { ...x };
    if (next.id === undefined) next.id = "legacy-" + month;
    if (next.planId === undefined) next.planId = null;
    if (next.createdAt === undefined && isIsoTimestamp(x.updatedAt)) next.createdAt = x.updatedAt;
    return next as T;
  } catch {
    return x;
  }
}

/** `month`는 records 객체의 키다. 키 형식이 맞고 record.month와 같아야 한다. */
export function isValidRecord(month: string, x: unknown): x is MonthRecord {
  try {
    if (typeof month !== "string" || !MONTH_KEY.test(month)) return false;
    if (!isObj(x) || x.month !== month) return false;
    if (!isNonEmptyString(x.id)) return false;
    if (x.planId !== null && !isNonEmptyString(x.planId)) return false;
    if (!isIsoTimestamp(x.createdAt) || !isIsoTimestamp(x.updatedAt)) return false;
    if (x.completedAt !== null && !isIsoTimestamp(x.completedAt)) return false;
    if (!isIntIn(x.rate, 0, 100)) return false;
    if (!isObj(x.checked) || !CATEGORY_KEYS.every((k) => typeof (x.checked as Obj)[k] === "boolean")) return false;
    return Array.isArray(x.eligible) && x.eligible.every((k) => CATEGORY_KEYS.includes(k as CategoryKey));
  } catch {
    return false;
  }
}

/**
 * 계획(SalaryPlan) 검증 결과를 사유 목록으로 돌려준다(contract `validatePlanFn`).
 * `valid`는 `isValidPlan`과 항상 같은 결과다. 어떤 입력에도 던지지 않는다.
 */
export function validatePlan(plan: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  try {
    if (!isObj(plan)) return { valid: false, errors: ["계획 데이터가 객체가 아니에요"] };

    if (plan.version !== 1) errors.push("version은 1이어야 해요");
    if (!isNonEmptyString(plan.id)) errors.push("id가 비어 있어요");
    if (!isIntIn(plan.salary, 1, MAX_AMOUNT)) errors.push("월급은 1원 이상 1억 원 이하 정수여야 해요");
    if (!isIntIn(plan.payday, 1, 31)) errors.push("월급날은 1~31 사이 정수여야 해요");
    if (typeof plan.presetId !== "string" || !PRESET_IDS.includes(plan.presetId)) {
      errors.push("프리셋은 p532, p442, p622, custom 중 하나여야 해요");
    }
    if (!isValidRatios(plan.ratios)) errors.push("비율은 0~100 정수 4개이고 합계가 100이어야 해요");
    if (!isIsoTimestamp(plan.createdAt)) errors.push("createdAt이 올바른 시각이 아니에요");
    if (!isIsoTimestamp(plan.updatedAt)) errors.push("updatedAt이 올바른 시각이 아니에요");

    const costs = plan.fixedCosts;
    if (!Array.isArray(costs)) {
      errors.push("고정비 목록이 배열이 아니에요");
    } else {
      if (costs.length > MAX_FIXED_COSTS) errors.push(`고정비는 최대 ${MAX_FIXED_COSTS}개까지 가능해요`);
      if (!costs.every(isValidFixedCost)) {
        errors.push("고정비 항목의 id·이름(1~20자)·금액·시각을 확인해 주세요");
      } else {
        const ids = new Set(costs.map((c: Obj) => c.id));
        if (ids.size !== costs.length) errors.push("고정비 id가 중복돼요");
        const total = costs.reduce((sum: number, c: Obj) => sum + (c.amount as number), 0);
        if (isIntIn(plan.salary, 1, MAX_AMOUNT) && total >= plan.salary) {
          errors.push("고정비 합계가 월급보다 작아야 해요");
        }
      }
    }
  } catch {
    errors.push("계획 데이터를 검사하지 못했어요");
  }
  return { valid: errors.length === 0, errors };
}
