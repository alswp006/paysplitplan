import { getToday } from "@/lib/date";

export interface NextPayday {
  /** 다음 월급날(로컬 자정) */
  nextPaydayDate: Date;
  /** 오늘부터 월급날까지 남은 일수. 오늘이 월급날이면 0 */
  dday: number;
  /** 'M월 D일 월급날' */
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 그 달의 payday. 말일보다 크면 말일로 당긴다 */
function paydayOfMonth(year: number, month: number, payday: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(payday, lastDay));
}

/** 시각·DST와 무관하게 두 로컬 날짜 사이의 일수 */
function diffDays(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY_MS);
}

export function getNextPayday(today: Date, payday: number): NextPayday {
  const year = today.getFullYear();
  const month = today.getMonth();
  let next = paydayOfMonth(year, month, payday);
  if (diffDays(today, next) < 0) next = paydayOfMonth(year, month + 1, payday);
  return {
    nextPaydayDate: next,
    dday: diffDays(today, next),
    label: `${next.getMonth() + 1}월 ${next.getDate()}일 월급날`,
  };
}

/**
 * 오늘(기기 로컬)부터 'YYYY-MM-DD' 목표일까지 남은 일수. 오늘이면 0, 지났으면 음수.
 * 해석할 수 없는 값은 NaN — 0을 돌려주면 "D-DAY"로 잘못 보인다.
 */
export function calculateDday(targetDate: string): number {
  const m = typeof targetDate === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetDate.trim()) : null;
  if (!m) return Number.NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const target = new Date(y, mo, d);
  // 2026-02-31 같은 없는 날짜는 다른 달로 넘어가므로 거른다
  if (target.getFullYear() !== y || target.getMonth() !== mo || target.getDate() !== d) return Number.NaN;
  return diffDays(getToday(), target);
}
