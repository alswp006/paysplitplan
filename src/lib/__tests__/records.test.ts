import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ensureMonthRecords, toggleCheck, recentMonths } from "@/lib/records";
import type { Plan, MonthRecordMap } from "@/lib/types";

const basePlan: Plan = {
  version: 1,
  salary: 50_000_000,
  fixedCosts: [],
  payday: 25,
  presetId: "basic_5311",
  ratios: { living: 50, saving: 30, emergency: 10, leisure: 10 },
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z",
};

describe("records", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 8, 23) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("ensureMonthRecords", () => {
    it("AC-1: createdAt 달부터 이번 달까지 빈 달을 채운다", () => {
      const today = new Date(2026, 8, 23);
      const { map, changed } = ensureMonthRecords(basePlan, today, {});

      expect(Object.keys(map).sort()).toEqual(["2026-07", "2026-08", "2026-09"]);
      expect(map["2026-07"]).toEqual({
        month: "2026-07",
        checked: [],
        total: 4,
        rate: 0,
        updatedAt: expect.any(String),
      });
      expect(map["2026-08"].total).toBe(4);
      expect(map["2026-09"].total).toBe(4);
      expect(changed).toBe(true);
    });

    it("AC-2: 이번 달 비율이 0이 된 칸의 체크를 지우고 rate를 다시 계산한다", () => {
      const today = new Date(2026, 8, 23);
      const plan: Plan = {
        ...basePlan,
        ratios: { living: 50, saving: 30, emergency: 20, leisure: 0 },
      };
      const existing: MonthRecordMap = {
        "2026-07": { month: "2026-07", checked: ["living"], total: 4, rate: 25, updatedAt: "2026-07-31T00:00:00.000Z" },
        "2026-08": { month: "2026-08", checked: ["living", "saving"], total: 4, rate: 50, updatedAt: "2026-08-31T00:00:00.000Z" },
        "2026-09": { month: "2026-09", checked: ["living", "saving", "leisure"], total: 4, rate: 75, updatedAt: "2026-09-01T00:00:00.000Z" },
      };

      const { map, changed } = ensureMonthRecords(plan, today, existing);

      expect(map["2026-09"].checked).toEqual(["living", "saving"]);
      expect(map["2026-09"].total).toBe(3);
      expect(map["2026-09"].rate).toBe(67);
      expect(changed).toBe(true);

      // 과거 달은 원래 객체와 deepEqual
      expect(map["2026-07"]).toEqual(existing["2026-07"]);
      expect(map["2026-08"]).toEqual(existing["2026-08"]);
    });

    it("changed=false when nothing to fill or recalculate", () => {
      const today = new Date(2026, 8, 23);
      const existing: MonthRecordMap = {
        "2026-07": { month: "2026-07", checked: [], total: 4, rate: 0, updatedAt: "2026-09-23T00:00:00.000Z" },
        "2026-08": { month: "2026-08", checked: [], total: 4, rate: 0, updatedAt: "2026-09-23T00:00:00.000Z" },
        "2026-09": { month: "2026-09", checked: [], total: 4, rate: 0, updatedAt: "2026-09-23T00:00:00.000Z" },
      };

      const { map, changed } = ensureMonthRecords(basePlan, today, existing);

      expect(changed).toBe(false);
      expect(map).toEqual(existing);
    });
  });

  describe("toggleCheck", () => {
    it("AC-3: 두 번 호출하면 원래 checked로 돌아오고 입력 map은 변경되지 않는다", () => {
      const map: MonthRecordMap = {
        "2026-09": { month: "2026-09", checked: ["living"], total: 4, rate: 25, updatedAt: "2026-09-23T00:00:00.000Z" },
      };
      const originalChecked = map["2026-09"].checked;

      const once = toggleCheck(map, "2026-09", "saving");
      const twice = toggleCheck(once, "2026-09", "saving");

      expect(twice["2026-09"].checked).toEqual(["living"]);
      expect(map["2026-09"].checked).toBe(originalChecked);
      expect(map["2026-09"].checked).toEqual(["living"]);
    });
  });

  describe("recentMonths", () => {
    it("최근 N개월을 최신순으로 반환한다", () => {
      const map: MonthRecordMap = {
        "2026-06": { month: "2026-06", checked: [], total: 4, rate: 0, updatedAt: "2026-06-30T00:00:00.000Z" },
        "2026-07": { month: "2026-07", checked: [], total: 4, rate: 0, updatedAt: "2026-07-31T00:00:00.000Z" },
        "2026-08": { month: "2026-08", checked: [], total: 4, rate: 0, updatedAt: "2026-08-31T00:00:00.000Z" },
        "2026-09": { month: "2026-09", checked: [], total: 4, rate: 0, updatedAt: "2026-09-23T00:00:00.000Z" },
      };
      const today = new Date(2026, 8, 23);

      expect(recentMonths(map, today, 6)).toEqual(["2026-09", "2026-08", "2026-07", "2026-06"]);
    });
  });
});
