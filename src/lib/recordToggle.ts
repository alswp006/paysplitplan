import type { CategoryKey, SaveResult } from "./types";

/**
 * 월별 기록에서 특정 카테고리의 체크 상태를 토글한다.
 * 계획이 없으면 NO_PLAN 에러, 저장 실패(용량 초과)는 QUOTA 에러.
 * 이미 같은 값이면 멱등하게 쓰지 않고 ok를 반환한다.
 */
export function toggleRecordItem(key: CategoryKey, value: boolean): SaveResult {
  // TODO: 구현 필요
  return { ok: true };
}
