import type { FixedCost, PlanDraft, Ratios } from "@/lib/types";
import { formatWon, parseAmountInput } from "@/lib/format";
import { isValidDraft } from "@/lib/validate";

export const SALARY_MAX = 100_000_000;
export const FIXED_COST_LIMIT = 10;

export const SALARY_EMPTY_ERROR = "월급을 입력해주세요";
export const PAYDAY_ERROR = "1~31 사이 날짜를 입력해주세요";
export const PAYDAY_HELP ="매달 25일처럼 날짜만 입력해요";

export interface SalaryResult {
  /** 유효한 월급(에러가 있으면 0) */
  value: number;
  error: string | null;
  /** 빈 값이거나 0 — 버튼을 막지 않고 탭했을 때만 에러를 보여주는 경우 */
  empty: boolean;
}

export function sumFixedCosts(costs: Pick<FixedCost, "amount">[]): number {
  return costs.reduce((sum, c) => sum + c.amount, 0);
}

/** 월급 원문 검증. 원문은 고치지 않고 해석만 한다. fixedTotal이 월급 이상이면 에러. */
export function validateSalaryInput(raw: string, fixedTotal: number): SalaryResult {
  const parsed = parseAmountInput(raw);
  switch (parsed.kind) {
    case "empty":
      return { value: 0, error: SALARY_EMPTY_ERROR, empty: true };
    case "negative":
      return { value: 0, error: "0보다 큰 금액을 입력해주세요", empty: false };
    case "decimal":
      return { value: 0, error: "원 단위로 입력해주세요", empty: false };
    case "invalid":
      return { value: 0, error: "숫자만 입력해주세요", empty: false };
    case "ok":
      if (parsed.value === 0) return { value: 0, error: SALARY_EMPTY_ERROR, empty: true };
      if (parsed.value > SALARY_MAX) return { value: 0, error: "1억 원 이하로 입력해주세요", empty: false };
      if (fixedTotal >= parsed.value) {
        return { value: 0, error: "고정비가 월급보다 많아요. 금액을 확인해주세요", empty: false };
      }
      return { value: parsed.value, error: null, empty: false };
  }
}

export interface PaydayResult {
  value: number;
  error: string | null;
}

/** 월급날 원문 검증 — 1~31 정수만. */
export function validatePaydayInput(raw: string): PaydayResult {
  const parsed = parseAmountInput(raw);
  if (parsed.kind !== "ok" || parsed.value < 1 || parsed.value > 31) return { value: 0, error: PAYDAY_ERROR };
  return { value: parsed.value, error: null };
}

/** 나눌 돈 미리보기 문구. 월급이 유효하지 않거나 나눌 돈이 0 이하면 '-원'(음수는 보여주지 않는다). */
export function formatAvailablePreview(salaryRaw: string, fixedTotal: number): string {
  const parsed = parseAmountInput(salaryRaw);
  if (parsed.kind !== "ok" || parsed.value < 1 || parsed.value > SALARY_MAX) return "나눌 돈 -원";
  const available = parsed.value - fixedTotal;
  return available > 0 ? `나눌 돈 ${formatWon(available)}` : "나눌 돈 -원";
}

/** 나눌 돈(양수일 때만). 그 외는 null. */
export function getAvailable(salaryRaw: string, fixedTotal: number): number | null {
  const parsed = parseAmountInput(salaryRaw);
  if (parsed.kind !== "ok" || parsed.value < 1 || parsed.value > SALARY_MAX) return null;
  const available = parsed.value - fixedTotal;
  return available > 0 ? available : null;
}

export interface PlanFormInput {
  salaryRaw: string;
  paydayRaw: string;
  fixedCosts: FixedCost[];
  ratios: Ratios;
  presetId: string;
}

/** 모든 입력이 유효할 때만 PlanDraft(id·createdAt·updatedAt·version 없음)를 돌려준다. 아니면 null. */
export function buildDraft(input: PlanFormInput): PlanDraft | null {
  const salary = validateSalaryInput(input.salaryRaw, sumFixedCosts(input.fixedCosts));
  const payday = validatePaydayInput(input.paydayRaw);
  if (salary.error || payday.error) return null;
  const draft: PlanDraft = {
    salary: salary.value,
    fixedCosts: input.fixedCosts.map((c) => ({ ...c })),
    presetId: input.presetId,
    ratios: [...input.ratios] as Ratios,
    payday: payday.value,
  };
  return isValidDraft(draft) ? draft : null;
}
