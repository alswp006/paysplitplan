import { describe, it, expect, vi } from "vitest";
import { calculateInsights, getBracketScenarios, getTrend } from "@/lib/insights";
import * as dateLib from "@/lib/date";
import type { FixedCost, MonthRecord, RecordStore, SalaryPlan } from "@/lib/types";

const cost = (amount: number): FixedCost[] => [
  { id: "fc", name: "고정비", amount, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
];

function storeOf(rates: Record<string, number>): RecordStore {
  const records: RecordStore["records"] = {};
  for (const [month, rate] of Object.entries(rates)) records[month] = { month, rate } as MonthRecord;
  return { version: 1, records };
}

const TODAY = new Date("2026-09-29T09:00:00+09:00");

describe("getBracketScenarios", () => {
  it("월급 300만 / 고정비 60만이면 5구간, 저축 42만 → 102만", () => {
    const rows = getBracketScenarios({ salary: 3000000, fixedCosts: cost(600000), ratios: [50, 30, 10, 10] });
    expect(rows.map((r) => r.saving)).toEqual([420000, 570000, 720000, 870000, 1020000]);
    expect(rows[2]).toMatchObject({ annualSaving: 8640000, isCurrent: true });
  });

  it("고정비 이하·0 이하 구간은 뺀다", () => {
    const rows = getBracketScenarios({ salary: 1000000, fixedCosts: cost(600000), ratios: [50, 30, 10, 10] });
    expect(rows.map((r) => r.salary)).toEqual([1000000, 1500000, 2000000]);
  });
});

describe("getTrend", () => {
  it("6개월 points와 평균, 진행 중인 달은 streak을 끊지 않는다", () => {
    const t = getTrend(TODAY, storeOf({ "2026-07": 100, "2026-08": 100, "2026-09": 40 }));
    expect(t.points.map((p) => p.month)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(t.streak).toBe(2);
    expect(t.average).toBe(80);
  });

  it("기록이 없으면 average null, 추이 부족", () => {
    const t = getTrend(TODAY, { version: 1, records: {} });
    expect(t).toMatchObject({ average: null, streak: 0, hasEnoughTrend: false });
  });
});

describe("calculateInsights", () => {
  const plan: SalaryPlan = {
    version: 1,
    id: "p1",
    salary: 3000000,
    fixedCosts: cost(600000),
    presetId: "p532",
    ratios: [50, 30, 10, 10],
    payday: 25,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
  const rec = (month: string, rate: number, saving: boolean): MonthRecord =>
    ({
      month,
      rate,
      checked: { living: true, saving, emergency: false, leisure: false },
      snapshot: { amounts: { living: 1200000, saving: 720000, emergency: 240000, leisure: 240000 } },
    }) as MonthRecord;

  it("계획 배분액과 체크한 통장의 월평균, 6개월 추이를 낸다", () => {
    vi.spyOn(dateLib, "getToday").mockReturnValue(TODAY);
    const r = calculateInsights(plan, [rec("2026-08", 100, true), rec("2026-09", 25, false)]);
    expect(r.tierComparison).toEqual([
      { planned: 1200000, actual: 1200000 },
      { planned: 720000, actual: 360000 },
      { planned: 240000, actual: 0 },
      { planned: 240000, actual: 0 },
    ]);
    expect(r.trend6m.map((p) => p.month)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(r.trend6m.map((p) => p.rate)).toEqual([0, 0, 0, 0, 100, 25]);
  });

  it("기록이 없으면 actual 0, monthCount로 길이를 바꾼다", () => {
    vi.spyOn(dateLib, "getToday").mockReturnValue(TODAY);
    const r = calculateInsights(plan, [], 3);
    expect(r.tierComparison.every((t) => t.actual === 0)).toBe(true);
    expect(r.trend6m).toHaveLength(3);
  });
});
