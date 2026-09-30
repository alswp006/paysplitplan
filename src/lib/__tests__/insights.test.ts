import { describe, it, expect, vi } from "vitest";
import { calculateInsights, getBracketScenarios, getStreaks, getTrend, movedTotal } from "@/lib/insights";
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

  it("입력 상한(1억)을 넘는 구간과, 내 월급이 아닌데 저축이 0원인 구간은 뺀다", () => {
    // 월급 1억 · 고정비 99,999,999 → 남는 돈 1원: 위 두 구간은 1억 초과, 아래 두 구간은 고정비 이하
    const extreme = getBracketScenarios({ salary: 100_000_000, fixedCosts: cost(99_999_999), ratios: [50, 30, 10, 10] });
    expect(extreme.map((r) => r.salary)).toEqual([100_000_000]);
    expect(extreme[0]).toMatchObject({ isCurrent: true, saving: 0 });

    // 월급 9,970만 원 → +50만·+100만 구간은 1억 초과라 빠진다(1억 정확히는 입력 가능하니 남는다)
    const nearMax = getBracketScenarios({ salary: 99_700_000, fixedCosts: cost(600_000), ratios: [50, 30, 10, 10] });
    expect(nearMax.map((r) => r.salary)).toEqual([98_700_000, 99_200_000, 99_700_000]);
    const atMax = getBracketScenarios({ salary: 99_000_000, fixedCosts: cost(600_000), ratios: [50, 30, 10, 10] });
    expect(atMax.map((r) => r.salary)).toEqual([98_000_000, 98_500_000, 99_000_000, 99_500_000, 100_000_000]);

    // 저축 비율 0%면 비교할 구간이 없다 — 내 월급 행만 남는다
    const noSaving = getBracketScenarios({ salary: 3_000_000, fixedCosts: cost(600_000), ratios: [80, 0, 10, 10] });
    expect(noSaving.map((r) => r.isCurrent)).toEqual([true]);
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

describe("getStreaks — 연속 기록(이번 달 진행 중은 끊지 않는다)", () => {
  it("07·08·09월이 100이면 {current 3, best 3}", () => {
    expect(getStreaks(storeOf({ "2026-07": 100, "2026-08": 100, "2026-09": 100 }), TODAY)).toEqual({ current: 3, best: 3 });
  });

  it("04·05·06월 100, 07월 50, 08·09월 100이면 {current 2, best 3}", () => {
    const store = storeOf({ "2026-04": 100, "2026-05": 100, "2026-06": 100, "2026-07": 50, "2026-08": 100, "2026-09": 100 });
    expect(getStreaks(store, TODAY)).toEqual({ current: 2, best: 3 });
  });

  it("이번 달이 진행 중(75)이어도 지난달까지의 연속은 이어지고, 기록이 비면 0", () => {
    expect(getStreaks(storeOf({ "2026-07": 100, "2026-08": 100, "2026-09": 75 }), TODAY)).toEqual({ current: 2, best: 2 });
    expect(getStreaks(storeOf({ "2026-05": 100, "2026-07": 100 }), TODAY)).toEqual({ current: 0, best: 1 });
    expect(getStreaks(storeOf({}), TODAY)).toEqual({ current: 0, best: 0 });
  });
});

describe("movedTotal — 저축·비상금 통장에 옮긴 돈", () => {
  const amounts = { living: 1_200_000, saving: 720_000, emergency: 240_000, leisure: 240_000 };
  const rec = (month: string, checked: MonthRecord["checked"]): MonthRecord =>
    ({ month, rate: 0, checked, snapshot: { amounts } }) as MonthRecord;

  it("시드 A로 3개월 동안 저축·비상금을 체크했으면 3 × (720,000 + 240,000) = 2,880,000", () => {
    const on = { living: true, saving: true, emergency: true, leisure: true };
    const store: RecordStore = {
      version: 1,
      records: { "2026-07": rec("2026-07", on), "2026-08": rec("2026-08", on), "2026-09": rec("2026-09", on) },
    };
    expect(movedTotal(store)).toBe(2_880_000);
  });

  it("생활비·여가는 세지 않고, 체크하지 않은 통장도 세지 않는다", () => {
    const store: RecordStore = {
      version: 1,
      records: { "2026-09": rec("2026-09", { living: true, saving: false, emergency: true, leisure: true }) },
    };
    expect(movedTotal(store)).toBe(240_000);
    expect(movedTotal({ version: 1, records: {} })).toBe(0);
  });
});
