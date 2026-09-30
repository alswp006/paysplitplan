import { formatWon } from "./format";
import { CATEGORY_ORDER, calculateAllocation } from "./plan";
import { SPLIT_LABEL, type SplitKind } from "./theme";
import type { ChecklistRow } from "./homeView";
import type { FixedCost, Ratios } from "./types";

/** 막대 조각 하나 — 값에 비례한 폭. filled=false면 흐리게(아직 안 옮긴 통장). */
export interface SplitSegment {
  key: SplitKind;
  value: number;
  filled?: boolean;
}

export interface SplitModel {
  segments: SplitSegment[];
  /** 막대의 접근성 이름 — 금액은 여기에만 싣는다(화면 텍스트로 금액을 또 내지 않는다). */
  ariaLabel: string;
}

/** 결과 히어로 — 월급 한 줄이 고정비와 통장 4개로 갈라진다. 조각 값의 합은 월급이다. */
export function allocationSplit(salary: number, fixedCosts: Pick<FixedCost, "amount">[], ratios: Ratios): SplitModel {
  const { fixedTotal, amounts } = calculateAllocation(salary, fixedCosts, ratios);
  const segments: SplitSegment[] = [
    { key: "fixed", value: fixedTotal },
    ...CATEGORY_ORDER.map((key) => ({ key, value: amounts[key] })),
  ];
  const parts = segments.map((s) => `${SPLIT_LABEL[s.key]} ${formatWon(s.value)}`).join(", ");
  return { segments, ariaLabel: `월급 ${formatWon(salary)} 중 ${parts}` };
}

/** 계획 화면·받은 비율 — 통장 4개의 비율. */
export function ratioSplit(ratios: Ratios): SplitModel {
  const segments: SplitSegment[] = CATEGORY_ORDER.map((key, i) => ({ key, value: ratios[i] }));
  return { segments, ariaLabel: segments.map((s) => `${SPLIT_LABEL[s.key]} ${s.value}%`).join(", ") };
}

/** 홈 — 이번 달 체크리스트 행 순서대로, 옮긴 통장만 채운다. */
export function checklistSplit(rows: Pick<ChecklistRow, "key" | "amount" | "checked">[]): SplitModel {
  const segments: SplitSegment[] = rows.map((r) => ({ key: r.key, value: r.amount, filled: r.checked }));
  return {
    segments,
    ariaLabel: segments.map((s) => `${SPLIT_LABEL[s.key]} ${s.filled ? "옮김" : "남음"}`).join(", "),
  };
}

/** 범례에 올릴 종류 — 값이 0보다 큰 조각만, 막대와 같은 순서. */
export function legendKinds(segments: SplitSegment[]): SplitKind[] {
  return segments.filter((s) => s.value > 0).map((s) => s.key);
}
