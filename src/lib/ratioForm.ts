import type { CategoryKey, Ratios } from "@/lib/types";
import { CATEGORY_LABEL, CATEGORY_ORDER, calculateAllocation } from "@/lib/plan";
import { formatWon } from "@/lib/format";

export const RATIO_STEP = 5;

export function sumRatios(ratios: Ratios): number {
  return ratios.reduce((sum, r) => sum + r, 0);
}

/** 비율을 delta(±5)만큼 움직이되 0–100 밖으로 나가지 않게 자른다. */
export function stepRatio(value: number, delta: number): number {
  return Math.min(100, Math.max(0, value + delta));
}

/**
 * 행 문구 "{라벨} {n}% · {금액}원".
 * 합이 100이면 calculateAllocation(내림 잔액을 생활비가 흡수), 아니면 카테고리마다 floor(available×r/100).
 * available이 null이거나 0 이하면 금액 자리는 '-원'이다.
 */
export function getRatioRowText(key: CategoryKey, ratios: Ratios, available: number | null): string {
  const index = CATEGORY_ORDER.indexOf(key);
  const ratio = ratios[index];
  const head = `${CATEGORY_LABEL[key]} ${ratio}% · `;
  if (available === null || !Number.isFinite(available) || available <= 0) return `${head}-원`;

  const amount =
    sumRatios(ratios) === 100
      ? calculateAllocation(available, [], ratios).amounts[key]
      : Math.floor((available * ratio) / 100);
  return `${head}${formatWon(Math.max(0, amount))}`;
}
