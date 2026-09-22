import type { Plan, PlanDraft, SetupErrors } from "./types";
import { LIMITS } from "./constants";
import { formatComma } from "./format";

export interface ValidationError {
  name?: string;
  amount?: string;
}

export function validateSetup(draft: PlanDraft): SetupErrors {
  const errors: SetupErrors = {};

  if (!Number.isInteger(draft.salary)) {
    errors.salary = "월급은 정수로 입력해야 해요";
  } else if (draft.salary < LIMITS.salaryMin) {
    errors.salary = `월급은 ${formatComma(LIMITS.salaryMin)}원 이상이어야 해요`;
  } else if (draft.salary > LIMITS.salaryMax) {
    errors.salary = `월급은 ${formatComma(LIMITS.salaryMax)}원 이하여야 해요`;
  }

  if (
    !Number.isInteger(draft.payday) ||
    draft.payday < LIMITS.paydayMin ||
    draft.payday > LIMITS.paydayMax
  ) {
    errors.payday = `월급날은 ${LIMITS.paydayMin}일에서 ${LIMITS.paydayMax}일 사이여야 해요`;
  }

  if (draft.fixedCosts.length > LIMITS.maxFixedCostItems) {
    errors.fixedTotal = `고정비는 최대 ${LIMITS.maxFixedCostItems}개까지 등록할 수 있어요`;
  } else {
    const fixedTotal = draft.fixedCosts.reduce((sum, item) => sum + item.amount, 0);
    if (Number.isFinite(draft.salary) && draft.salary - fixedTotal <= 0) {
      errors.fixedTotal = "고정비 합계가 월급을 초과해요";
    }
  }

  return errors;
}

export function validateSetupInput(
  salary: number,
  fixedCosts: Plan["fixedCosts"]
): { valid: boolean; error?: string } {
  if (!Number.isInteger(salary) || salary < LIMITS.salaryMin) {
    return { valid: false, error: `월급은 ${formatComma(LIMITS.salaryMin)}원 이상이어야 해요` };
  }

  if (salary > LIMITS.salaryMax) {
    return { valid: false, error: `월급은 ${formatComma(LIMITS.salaryMax)}원 이하여야 해요` };
  }

  if (fixedCosts.length > LIMITS.maxFixedCostItems) {
    return { valid: false, error: `고정비는 최대 ${LIMITS.maxFixedCostItems}개까지 등록할 수 있어요` };
  }

  const fixedTotal = fixedCosts.reduce((sum, item) => sum + item.amount, 0);
  if (salary - fixedTotal <= 0) {
    return { valid: false, error: "고정비 합계가 월급을 초과해요" };
  }

  return { valid: true };
}

export function validateFixedCost(
  name: string,
  amount: number
): ValidationError {
  const errors: ValidationError = {};

  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > LIMITS.fixedCostNameMaxLength) {
    errors.name = `이름은 1자에서 ${LIMITS.fixedCostNameMaxLength}자 사이로 입력해야 해요`;
  }

  if (
    !Number.isFinite(amount) ||
    amount < LIMITS.fixedCostAmountMin ||
    amount > LIMITS.fixedCostAmountMax
  ) {
    errors.amount = `금액은 ${formatComma(LIMITS.fixedCostAmountMin)}원에서 ${formatComma(
      LIMITS.fixedCostAmountMax
    )}원 사이로 입력해야 해요`;
  }

  return errors;
}
