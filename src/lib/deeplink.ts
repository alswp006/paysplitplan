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

/** [40, 40, 10, 10] → "생활비 40% · 저축 40% · 비상금 10% · 여가 10%" (공유 메시지·받은 비율 배너가 같은 줄을 쓴다) */
export function ratioLine(r: Ratios): string {
  return ratioItems(r).join(" · ");
}

/** [40, 40, 10, 10] → ["생활비 40%", "저축 40%", "비상금 10%", "여가 10%"] — 화면은 항목 단위로 줄을 바꾼다("여가 / 10%" 금지). */
export function ratioItems(r: Ratios): string[] {
  // %를 붙인다 — "생활비 40"만 받은 사람은 40을 40만 원으로 읽을 수 있다.
  return CATEGORY_ORDER.map((key, i) => `${CATEGORY_LABEL[key]} ${r[i]}%`);
}

/**
 * 공유 메시지 — 월급·금액은 싣지 않고 비율만 보낸다(받는 사람이 자기 월급으로 계산한다).
 * "월급쪼개기로 이렇게 나눠요\n생활비 40% · 저축 40% · 비상금 10% · 여가 10%\n내 월급으로 계산해 보기"
 */
export function buildRatioShareMessage(r: Ratios): string {
  return `월급쪼개기로 이렇게 나눠요\n${ratioLine(r)}\n내 월급으로 계산해 보기`;
}

const RATIO_PARAM_RE = /^\d{1,3}(-\d{1,3}){3}$/;

/**
 * 받은 링크의 비율(`?r=40-40-10-10`)을 읽는다. 값 4개가 각각 0~100이고 5의 배수이며 합이 100일 때만 Ratios,
 * 하나라도 어기면 null(화면은 조용히 무시한다). 던지지 않는다.
 */
export function parseSharedRatios(search: string): Ratios | null {
  try {
    const raw = new URLSearchParams(search).get("r");
    if (raw === null || !RATIO_PARAM_RE.test(raw)) return null;
    const values = raw.split("-").map(Number);
    if (values.some((v) => v < 0 || v > 100 || v % 5 !== 0)) return null;
    if (values.reduce((sum, v) => sum + v, 0) !== 100) return null;
    return [values[0], values[1], values[2], values[3]];
  } catch {
    return null;
  }
}
