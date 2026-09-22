import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Plan, MonthRecord, MonthRecordMap, SaveResult } from "@/lib/types";
import { loadPlan, isPlanCorrupted, savePlan, loadRecords, saveRecords } from "@/lib/storage";

describe("localStorage 저장소 (예외 없는 SaveResult)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // AC-1: savePlan과 loadPlan 라운드트립 테스트
  describe("AC-1: Plan 저장 및 로드 라운드트립", () => {
    it("AC-1[P0]: savePlan은 Plan을 localStorage에 저장하고 loadPlan은 동일한 값을 반환한다", () => {
      const testPlan: Plan = {
        version: 1,
        salary: 50000000,
        fixedCosts: [
          { id: "rent", name: "월세", amount: 1500000 },
          { id: "utilities", name: "공과금", amount: 300000 },
        ],
        payday: 15,
        presetId: "default",
        ratios: { savings: 0.3, food: 0.2, transport: 0.1 },
        createdAt: "2026-09-23T00:00:00Z",
        updatedAt: "2026-09-23T10:00:00Z",
      };

      const result = savePlan(testPlan);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.plan).toEqual(testPlan);
      }

      const loaded = loadPlan();
      expect(loaded).toEqual(testPlan);

      const rawJson = localStorage.getItem("psp.plan.v1");
      expect(rawJson).toBeDefined();
      const parsed = JSON.parse(rawJson!);
      expect(parsed).toEqual(testPlan);
    });

    it("AC-1[P0]: savePlan은 기존 Plan을 덮어쓴다", () => {
      const plan1: Plan = {
        version: 1,
        salary: 40000000,
        fixedCosts: [],
        payday: 1,
        presetId: "default",
        ratios: {},
        createdAt: "2026-09-20T00:00:00Z",
        updatedAt: "2026-09-20T00:00:00Z",
      };

      savePlan(plan1);
      expect(loadPlan()).toEqual(plan1);

      const plan2: Plan = {
        version: 1,
        salary: 60000000,
        fixedCosts: [{ id: "test", name: "테스트", amount: 100000 }],
        payday: 25,
        presetId: "custom",
        ratios: { a: 1 },
        createdAt: "2026-09-21T00:00:00Z",
        updatedAt: "2026-09-21T00:00:00Z",
      };

      savePlan(plan2);
      expect(loadPlan()).toEqual(plan2);
      expect(loadPlan()).not.toEqual(plan1);
    });
  });

  // AC-2: 손상된 데이터 처리
  describe("AC-2: 손상된 데이터 처리", () => {
    it("AC-2[P0]: psp.plan.v1이 손상된 JSON이면 loadPlan은 null을 반환한다", () => {
      localStorage.setItem("psp.plan.v1", "{broken");
      const result = loadPlan();
      expect(result).toBeNull();
    });

    it("AC-2[P0]: 손상된 Plan JSON일 때 isPlanCorrupted는 true를 반환한다", () => {
      localStorage.setItem("psp.plan.v1", "{broken");
      expect(isPlanCorrupted()).toBe(true);
    });

    it("AC-2[P1]: 유효한 Plan JSON일 때 isPlanCorrupted는 false를 반환한다", () => {
      const plan: Plan = {
        version: 1,
        salary: 50000000,
        fixedCosts: [],
        payday: 15,
        presetId: "default",
        ratios: {},
        createdAt: "2026-09-23T00:00:00Z",
        updatedAt: "2026-09-23T00:00:00Z",
      };
      savePlan(plan);
      expect(isPlanCorrupted()).toBe(false);
    });

    it("AC-2[P1]: localStorage에 psp.plan.v1이 없을 때 isPlanCorrupted는 false를 반환한다", () => {
      expect(isPlanCorrupted()).toBe(false);
    });

    it("AC-2[P1]: psp.records.v1이 손상되면 loadRecords는 빈 객체를 반환한다", () => {
      localStorage.setItem("psp.records.v1", "[bad");
      const result = loadRecords();
      expect(result).toEqual({});
    });

    it("AC-2[P1]: loadRecords는 throw하지 않고 빈 객체를 반환한다", () => {
      localStorage.setItem("psp.records.v1", "invalid json {{{");
      expect(() => {
        const result = loadRecords();
        expect(result).toEqual({});
      }).not.toThrow();
    });
  });

  // AC-3: QuotaExceededError 처리 및 월 회전
  describe("AC-3: QuotaExceededError 처리 및 월 제한 (36개월)", () => {
    it("AC-3[P0]: QuotaExceededError 발생 시 savePlan은 {ok:false, reason:'quota'}를 반환한다", () => {
      const testPlan: Plan = {
        version: 1,
        salary: 50000000,
        fixedCosts: [],
        payday: 15,
        presetId: "default",
        ratios: {},
        createdAt: "2026-09-23T00:00:00Z",
        updatedAt: "2026-09-23T00:00:00Z",
      };

      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        const err = new DOMException("QuotaExceededError", "QuotaExceededError");
        throw err;
      });

      const result = savePlan(testPlan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("quota");
      }

      Storage.prototype.setItem = originalSetItem;
    });

    it("AC-3[P0]: saveRecords는 37개월 중 가장 오래된 키를 제거하고 36개만 유지한다", () => {
      const records: MonthRecordMap = {};
      // Manually create 37 consecutive months from 2023-01 to 2026-01
      const months = [
        "2023-01", "2023-02", "2023-03", "2023-04", "2023-05", "2023-06",
        "2023-07", "2023-08", "2023-09", "2023-10", "2023-11", "2023-12",
        "2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06",
        "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12",
        "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
        "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
        "2026-01",
      ];
      months.forEach((month, i) => {
        records[month] = {
          month,
          checked: [],
          total: 100000 * (i + 1),
          rate: 0.5,
          updatedAt: new Date().toISOString(),
        };
      });

      const result = saveRecords(records);
      expect(result.ok).toBe(true);

      const loaded = loadRecords();
      expect(Object.keys(loaded).length).toBe(36);

      const loadedMonths = Object.keys(loaded).sort();
      expect(loadedMonths[0]).toBe("2023-02");
      expect(loadedMonths[loadedMonths.length - 1]).toBe("2026-01");
      expect(loaded["2023-01"]).toBeUndefined();
    });

    it("AC-3[P1]: saveRecords는 36개 이하의 월이면 모두 유지한다", () => {
      const records: MonthRecordMap = {};
      for (let i = 0; i < 36; i++) {
        const month = new Date(2023, i, 1).toISOString().slice(0, 7);
        records[month] = {
          month,
          checked: [],
          total: 100000,
          rate: 0.5,
          updatedAt: new Date(2023, i, 1).toISOString(),
        };
      }

      const result = saveRecords(records);
      expect(result.ok).toBe(true);

      const loaded = loadRecords();
      expect(Object.keys(loaded).length).toBe(36);
    });

    it("AC-3[P1]: saveRecords는 빈 MonthRecordMap을 저장할 수 있다", () => {
      const records: MonthRecordMap = {};
      const result = saveRecords(records);
      expect(result.ok).toBe(true);

      const loaded = loadRecords();
      expect(loaded).toEqual({});
    });

    it("AC-3[P1]: saveRecords에서 QuotaExceededError 발생 시 {ok:false, reason:'quota'}를 반환한다", () => {
      const records: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: ["bucket1"],
          total: 100000,
          rate: 0.5,
          updatedAt: "2026-09-23T00:00:00Z",
        },
      };

      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        const err = new DOMException("QuotaExceededError", "QuotaExceededError");
        throw err;
      });

      const result = saveRecords(records);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("quota");
      }

      Storage.prototype.setItem = originalSetItem;
    });
  });

  // AC-1 추가 테스트: loadPlan 엣지 케이스
  describe("AC-1 추가: loadPlan 엣지 케이스", () => {
    it("AC-1[P1]: loadPlan은 localStorage에 데이터가 없으면 null을 반환한다", () => {
      const result = loadPlan();
      expect(result).toBeNull();
    });

    it("AC-1[P1]: 여러 번 호출해도 일관된 값을 반환한다", () => {
      const testPlan: Plan = {
        version: 1,
        salary: 50000000,
        fixedCosts: [{ id: "id", name: "name", amount: 1000 }],
        payday: 15,
        presetId: "default",
        ratios: { test: 0.5 },
        createdAt: "2026-09-23T00:00:00Z",
        updatedAt: "2026-09-23T00:00:00Z",
      };

      savePlan(testPlan);
      const first = loadPlan();
      const second = loadPlan();
      const third = loadPlan();

      expect(first).toEqual(second);
      expect(second).toEqual(third);
      expect(first).toEqual(testPlan);
    });
  });

  // AC-2 추가 테스트: loadRecords 엣지 케이스
  describe("AC-2 추가: loadRecords 엣지 케이스", () => {
    it("AC-2[P1]: loadRecords는 localStorage에 데이터가 없으면 빈 객체를 반환한다", () => {
      const result = loadRecords();
      expect(result).toEqual({});
    });

    it("AC-2[P1]: 유효한 MonthRecordMap을 저장하고 로드할 수 있다", () => {
      const records: MonthRecordMap = {
        "2026-09": {
          month: "2026-09",
          checked: ["bucket1", "bucket2"],
          total: 500000,
          rate: 0.8,
          updatedAt: "2026-09-23T12:00:00Z",
        },
        "2026-08": {
          month: "2026-08",
          checked: ["bucket1"],
          total: 300000,
          rate: 0.6,
          updatedAt: "2026-08-23T12:00:00Z",
        },
      };

      const result = saveRecords(records);
      expect(result.ok).toBe(true);

      const loaded = loadRecords();
      expect(loaded).toEqual(records);
      expect(Object.keys(loaded).length).toBe(2);
      expect(loaded["2026-09"]).toEqual(records["2026-09"]);
    });
  });

  // AC-3 추가 테스트: 월 정렬 및 회전 동작
  describe("AC-3 추가: 월 정렬 및 정확한 회전", () => {
    it("AC-3[P1]: 저장할 때 월 키를 정렬하고 36개월 초과분은 제거한다", () => {
      const records: MonthRecordMap = {};

      // 혼란스러운 순서로 데이터 추가
      const months = ["2025-12", "2024-01", "2026-09", "2023-06", "2024-06"];
      months.forEach((month) => {
        records[month] = {
          month,
          checked: [],
          total: 100000,
          rate: 0.5,
          updatedAt: "2026-09-23T00:00:00Z",
        };
      });

      saveRecords(records);
      const loaded = loadRecords();

      const keys = Object.keys(loaded);
      expect(keys).toEqual(keys.sort());
    });

    it("AC-3[P1]: 정확히 36개월을 초과할 때 가장 오래된 1개월을 제거한다", () => {
      const records: MonthRecordMap = {};

      // 36개월 유효한 데이터 생성 (2023-01 ~ 2025-12)
      const first36Months = [
        "2023-01", "2023-02", "2023-03", "2023-04", "2023-05", "2023-06",
        "2023-07", "2023-08", "2023-09", "2023-10", "2023-11", "2023-12",
        "2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06",
        "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12",
        "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
        "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
      ];
      first36Months.forEach((month) => {
        records[month] = {
          month,
          checked: [],
          total: 100000,
          rate: 0.5,
          updatedAt: new Date().toISOString(),
        };
      });

      saveRecords(records);
      let loaded = loadRecords();
      expect(Object.keys(loaded).length).toBe(36);

      // 새로운 37번째 월 추가
      records["2026-01"] = {
        month: "2026-01",
        checked: [],
        total: 999999,
        rate: 0.99,
        updatedAt: "2026-01-01T00:00:00Z",
      };

      saveRecords(records);
      loaded = loadRecords();

      expect(Object.keys(loaded).length).toBe(36);
      expect(loaded["2026-01"]).toBeDefined();
      expect(loaded["2023-01"]).toBeUndefined();
    });
  });
});
