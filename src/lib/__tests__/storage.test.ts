import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Plan, MonthRecord } from "@/lib/types";
import {
  loadPlan,
  isPlanCorrupted,
  savePlan,
  saveMonthRecords,
  loadMonthRecords,
} from "@/lib/storage";

describe("storage: Plan 스키마 손상 판정", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("fixedCosts가 배열이 아니면 손상으로 판정한다", () => {
    localStorage.setItem(
      "psp.plan.v1",
      JSON.stringify({
        version: 1,
        salary: 50000000,
        fixedCosts: "not-an-array",
        payday: 15,
        presetId: "default",
        ratios: {},
        createdAt: "2026-09-23T00:00:00Z",
        updatedAt: "2026-09-23T00:00:00Z",
      })
    );

    expect(isPlanCorrupted()).toBe(true);
    expect(loadPlan()).toBeNull();
  });

  it("필수 필드(salary)가 빠지면 손상으로 판정한다", () => {
    localStorage.setItem(
      "psp.plan.v1",
      JSON.stringify({
        version: 1,
        fixedCosts: [],
        payday: 15,
        presetId: "default",
        ratios: {},
        createdAt: "2026-09-23T00:00:00Z",
        updatedAt: "2026-09-23T00:00:00Z",
      })
    );

    expect(isPlanCorrupted()).toBe(true);
    expect(loadPlan()).toBeNull();
  });

  it("유효한 형태의 Plan은 손상이 아니다", () => {
    const plan: Plan = {
      version: 1,
      salary: 50000000,
      fixedCosts: [{ id: "rent", name: "월세", amount: 1500000 }],
      payday: 15,
      presetId: "default",
      ratios: { food: 0.2 },
      createdAt: "2026-09-23T00:00:00Z",
      updatedAt: "2026-09-23T00:00:00Z",
    };
    savePlan(plan);

    expect(isPlanCorrupted()).toBe(false);
    expect(loadPlan()).toEqual(plan);
  });
});

describe("storage: MonthRecord 저장/조회", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("저장한 월별 기록을 월 순으로 정렬해 돌려준다", () => {
    const records: MonthRecord[] = [
      { month: "2026-09", checked: ["food"], total: 100000, rate: 0.5, updatedAt: "2026-09-23T00:00:00Z" },
      { month: "2026-07", checked: [], total: 0, rate: 0, updatedAt: "2026-07-01T00:00:00Z" },
      { month: "2026-08", checked: ["culture"], total: 50000, rate: 0.25, updatedAt: "2026-08-15T00:00:00Z" },
    ];

    const result = saveMonthRecords(records);

    expect(result.ok).toBe(true);
    expect(loadMonthRecords().map((r) => r.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("저장된 기록이 없으면 빈 배열을 돌려준다", () => {
    expect(loadMonthRecords()).toEqual([]);
  });
});
