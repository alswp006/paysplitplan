import { monthKey, shiftMonth } from "./date";
import { getNextPayday, paydayOfMonth } from "./dday";
import { formatWon } from "./format";
import { buildChecklist, withLiveCurrentMonth } from "./homeView";
import { getTrend } from "./insights";
import { calculateAllocation } from "./plan";
import type { CategoryKey, RecordStore, SalaryPlan } from "./types";

export type HomeHeroPhase = "payday" | "done" | "inProgress" | "waiting";

export interface HomeHero {
  phase: HomeHeroPhase;
  /** 히어로 위 작은 라벨 */
  label: string;
  /** 히어로 큰 글자 */
  value: string;
  /** 히어로 아래 한 줄 */
  caption: string;
  /** 이번 달 체크한 통장(체크리스트 순서) */
  filledKeys: CategoryKey[];
}

/**
 * 홈 히어로의 상태. 달력 월 위에서 월급날을 기준으로 네 상태를 가른다(위에서부터 먼저 맞는 것).
 *  - payday     : 오늘이 월급날 — "D-0" 대신 "오늘은 월급날이에요"
 *  - done       : 이번 달 체크가 모두 끝남
 *  - inProgress : 이번 달 월급날이 지났거나 하나라도 체크함 — 남은 개수
 *  - waiting    : 그 밖(월급 전) — 다음 월급날까지 D-n, 지난달 결과 한 줄
 * 순수 함수 — 저장소를 읽거나 쓰지 않는다.
 */
export function buildHomeHero(plan: SalaryPlan, store: RecordStore, today: Date): HomeHero {
  const view = buildChecklist(plan, store, today);
  const { dday, label: pd } = getNextPayday(today, plan.payday);
  const month = today.getMonth() + 1;
  const thisPayday = paydayOfMonth(today.getFullYear(), today.getMonth(), plan.payday);
  const passed = today.getDate() >= thisPayday.getDate();
  const filledKeys = view.rows.filter((r) => r.checked).map((r) => r.key);
  const untilPayday = `${pd}까지 D-${dday}`;

  if (dday === 0) {
    const { available } = calculateAllocation(plan.salary, plan.fixedCosts, plan.ratios);
    return {
      phase: "payday",
      label: "오늘은 월급날이에요",
      value: `나눌 돈 ${formatWon(available)}`,
      caption: view.percent === 100 ? "이번 달 이체는 모두 체크했어요" : `통장 ${view.total}개로 나눠 옮기고 체크해요`,
      filledKeys,
    };
  }

  if (view.total > 0 && view.percent === 100) {
    const { streak } = getTrend(today, withLiveCurrentMonth(store, plan, today));
    return {
      phase: "done",
      label: `${month}월 이체 완료`,
      value: streak >= 2 ? `${streak}개월 연속 지켰어요` : "계획대로 옮겼어요",
      caption: untilPayday,
      filledKeys,
    };
  }

  if (passed || view.checkedCount > 0) {
    return {
      phase: "inProgress",
      label: `${month}월 이체`,
      value: `${view.total - view.checkedCount}개 남았어요`,
      caption: untilPayday,
      filledKeys,
    };
  }

  const last = store.records[shiftMonth(monthKey(today), -1)];
  const lastDone = last ? last.eligible.filter((k) => last.checked[k]).length : 0;
  return {
    phase: "waiting",
    label: "다음 월급날까지",
    value: `D-${dday}`,
    caption: last && last.eligible.length > 0 ? `${pd} · 지난달 ${last.eligible.length}개 중 ${lastDone}개 옮겼어요` : pd,
    filledKeys,
  };
}
