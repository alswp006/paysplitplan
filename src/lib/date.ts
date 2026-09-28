/** 오늘(기기 로컬). 테스트에서 mock한다. */
export function getToday(): Date {
  return new Date();
}

/** 저장 엔티티의 createdAt/updatedAt/completedAt은 이 함수로만 만든다. */
export function nowIso(): string {
  return getToday().toISOString();
}

export function isIsoTimestamp(x: unknown): x is string {
  return typeof x === "string" && x !== "" && !Number.isNaN(Date.parse(x));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date를 로컬 기준 'YYYY-MM'으로 */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** 'YYYY-MM'에 n개월을 더한다(음수 가능) */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  return `${year}-${pad2((total - year * 12) + 1)}`;
}

export type DateFormat = "YYYY-MM-DD" | "M/D" | "MMM D";

/** 'YYYY-MM-DD'는 UTC가 아니라 기기 로컬 자정으로 해석한다(하루 밀림 방지). 해석 못 하면 null. */
function toLocalDate(input: string | Date): Date | null {
  let d: Date;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
    d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(input);
  } else {
    return null;
  }
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 날짜 표시 포맷. 해석할 수 없는 값은 ''. 'MMM D'는 한국어 화면이라 "9월 29일"로 낸다. */
export function formatDate(date: string | Date, format: DateFormat = "YYYY-MM-DD"): string {
  const d = toLocalDate(date);
  if (!d) return "";
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (format === "M/D") return `${month}/${day}`;
  if (format === "MMM D") return `${month}월 ${day}일`;
  return `${d.getFullYear()}-${pad2(month)}-${pad2(day)}`;
}
