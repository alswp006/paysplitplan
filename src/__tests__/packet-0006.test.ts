import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Plan, MonthRecordMap, MonthRecord } from "@/lib/types";

// These functions will be implemented in src/lib/records.ts
// For now, we're writing tests that WILL FAIL (RED phase)

describe("월 기록 로직 (빈 달 채우기·체크 토글·최근 N개월)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC-1: ensureMonthRecords fills empty months from plan.createdAt to today", () => {
    it("AC-1[P0]: should fill 2026-07, 2026-08, 2026-09 with {checked:[], total:4, rate:0} when no records exist", () => {
      // This test will fail until ensureMonthRecords is implemented
      const plan: Plan = {
        version: 1,
        salary: 50000000,
        payday: 25,
        fixedCosts: [],
        presetId: "basic_5311",
        ratios: { living: 50, saving: 30, emergency: 10, leisure: 10 },
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-07-10T00:00:00.000Z",
      };

      const today = new Date(2026, 8, 23); // 2026-09-23
      const existing: MonthRecordMap = {};

      // ensureMonthRecords should fill empty months
      const { map, changed } = ensureMonthRecords(plan, today, existing);

      // Should have 3 months
      expect(Object.keys(map).length).toBe(3);
      expect(map["2026-07"]).toBeDefined();
      expect(map["2026-08"]).toBeDefined();
      expect(map["2026-09"]).toBeDefined();

      // Each month should have the correct structure
      expect(map["2026-07"].checked).toEqual([]);
      expect(map["2026-07"].total).toBe(4);
      expect(map["2026-07"].rate).toBe(0);
      expect(map["2026-07"].month).toBe("2026-07");

      expect(map["2026-08"].checked).toEqual([]);
      expect(map["2026-08"].total).toBe(4);
      expect(map["2026-08"].rate).toBe(0);

      expect(map["2026-09"].checked).toEqual([]);
      expect(map["2026-09"].total).toBe(4);
      expect(map["2026-09"].rate).toBe(0);

      expect(changed).toBe(true);
    });

    it("AC-1[P0]: should set updatedAt for each new record", () => {
      const plan: Plan = {
        version: 1,
        salary: 50000000,
        payday: 25,
        fixedCosts: [],
        presetId: "basic_5311",
        ratios: { living: 50, saving: 30, emergency: 10, leisure: 10 },
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-07-10T00:00:00.000Z",
      };

      const today = new Date(2026, 8, 23);
      const existing: MonthRecordMap = {};

      const { map } = ensureMonthRecords(plan, today, existing);

      // Each month should have updatedAt as ISO string
      expect(map["2026-07"].updatedAt).toBeDefined();
      expect(typeof map["2026-07"].updatedAt).toBe("string");
      expect(map["2026-07"].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("AC-1: should return changed=false when records already exist for all months", () => {
      const plan: Plan = {
        version: 1,
        salary: 50000000,
        payday: 25,
        fixedCosts: [],
        presetId: "basic_5311",
        ratios: { living: 50, saving: 30, emergency: 10, leisure: 10 },
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-07-10T00:00:00.000Z",
      };

      const today = new Date(2026, 8, 23);
      const existing: MonthRecordMap = {
        "2026-07": { month: "2026-07", checked: [], total: 4, rate: 0, updatedAt: "2026-09-23T00:00:00.000Z" },
        "2026-08": { month: "2026-08", checked: [], total: 4, rate: 0, updatedAt: "2026-09-23T00:00:00.000Z" },
        "2026-09": { month: "2026-09", checked: [], total: 4, rate: 0, updatedAt: "2026-09-23T00:00:00.000Z" },
      };

      const { map, changed } = ensureMonthRecords(plan, today, existing);

      expect(changed).toBe(false);
      expect(map).toEqual(existing);
    });
  });

  describe("AC-2: ensureMonthRecords recalculates current month and keeps past months unchanged", () => {
    it("AC-2[P0]: should remove leisure from checked when plan leisure ratio is 0", () => {
      const plan: Plan = {
        version: 1,
        salary: 50000000,
        payday: 25,
        fixedCosts: [],
        presetId: "custom",
        ratios: { living: 50, saving: 30, emergency: 20, leisure: 0 }, // leisure = 0
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-09-23T00:00:00.000Z",
      };

      const today = new Date(2026, 8, 23); // 2026-09-23
      const existing: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: ["living", "saving", "leisure"],
          total: 4,
          rate: 75,
          updatedAt: "2026-09-22T00:00:00.000Z",
        },
      };

      const { map, changed } = ensureMonthRecords(plan, today, existing);

      // Current month should have leisure removed from checked
      expect(map["2026-09"].checked).toEqual(["living", "saving"]);
      expect(map["2026-09"].total).toBe(3); // living, saving, emergency only
      expect(map["2026-09"].rate).toBe(67); // 2/3 = 66.67 → rounded to 67
      expect(changed).toBe(true);
    });

    it("AC-2[P0]: should keep past month records unchanged", () => {
      const plan: Plan = {
        version: 1,
        salary: 50000000,
        payday: 25,
        fixedCosts: [],
        presetId: "basic_5311",
        ratios: { living: 50, saving: 30, emergency: 10, leisure: 10 },
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-09-23T00:00:00.000Z",
      };

      const today = new Date(2026, 8, 23);
      const pastRecord: MonthRecord = {
        month: "2026-08",
        checked: ["living", "saving"],
        total: 4,
        rate: 50,
        updatedAt: "2026-08-31T00:00:00.000Z",
      };

      const existing: MonthRecordMap = {
        "2026-08": pastRecord,
        "2026-09": {
          month: "2026-09",
          checked: [],
          total: 4,
          rate: 0,
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      };

      const { map } = ensureMonthRecords(plan, today, existing);

      // Past month should be exactly the same object (deep equality)
      expect(map["2026-08"]).toEqual(pastRecord);
      expect(map["2026-08"].checked).toEqual(["living", "saving"]);
      expect(map["2026-08"].rate).toBe(50);
      expect(map["2026-08"].total).toBe(4);
    });

    it("AC-2: should recalculate rate correctly for current month", () => {
      const plan: Plan = {
        version: 1,
        salary: 50000000,
        payday: 25,
        fixedCosts: [],
        presetId: "custom",
        ratios: { living: 50, saving: 30, emergency: 10, leisure: 10 },
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-23T00:00:00.000Z",
      };

      const today = new Date(2026, 8, 23);
      const existing: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: ["living", "saving"],
          total: 4,
          rate: 50,
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      };

      const { map } = ensureMonthRecords(plan, today, existing);

      // Rate should be recalculated (2 checked out of 4 = 50%)
      expect(map["2026-09"].rate).toBe(50);
      expect(map["2026-09"].checked).toEqual(["living", "saving"]);
    });

    it("AC-2: should preserve past month when only current month is updated", () => {
      const plan: Plan = {
        version: 1,
        salary: 50000000,
        payday: 25,
        fixedCosts: [],
        presetId: "basic_5311",
        ratios: { living: 50, saving: 30, emergency: 10, leisure: 10 },
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-09-23T00:00:00.000Z",
      };

      const today = new Date(2026, 8, 23);
      const july: MonthRecord = {
        month: "2026-07",
        checked: ["living"],
        total: 4,
        rate: 25,
        updatedAt: "2026-07-31T00:00:00.000Z",
      };

      const existing: MonthRecordMap = {
        "2026-07": july,
        "2026-09": {
          month: "2026-09",
          checked: ["living", "saving", "emergency"],
          total: 4,
          rate: 75,
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      };

      const { map } = ensureMonthRecords(plan, today, existing);

      // July should be exactly unchanged
      expect(map["2026-07"]).toEqual(july);
      expect(map["2026-07"].rate).toBe(25);
      expect(map["2026-07"].updatedAt).toBe("2026-07-31T00:00:00.000Z");
    });
  });

  describe("AC-3: toggleCheck is immutable and toggles correctly", () => {
    it("AC-3[P0]: should toggle bucket in checked array", () => {
      const originalMap: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: ["living"],
          total: 4,
          rate: 25,
          updatedAt: "2026-09-23T00:00:00.000Z",
        },
      };

      const result = toggleCheck(originalMap, "2026-09", "saving");

      // Should add 'saving' to checked
      expect(result["2026-09"].checked).toContain("living");
      expect(result["2026-09"].checked).toContain("saving");
      expect(result["2026-09"].checked.length).toBe(2);
    });

    it("AC-3[P0]: should remove bucket when already checked", () => {
      const originalMap: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: ["living", "saving"],
          total: 4,
          rate: 50,
          updatedAt: "2026-09-23T00:00:00.000Z",
        },
      };

      const result = toggleCheck(originalMap, "2026-09", "saving");

      // Should remove 'saving' from checked
      expect(result["2026-09"].checked).toEqual(["living"]);
      expect(result["2026-09"].checked).not.toContain("saving");
    });

    it("AC-3[P0]: calling toggleCheck twice should restore original state", () => {
      const originalMap: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: ["living"],
          total: 4,
          rate: 25,
          updatedAt: "2026-09-23T00:00:00.000Z",
        },
      };

      const after1stToggle = toggleCheck(originalMap, "2026-09", "saving");
      const after2ndToggle = toggleCheck(after1stToggle, "2026-09", "saving");

      // Should return to original state
      expect(after2ndToggle["2026-09"].checked).toEqual(["living"]);
      expect(after2ndToggle["2026-09"].checked).toEqual(originalMap["2026-09"].checked);
    });

    it("AC-3[P0]: should not mutate input map object", () => {
      const originalMap: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: ["living"],
          total: 4,
          rate: 25,
          updatedAt: "2026-09-23T00:00:00.000Z",
        },
      };

      // Keep a reference to check immutability
      const originalChecked = originalMap["2026-09"].checked;

      const result = toggleCheck(originalMap, "2026-09", "saving");

      // Original map should not change
      expect(originalMap["2026-09"].checked).toEqual(["living"]);
      expect(originalMap["2026-09"].checked).toBe(originalChecked); // Same reference
      expect(originalMap["2026-09"].checked.length).toBe(1);

      // Result should be different
      expect(result["2026-09"].checked.length).toBe(2);
      expect(result["2026-09"].checked).not.toBe(originalChecked);
    });

    it("AC-3: should return new map object (not mutated input)", () => {
      const originalMap: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: ["living"],
          total: 4,
          rate: 25,
          updatedAt: "2026-09-23T00:00:00.000Z",
        },
      };

      const result = toggleCheck(originalMap, "2026-09", "saving");

      // Should be different objects
      expect(result).not.toBe(originalMap);
      expect(result["2026-09"]).not.toBe(originalMap["2026-09"]);
      expect(result["2026-09"].checked).not.toBe(originalMap["2026-09"].checked);
    });

    it("AC-3: should update rate when toggling", () => {
      const originalMap: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: ["living"],
          total: 4,
          rate: 25,
          updatedAt: "2026-09-23T00:00:00.000Z",
        },
      };

      const result = toggleCheck(originalMap, "2026-09", "saving");

      // Rate should be updated (2/4 = 50%)
      expect(result["2026-09"].rate).toBe(50);
    });
  });

  describe("recentMonths filters records by count and date", () => {
    it("should return N most recent months in descending order", () => {
      const map: MonthRecordMap = {
        "2026-07": { month: "2026-07", checked: [], total: 4, rate: 0, updatedAt: "2026-07-31T00:00:00.000Z" },
        "2026-08": { month: "2026-08", checked: ["living"], total: 4, rate: 25, updatedAt: "2026-08-31T00:00:00.000Z" },
        "2026-09": { month: "2026-09", checked: ["living", "saving"], total: 4, rate: 50, updatedAt: "2026-09-23T00:00:00.000Z" },
      };

      const today = new Date(2026, 8, 23);
      const result = recentMonths(map, today, 2);

      // Should return 2 most recent months
      expect(result.length).toBe(2);
      expect(result[0]).toBe("2026-09");
      expect(result[1]).toBe("2026-08");
    });

    it("should return fewer months if not enough exist", () => {
      const map: MonthRecordMap = {
        "2026-09": { month: "2026-09", checked: ["living"], total: 4, rate: 25, updatedAt: "2026-09-23T00:00:00.000Z" },
      };

      const today = new Date(2026, 8, 23);
      const result = recentMonths(map, today, 6);

      // Should return only 1 month (all we have)
      expect(result.length).toBe(1);
      expect(result[0]).toBe("2026-09");
    });

    it("should return months in descending order (newest first)", () => {
      const map: MonthRecordMap = {
        "2026-05": { month: "2026-05", checked: [], total: 4, rate: 0, updatedAt: "2026-05-31T00:00:00.000Z" },
        "2026-07": { month: "2026-07", checked: [], total: 4, rate: 0, updatedAt: "2026-07-31T00:00:00.000Z" },
        "2026-06": { month: "2026-06", checked: ["living"], total: 4, rate: 25, updatedAt: "2026-06-30T00:00:00.000Z" },
        "2026-09": { month: "2026-09", checked: ["living", "saving"], total: 4, rate: 50, updatedAt: "2026-09-23T00:00:00.000Z" },
      };

      const today = new Date(2026, 8, 23);
      const result = recentMonths(map, today, 3);

      expect(result.length).toBe(3);
      expect(result[0]).toBe("2026-09"); // newest
      expect(result[1]).toBe("2026-07");
      expect(result[2]).toBe("2026-06"); // oldest of the 3
    });
  });

  describe("Edge cases and special scenarios", () => {
    it("should handle single month with all buckets checked", () => {
      const plan: Plan = {
        version: 1,
        salary: 50000000,
        payday: 25,
        fixedCosts: [],
        presetId: "basic_5311",
        ratios: { living: 50, saving: 30, emergency: 10, leisure: 10 },
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-23T00:00:00.000Z",
      };

      const today = new Date(2026, 8, 23);
      const existing: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: ["living", "saving", "emergency", "leisure"],
          total: 4,
          rate: 100,
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      };

      const { map } = ensureMonthRecords(plan, today, existing);

      expect(map["2026-09"].checked.length).toBe(4);
      expect(map["2026-09"].rate).toBe(100);
    });

    it("should handle current month with zero total (all ratios 0)", () => {
      const plan: Plan = {
        version: 1,
        salary: 50000000,
        payday: 25,
        fixedCosts: [],
        presetId: "custom",
        ratios: { living: 0, saving: 0, emergency: 0, leisure: 0 },
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-23T00:00:00.000Z",
      };

      const today = new Date(2026, 8, 23);
      const existing: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: ["living", "saving"],
          total: 4,
          rate: 50,
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      };

      const { map } = ensureMonthRecords(plan, today, existing);

      // Should clear checked when total becomes 0
      expect(map["2026-09"].checked).toEqual([]);
      expect(map["2026-09"].total).toBe(0);
      expect(map["2026-09"].rate).toBe(0);
    });

    it("should return empty array for recentMonths when map is empty", () => {
      const map: MonthRecordMap = {};
      const today = new Date(2026, 8, 23);
      const result = recentMonths(map, today, 6);

      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    it("should handle toggleCheck on non-existent month by creating it", () => {
      const originalMap: MonthRecordMap = {};

      const result = toggleCheck(originalMap, "2026-09", "saving");

      // Should create the month if it doesn't exist
      expect(result["2026-09"]).toBeDefined();
      expect(result["2026-09"].checked).toContain("saving");
    });

    it("should respect checked order consistency", () => {
      const originalMap: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: [],
          total: 4,
          rate: 0,
          updatedAt: "2026-09-23T00:00:00.000Z",
        },
      };

      let result = originalMap;
      result = toggleCheck(result, "2026-09", "living");
      result = toggleCheck(result, "2026-09", "saving");
      result = toggleCheck(result, "2026-09", "emergency");

      // Checked should have items in some consistent order
      expect(result["2026-09"].checked.length).toBe(3);
      expect(result["2026-09"].checked).toContain("living");
      expect(result["2026-09"].checked).toContain("saving");
      expect(result["2026-09"].checked).toContain("emergency");
    });
  });

  describe("Integration: ensureMonthRecords + toggleCheck workflow", () => {
    it("should allow full workflow: ensure → toggle → recalculate", () => {
      const plan: Plan = {
        version: 1,
        salary: 50000000,
        payday: 25,
        fixedCosts: [],
        presetId: "basic_5311",
        ratios: { living: 50, saving: 30, emergency: 10, leisure: 10 },
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-23T00:00:00.000Z",
      };

      const today = new Date(2026, 8, 23);

      // Step 1: Ensure records exist
      const { map: ensuredMap } = ensureMonthRecords(plan, today, {});
      expect(ensuredMap["2026-09"].checked).toEqual([]);
      expect(ensuredMap["2026-09"].rate).toBe(0);

      // Step 2: Toggle checks
      let workingMap = ensuredMap;
      workingMap = toggleCheck(workingMap, "2026-09", "living");
      expect(workingMap["2026-09"].checked).toEqual(["living"]);
      expect(workingMap["2026-09"].rate).toBe(25);

      workingMap = toggleCheck(workingMap, "2026-09", "saving");
      expect(workingMap["2026-09"].checked).toContain("living");
      expect(workingMap["2026-09"].checked).toContain("saving");
      expect(workingMap["2026-09"].rate).toBe(50);

      // Original ensuredMap should not be mutated
      expect(ensuredMap["2026-09"].checked).toEqual([]);
    });
  });
});

// Mock function declarations (to be implemented)
declare function ensureMonthRecords(
  plan: Plan,
  today: Date,
  existing: MonthRecordMap
): { map: MonthRecordMap; changed: boolean };

declare function toggleCheck(map: MonthRecordMap, monthKey: string, bucket: string): MonthRecordMap;

declare function recentMonths(map: MonthRecordMap, today: Date, count: number): string[];
