const RANDOM_LENGTH = 4;
const RANDOM_FALLBACK = "0000";

// 같은 밀리초 안에서 연달아 호출해도 겹치지 않게 하는 호출 순번(36진수로 붙인다).
let sequence = 0;

/** 난수 문자열을 항상 RANDOM_LENGTH 자리로 맞춘다(Math.random()이 0이면 짧게 나온다). */
function randomPart(): string {
  const raw = Math.random().toString(36).slice(2, 2 + RANDOM_LENGTH);
  return (raw + RANDOM_FALLBACK).slice(0, RANDOM_LENGTH);
}

/**
 * 구형 WebView 호환 때문에 crypto UUID API 대신 시각+난수로 만든다.
 * 형식: 시각(36진수) + 난수 4자 + 호출 순번(36진수). 빈 문자열을 돌려주지 않는다.
 */
export function createId(): string {
  sequence = (sequence + 1) % (36 * 36 * 36);
  return Date.now().toString(36) + randomPart() + sequence.toString(36);
}

/** 접두어가 있으면 `prefix_id` 형태로 붙인다(예: generateId("plan") → "plan_lx3k…"). */
export function generateId(prefix?: string): string {
  return prefix ? `${prefix}_${createId()}` : createId();
}
