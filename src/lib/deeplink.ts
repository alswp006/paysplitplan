import { CATEGORY_LABEL, CATEGORY_ORDER } from "./plan";
import type { Ratios } from "./types";

/**
 * 앱인토스 딥링크 경로. `getTossShareLink(path)`는 `intoss://`(또는 출시 전 `intoss-private://`)로
 * 시작하는 경로를 받는다(web-framework 3.6.0 .d.ts) — "/result" 같은 앱 내부 경로를 그대로 넘기면
 * 실기기에서 링크가 만들어지지 않는다. 템플릿 `share.ts`는 건드리지 않고 호출부에서 여기로 만든다.
 */

/** apps-in-toss.config.ts의 appName과 같아야 한다(테스트가 대조한다). */
export const APP_NAME = "paysplitplan";

/** "/x" → "intoss://paysplitplan/x". 이미 intoss:// · intoss-private://로 시작하면 그대로 둔다. */
export function toIntossPath(path: string): string {
  if (path.startsWith("intoss://") || path.startsWith("intoss-private://")) return path;
  const rest = path.startsWith("/") ? path : `/${path}`;
  return `intoss://${APP_NAME}${rest}`;
}

/** [40, 40, 10, 10] → "40-40-10-10" (공유 링크의 ?r= 값) */
export function ratioParam(r: Ratios): string {
  return r.join("-");
}

/**
 * 공유 메시지 — 월급·금액은 싣지 않고 비율만 보낸다(받는 사람이 자기 월급으로 계산한다).
 * "월급쪼개기로 이렇게 나눠요\n생활비 40 · 저축 40 · 비상금 10 · 여가 10\n내 월급으로 계산해 보기"
 */
export function buildRatioShareMessage(r: Ratios): string {
  const parts = CATEGORY_ORDER.map((key, i) => `${CATEGORY_LABEL[key]} ${r[i]}`).join(" · ");
  return `월급쪼개기로 이렇게 나눠요\n${parts}\n내 월급으로 계산해 보기`;
}
