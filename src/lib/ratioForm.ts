import type { CategoryKey, Ratios } from "@/lib/types";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/plan";
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
 * /plan은 합과 무관하게 모든 행을 floor(available×r/100)로 구한다(잔액을 생활비가 흡수하지 않는다 — SPEC F3).
 * available이 null이거나 0 이하면 금액 자리는 '-원'이다.
 */
export function getRatioRowText(key: CategoryKey, ratios: Ratios, available: number | null): string {
  return `${CATEGORY_LABEL[key]} ${getRatioRowBody(key, ratios, available)}`;
}

/**
 * 라벨을 뺀 행 본문 "{n}% · {금액}원"(금액을 모르면 "-원"). 비율 행은 라벨(윗줄)과 이 본문(아랫줄) 두 줄로 그린다 —
 * 통장 배지와 +/- 버튼 사이에서 한 줄로 두면 390px에서도 금액이 꺾였다.
 */
export function getRatioRowBody(key: CategoryKey, ratios: Ratios, available: number | null): string {
  const index = CATEGORY_ORDER.indexOf(key);
  const ratio = ratios[index];
  const head = `${ratio}% · `;
  if (available === null || !Number.isFinite(available) || available <= 0) return `${head}-원`;

  return `${head}${formatWon(Math.max(0, Math.floor((available * ratio) / 100)))}`;
}
