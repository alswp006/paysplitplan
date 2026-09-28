import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNextPayday, calculateDday } from "@/lib/dday";

describe("getNextPayday", () => {
  it("다음 달 25일이면 D-26", () => {
    const r = getNextPayday(new Date(2026, 8, 29), 25);
    expect(r.dday).toBe(26);
    expect(r.label).toBe("10월 25일 월급날");
    expect(r.nextPaydayDate).toEqual(new Date(2026, 9, 25));
  });

  it("payday가 말일보다 크면 말일로 당긴다", () => {
    const r = getNextPayday(new Date(2026, 8, 29), 31);
    expect(r.dday).toBe(1);
    expect(r.label).toBe("9월 30일 월급날");
  });

  it("오늘이 월급날이면 D-0", () => {
    const r = getNextPayday(new Date(2026, 8, 25, 18, 30), 25);
    expect(r.dday).toBe(0);
    expect(r.label).toBe("9월 25일 월급날");
  });

  it("같은 달에 월급날이 남아 있으면 그날", () => {
    const r = getNextPayday(new Date(2026, 8, 5), 10);
    expect(r.dday).toBe(5);
    expect(r.label).toBe("9월 10일 월급날");
  });

  it("평년·윤년 2월 말일", () => {
    expect(getNextPayday(new Date(2026, 1, 27), 31).nextPaydayDate).toEqual(new Date(2026, 1, 28));
    expect(getNextPayday(new Date(2024, 1, 28), 31).nextPaydayDate).toEqual(new Date(2024, 1, 29));
  });

  it("12월 말 이후는 다음 해 1월", () => {
    const r = getNextPayday(new Date(2026, 11, 30), 5);
    expect(r.nextPaydayDate).toEqual(new Date(2027, 0, 5));
    expect(r.dday).toBe(6);
  });
});

describe("calculateDday", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T18:30:00+09:00"));
  });

  it("미래 날짜는 남은 일수", () => {
    expect(calculateDday("2026-10-25")).toBe(26);
  });

  it("오늘은 0, 지난 날짜는 음수", () => {
    expect(calculateDday("2026-09-29")).toBe(0);
    expect(calculateDday("2026-09-27")).toBe(-2);
  });

  it("해석할 수 없거나 없는 날짜는 NaN", () => {
    expect(calculateDday("")).toBeNaN();
    expect(calculateDday("내일")).toBeNaN();
    expect(calculateDday("2026-02-31")).toBeNaN();
  });
});
