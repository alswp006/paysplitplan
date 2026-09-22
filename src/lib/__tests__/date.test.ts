import { describe, it, expect } from "vitest";
import {
  lastDayOfMonth,
  getNextPayday,
  getDday,
  formatDday,
  getDdayString,
  toMonthKey,
  monthRange,
  formatMonthLabel,
} from "@/lib/date";

describe("lastDayOfMonth", () => {
  it("2026년 9월(0-indexed 8)의 말일은 30일", () => {
    expect(lastDayOfMonth(2026, 8)).toBe(30);
  });

  it("2026년 2월(0-indexed 1)의 말일은 28일", () => {
    expect(lastDayOfMonth(2026, 1)).toBe(28);
  });
});

describe("getDday", () => {
  const today = new Date(2026, 8, 23); // 2026-09-23

  it("AC-1: getDday(25) === 2", () => {
    expect(getDday(25, today)).toBe(2);
  });

  it("AC-1: getDday(23) === 0 (당일)", () => {
    expect(getDday(23, today)).toBe(0);
  });

  it("AC-1: getDday(20) === 27 (이번 달 지나서 다음 달로)", () => {
    expect(getDday(20, today)).toBe(27);
  });

  it("AC-1: getDday(31) === 7 (9월엔 31일이 없어 말일 30일로 대체)", () => {
    expect(getDday(31, today)).toBe(7);
  });
});

describe("getNextPayday", () => {
  it("payday가 해당 월에 없으면 말일로 대체한다", () => {
    const today = new Date(2026, 8, 23); // 9월 23일, 9월은 30일까지
    const next = getNextPayday(31, today);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(8);
    expect(next.getDate()).toBe(30);
  });
});

describe("monthRange", () => {
  it("AC-2: 같은 해 내 범위", () => {
    expect(monthRange("2026-07", "2026-09")).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("AC-2: 연말→연초 범위 길이는 2", () => {
    const result = monthRange("2025-12", "2026-01");
    expect(result).toHaveLength(2);
    expect(result).toEqual(["2025-12", "2026-01"]);
  });
});

describe("formatDday", () => {
  it("AC-3: formatDday(0) === 'D-DAY'", () => {
    expect(formatDday(0)).toBe("D-DAY");
  });

  it("AC-3: formatDday(5) === 'D-5'", () => {
    expect(formatDday(5)).toBe("D-5");
  });

  it("음수는 D+n 형식", () => {
    expect(formatDday(-3)).toBe("D+3");
  });
});

describe("getDdayString", () => {
  const today = new Date(2026, 8, 23); // 2026-09-23

  it("미래 날짜는 'YYYY-MM-DD' 형식으로 받아 D-n을 반환한다", () => {
    expect(getDdayString("2026-09-25", today)).toBe("D-2");
  });

  it("오늘 날짜면 D-DAY를 반환한다", () => {
    expect(getDdayString("2026-09-23", today)).toBe("D-DAY");
  });

  it("지난 날짜는 D+n을 반환한다", () => {
    expect(getDdayString("2026-09-20", today)).toBe("D+3");
  });

  it("ISO datetime 문자열도 날짜 부분만 사용한다", () => {
    expect(getDdayString("2026-09-25T00:00:00.000Z", today)).toBe("D-2");
  });
});

describe("toMonthKey", () => {
  it("year/month(0-indexed)를 'YYYY-MM'으로 변환한다", () => {
    expect(toMonthKey(2026, 8)).toBe("2026-09");
  });

  it("한 자리 월은 0으로 패딩한다", () => {
    expect(toMonthKey(2026, 0)).toBe("2026-01");
  });
});

describe("formatMonthLabel", () => {
  it("AC-3: formatMonthLabel('2026-09') === '2026년 9월'", () => {
    expect(formatMonthLabel("2026-09")).toBe("2026년 9월");
  });
});
