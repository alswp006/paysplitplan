import { parseAmountInput } from "@/lib/format";

export const FIXED_COST_NAME_MAX = 20;
export const FIXED_COST_AMOUNT_MAX = 100_000_000;

export interface FixedCostInputResult {
  name: string;
  amount: number;
  nameError: string | null;
  amountError: string | null;
  valid: boolean;
}

/** 고정비 입력 원문 검증. 이름은 trim 후 1–20자, 금액은 1–1억 정수. 원문은 고치지 않고 해석만 한다. */
export function validateFixedCostInput(rawName: string, rawAmount: string): FixedCostInputResult {
  const name = String(rawName ?? "").trim();
  let nameError: string | null = null;
  if (name.length === 0) nameError = "항목 이름을 입력해주세요";
  else if (name.length > FIXED_COST_NAME_MAX) nameError = "항목 이름은 20자 이내로 입력해주세요";

  const parsed = parseAmountInput(rawAmount);
  let amount = 0;
  let amountError: string | null = null;
  switch (parsed.kind) {
    case "empty":
      amountError = "금액을 입력해주세요";
      break;
    case "negative":
      amountError = "0보다 큰 금액을 입력해주세요";
      break;
    case "decimal":
      amountError = "원 단위로 입력해주세요";
      break;
    case "invalid":
      amountError = "숫자만 입력해주세요";
      break;
    case "ok":
      if (parsed.value === 0) amountError = "금액을 입력해주세요";
      else if (parsed.value > FIXED_COST_AMOUNT_MAX) amountError = "1억 원 이하로 입력해주세요";
      else amount = parsed.value;
      break;
  }

  return { name, amount, nameError, amountError, valid: nameError === null && amountError === null };
}
