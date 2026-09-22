// 날짜 계산 유틸 — 전부 기기 로컬 시간(new Date(y,m,d)) 기준, UTC 변환 없음

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m }; // month는 1~12
}

/** month는 JS Date 관례대로 0=1월. year/month가 범위를 벗어나도 Date가 자동 정규화한다. */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * 다음 월급날을 반환한다(로컬 자정). payday가 그 달에 없으면(예: 31일인데 2월) 말일로 대체한다.
 * 이번 달의 (보정된) 월급날이 오늘 이후(오늘 포함)면 이번 달, 이미 지났으면 다음 달을 반환한다.
 */
export function getNextPayday(payday: number, today: Date = new Date()): Date {
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  const thisMonthEffDay = Math.min(payday, lastDayOfMonth(year, month));
  if (thisMonthEffDay >= day) {
    return new Date(year, month, thisMonthEffDay);
  }

  const nextMonth = month + 1;
  const nextMonthEffDay = Math.min(payday, lastDayOfMonth(year, nextMonth));
  return new Date(year, nextMonth, nextMonthEffDay);
}

/** 오늘부터 다음 월급날까지 남은 일수(당일=0). */
export function getDday(payday: number, today: Date = new Date()): number {
  const target = getNextPayday(payday, today);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = target.getTime() - todayMidnight.getTime();
  return Math.round(diffMs / 86_400_000);
}

export function formatDday(dday: number): string {
  if (dday === 0) return "D-DAY";
  return dday > 0 ? `D-${dday}` : `D+${-dday}`;
}

/**
 * targetDate('YYYY-MM-DD' 또는 그 앞부분을 담은 ISO 문자열)까지 남은 일수를 D-day 문자열로
 * 반환한다. 날짜 부분만 로컬 자정 기준으로 비교한다(UTC 파싱인 new Date(string)은 쓰지 않는다).
 */
export function getDdayString(targetDate: string, today: Date = new Date()): string {
  const [y, m, d] = targetDate.split("T")[0].split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = target.getTime() - todayMidnight.getTime();
  const dday = Math.round(diffMs / 86_400_000);
  return formatDday(dday);
}

/** 'YYYY-MM' 형식 월 키. month는 JS Date 관례대로 0=1월. */
export function toMonthKey(year: number, month: number): string {
  return `${year}-${pad2(month + 1)}`;
}

/** start~end(둘 다 포함)의 월 키 배열을 오름차순으로 반환한다. */
export function monthRange(startKey: string, endKey: string): string[] {
  const start = parseMonthKey(startKey);
  const end = parseMonthKey(endKey);
  const endIndex = end.year * 12 + end.month;

  let year = start.year;
  let month = start.month;
  const result: string[] = [];

  while (year * 12 + month <= endIndex) {
    result.push(`${year}-${pad2(month)}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return result;
}

/** 'YYYY-MM' → '2026년 9월' */
export function formatMonthLabel(key: string): string {
  const { year, month } = parseMonthKey(key);
  return `${year}년 ${month}월`;
}
