import { formatWon } from "./format";
import { CATEGORY_LABEL, CATEGORY_ORDER, calculateAllocation } from "./plan";
import type { CategoryKey, PlanDraft } from "./types";

/**
 * 은행 세팅표 — 통장별 금액을 은행 앱 자동이체·모으기에 그대로 붙여 넣을 수 있게 만든다(순수 함수).
 * 금액은 결과 화면과 같은 배분 규칙(plan.calculateAllocation — 잔액은 생활비가 흡수)을 쓴다.
 */
type DraftLike = Pick<PlanDraft, "salary" | "fixedCosts" | "ratios" | "payday">;

export interface SetupRow {
  key: CategoryKey;
  /** "저축 통장" */
  label: string;
  /** 나눌 돈 중 이 통장의 비율(%) */
  ratio: number;
  amount: number;
  /** 붙여 넣을 값 — 숫자만("720000"). 은행 앱 금액 칸은 콤마를 거부하는 곳이 있다. */
  copyText: string;
}

/**
 * 이체일 표기. 월급 다음 날이 모든 달에 있는 날짜(28일 이하)면 "매달 N일",
 * 아니면 "월급날 다음 날"(29~31일은 없는 달이 있어 "매달 32일" 같은 값을 만들지 않는다).
 */
export function transferDayLabel(payday: number): string {
  return payday <= 27 ? `매달 ${payday + 1}일` : "월급날 다음 날";
}

/**
 * 비율이 0보다 크고 금액이 0보다 큰 통장만 CATEGORY_ORDER(생활비·저축·비상금·여가) 순으로.
 * 비율 0%인 생활비는 내림 잔액(몇 원)만 받는데(calculateAllocation — SPEC), 그 몇 원을 위해 자동이체를 걸라고
 * 하지 않는다(월급 통장에 그대로 남는다). 체크리스트는 SPEC대로 그 행을 보여 준다.
 */
export function buildSetupRows(draft: Pick<PlanDraft, "salary" | "fixedCosts" | "ratios">): SetupRow[] {
  const { amounts } = calculateAllocation(draft.salary, draft.fixedCosts, draft.ratios);
  return CATEGORY_ORDER.filter((key, i) => draft.ratios[i] > 0 && amounts[key] > 0).map((key) => ({
    key,
    label: `${CATEGORY_LABEL[key]} 통장`,
    ratio: draft.ratios[CATEGORY_ORDER.indexOf(key)],
    amount: amounts[key],
    copyText: String(amounts[key]),
  }));
}

/**
 * 세팅표 전체 복사 문자열:
 *   월급쪼개기 세팅표 · 매달 11일 이체
 *   생활비 통장 862,000원
 *   …
 */
export function buildSetupSheetText(draft: DraftLike): string {
  return [
    `월급쪼개기 세팅표 · ${transferDayLabel(draft.payday)} 이체`,
    ...buildSetupRows(draft).map((row) => `${row.label} ${formatWon(row.amount)}`),
  ].join("\n");
}

/**
 * 세팅표 서명 — `${payday}|${생활비}|${저축}|${비상금}|${여가}`(금액 기준).
 * 비율·고정비가 달라도 은행에 넣을 금액·날짜가 같으면 같은 서명이다 — 초안을 복사한 뒤 저장해도 일치한다.
 */
export function setupSignature(draft: DraftLike): string {
  const { amounts } = calculateAllocation(draft.salary, draft.fixedCosts, draft.ratios);
  return [draft.payday, ...CATEGORY_ORDER.map((key) => amounts[key])].join("|");
}
