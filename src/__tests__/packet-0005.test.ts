import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getDday,
  formatDday,
  monthRange,
  formatMonthLabel,
  lastDayOfMonth,
  getNextPayday,
  toMonthKey,
} from "@/lib/date";

describe("날짜·D-day 함수 (기기 로컬 시간)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC-1: getDday calculation from fixed reference date", () => {
    it("AC-1[P0]: getDday(25) returns 2 when today is 2026-09-23", () => {
      const today = new Date(2026, 8, 23); // 2026-09-23
      const result = getDday(25, today);
      expect(result).toBe(2);
      expect(typeof result).toBe("number");
    });

    it("AC-1[P0]: getDday(23) returns 0 when today is 2026-09-23 (same day)", () => {
      const today = new Date(2026, 8, 23);
      const result = getDday(23, today);
      expect(result).toBe(0);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("AC-1[P0]: getDday(20) returns 27 when today is 2026-09-23 (past date)", () => {
      const today = new Date(2026, 8, 23); // 2026-09-23
      const result = getDday(20, today);
      // 9월 20일은 이미 지났으므로 다음달(10월) 20일까지 계산
      // 9월 23일 ~ 10월 20일 = 27일
      expect(result).toBe(27);
    });

    it("AC-1[P0]: getDday(31) returns 7 when today is 2026-09-23", () => {
      const today = new Date(2026, 8, 23);
      const result = getDday(31, today);
      // 9월은 30일까지이므로 (9월 31일 없음) 9월 30일까지 7일
      expect(result).toBe(7);
    });

    it("AC-1: getDday handles last day of month correctly", () => {
      const today = new Date(2026, 8, 23); // 2026-09-23
      const resultDay30 = getDday(30, today);
      expect(resultDay30).toBe(7);
      expect(resultDay30).toBeGreaterThan(0);
    });
  });

  describe("AC-2: monthRange produces consecutive month keys", () => {
    it("AC-2[P0]: monthRange('2026-07','2026-09') returns 3 consecutive months", () => {
      const result = monthRange("2026-07", "2026-09");
      expect(result).toEqual(["2026-07", "2026-08", "2026-09"]);
      expect(result.length).toBe(3);
      expect(result[0]).toBe("2026-07");
      expect(result[result.length - 1]).toBe("2026-09");
    });

    it("AC-2[P0]: monthRange works across year boundary", () => {
      const result = monthRange("2025-12", "2026-01");
      expect(result.length).toBe(2);
      expect(result).toEqual(["2025-12", "2026-01"]);
      expect(result[0]).toBe("2025-12");
      expect(result[1]).toBe("2026-01");
    });

    it("AC-2: monthRange with same start and end month returns single element", () => {
      const result = monthRange("2026-09", "2026-09");
      expect(result).toEqual(["2026-09"]);
      expect(result.length).toBe(1);
    });

    it("AC-2: monthRange across multiple years", () => {
      const result = monthRange("2025-11", "2026-02");
      expect(result.length).toBe(4);
      expect(result[0]).toBe("2025-11");
      expect(result[result.length - 1]).toBe("2026-02");
    });
  });

  describe("AC-3: formatDday and formatMonthLabel formatting", () => {
    it("AC-3[P0]: formatDday(0) returns 'D-DAY'", () => {
      const result = formatDday(0);
      expect(result).toBe("D-DAY");
      expect(typeof result).toBe("string");
    });

    it("AC-3[P0]: formatDday(5) returns 'D-5'", () => {
      const result = formatDday(5);
      expect(result).toBe("D-5");
      expect(result).toContain("D-");
    });

    it("AC-3[P0]: formatMonthLabel('2026-09') returns '2026년 9월'", () => {
      const result = formatMonthLabel("2026-09");
      expect(result).toBe("2026년 9월");
      expect(result).toContain("2026");
      expect(result).toContain("9월");
    });

    it("AC-3: formatDday with various numbers", () => {
      expect(formatDday(1)).toBe("D-1");
      expect(formatDday(10)).toBe("D-10");
      expect(formatDday(30)).toBe("D-30");
    });

    it("AC-3: formatMonthLabel with different months", () => {
      expect(formatMonthLabel("2026-01")).toContain("1월");
      expect(formatMonthLabel("2026-12")).toContain("12월");
    });
  });

  describe("Helper functions: lastDayOfMonth, getNextPayday, toMonthKey", () => {
    it("lastDayOfMonth returns correct last day for each month", () => {
      // September 2026 has 30 days
      expect(lastDayOfMonth(2026, 8)).toBe(30);
      // February 2026 (not leap year) has 28 days
      expect(lastDayOfMonth(2026, 1)).toBe(28);
      // December has 31 days
      expect(lastDayOfMonth(2026, 11)).toBe(31);
    });

    it("getNextPayday returns correct next payday", () => {
      const today = new Date(2026, 8, 23); // 2026-09-23
      // Payday on 25th is coming up
      const nextPayday25 = getNextPayday(25, today);
      expect(nextPayday25.getDate()).toBe(25);
      expect(nextPayday25.getMonth()).toBe(8); // September

      // Payday on 20th is past, so next is October 20th
      const nextPayday20 = getNextPayday(20, today);
      expect(nextPayday20.getDate()).toBe(20);
      expect(nextPayday20.getMonth()).toBe(9); // October
    });

    it("toMonthKey formats year and month to YYYY-MM string", () => {
      const result = toMonthKey(2026, 8);
      expect(result).toBe("2026-09");
      expect(result.length).toBe(7);
      expect(result).toMatch(/^\d{4}-\d{2}$/);
    });

    it("toMonthKey handles single digit months correctly (zero-padded)", () => {
      expect(toMonthKey(2026, 0)).toBe("2026-01");
      expect(toMonthKey(2026, 11)).toBe("2026-12");
    });
  });

  describe("Edge cases and boundary conditions", () => {
    it("getDday returns 0 on exact paycheck date", () => {
      const today = new Date(2026, 8, 20);
      const result = getDday(20, today);
      expect(result).toBe(0);
    });

    it("getDday handles end-of-month payday when month is shorter", () => {
      // February doesn't have 31 days
      const today = new Date(2026, 1, 15); // 2026-02-15
      const result = getDday(31, today);
      // Should count to February 28
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe("number");
    });

    it("monthRange preserves month order with mixed single/double digit months", () => {
      const result = monthRange("2026-01", "2026-12");
      expect(result.length).toBe(12);
      expect(result[0]).toBe("2026-01");
      expect(result[9]).toBe("2026-10");
      expect(result[11]).toBe("2026-12");
    });

    it("getDday with payDay=23 and today=23 returns 0", () => {
      const today = new Date(2026, 8, 23);
      expect(getDday(23, today)).toBe(0);
    });
  });

  describe("Integration: getDday with getNextPayday consistency", () => {
    it("getDday and getNextPayday should be consistent", () => {
      const today = new Date(2026, 8, 23);
      const payDay = 20;
      const daysUntil = getDday(payDay, today);
      const nextPayday = getNextPayday(payDay, today);

      // Calculate days difference
      const diff = (nextPayday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      const roundedDiff = Math.round(diff);

      expect(daysUntil).toBe(roundedDiff);
    });
  });
});
