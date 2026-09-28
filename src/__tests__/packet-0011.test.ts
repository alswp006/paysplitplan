import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockTossRewardAd, mockRouter } from "@/__tests__/__helpers__/mocks";
import { getBracketScenarios, getTrend } from "@/lib/insights";
import { LockedTierSection } from "@/components/result/LockedTierSection";
import type { FixedCost, MonthRecord, PlanDraft, RecordStore } from "@/lib/types";

mockTds();
mockAppsInToss();
mockTossRewardAd();
mockRouter();

// 계측은 부분 목 — 원본을 펼쳐야 PageShell/useScreenLog 등 나머지 export가 살아 있다.
const { logImpression } = vi.hoisted(() => ({ logImpression: vi.fn() }));
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  logImpression,
}));

// LockedTierSection 계약:
//   <LockedTierSection plan={{ salary, fixedCosts, ratios }} />   (PlanDraft의 일부)
// - bracket-compare(Card) 안에 bracket-row × N, 내 월급 행에만 Badge "내 월급", 각 행에 연 저축액.
// - trend-block(Card): 추이가 충분하면 trend-sparkline / trend-average / trend-streak,
//   기록이 2개월 미만이면 안내 문구만 (trend-sparkline 없음).
// - 기록은 'paysplit:records:v1'에서 스스로 읽는다(읽기 전용). "오늘"은 getToday()(= new Date()).
// - 마운트 시 logImpression('result_locked_tier')를 리렌더와 무관하게 1회만 부른다.

const RECORDS_KEY = "paysplit:records:v1";
const TODAY = new Date("2026-09-29T09:00:00+09:00");
const EMPTY_TREND_TEXT = "이행 기록이 2개월 이상 쌓이면 추이를 보여드려요";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  logImpression.mockClear();
});

// 예시 A: 월급 3,000,000 / 고정비 600,000 / 50:30:10:10 → 저축 = (월급 − 고정비) × 30%
const FIXED_A: FixedCost[] = [
  { id: "fc_rent", name: "월세", amount: 500000, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
  { id: "fc_phone", name: "통신비", amount: 100000, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
];
const PLAN_A: Pick<PlanDraft, "salary" | "fixedCosts" | "ratios"> = {
  salary: 3000000,
  fixedCosts: FIXED_A,
  ratios: [50, 30, 10, 10],
};

function fixed(total: number): FixedCost[] {
  return [{ id: "fc_all", name: "고정비", amount: total, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }];
}

function makeRecord(month: string, rate: number): MonthRecord {
  return {
    id: `rec_${month}`,
    planId: "plan_a",
    month,
    checked: { living: rate >= 25, saving: rate >= 50, emergency: rate >= 75, leisure: rate >= 100 },
    eligible: ["living", "saving", "emergency", "leisure"],
    rate,
    completedAt: rate === 100 ? `${month}-28T00:00:00.000Z` : null,
    snapshot: {
      salary: 3000000,
      fixedTotal: 600000,
      available: 2400000,
      ratios: [50, 30, 10, 10],
      amounts: { living: 1200000, saving: 720000, emergency: 240000, leisure: 240000 },
    },
    createdAt: `${month}-01T00:00:00.000Z`,
    updatedAt: `${month}-01T00:00:00.000Z`,
  };
}

function storeOf(rates: Record<string, number>): RecordStore {
  const records: RecordStore["records"] = {};
  for (const [month, rate] of Object.entries(rates)) records[month] = makeRecord(month, rate);
  return { version: 1, records };
}

function seedRecords(rates: Record<string, number>) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(storeOf(rates)));
}

function renderSection(plan = PLAN_A) {
  const tree = () =>
    React.createElement(MemoryRouter, null, React.createElement(LockedTierSection, { plan }));
  const utils = render(tree());
  return { ...utils, rerenderSame: () => utils.rerender(tree()) };
}

describe("결과 잠금 층: 소득 구간 비교 + 6개월 추이 — getBracketScenarios", () => {
  it("AC-1[P0]: 예시 A는 5구간이고 저축액 420,000 → 1,020,000, 연 저축액은 ×12, 3번째만 isCurrent", () => {
    const rows = getBracketScenarios(PLAN_A);

    expect(rows.map((r) => r.salary)).toEqual([2000000, 2500000, 3000000, 3500000, 4000000]);
    expect(rows.map((r) => r.saving)).toEqual([420000, 570000, 720000, 870000, 1020000]);
    expect(rows.map((r) => r.annualSaving)).toEqual([5040000, 6840000, 8640000, 10440000, 12240000]);
    expect(rows.map((r) => r.isCurrent)).toEqual([false, false, true, false, false]);
  });

  it("AC-1[P0]: 월급 1,000,000 / 고정비 600,000이면 고정비 이하 구간이 빠져 3개(1,000,000 / 1,500,000 / 2,000,000)", () => {
    const rows = getBracketScenarios({ salary: 1000000, fixedCosts: fixed(600000), ratios: [50, 30, 10, 10] });

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.salary)).toEqual([1000000, 1500000, 2000000]);
    expect(rows.map((r) => r.saving)).toEqual([120000, 270000, 420000]);
    expect(rows[0].isCurrent).toBe(true);
  });

  it("AC-1[P0]: 0 이하 구간도 뺀다 — 월급 800,000 / 고정비 100,000이면 −200,000 구간이 없고 4개", () => {
    const rows = getBracketScenarios({ salary: 800000, fixedCosts: fixed(100000), ratios: [50, 30, 10, 10] });

    expect(rows.map((r) => r.salary)).toEqual([300000, 800000, 1300000, 1800000]);
    expect(rows.every((r) => r.salary > 0)).toBe(true);
    expect(rows.filter((r) => r.isCurrent).map((r) => r.salary)).toEqual([800000]);
  });
});

describe("결과 잠금 층: 소득 구간 비교 + 6개월 추이 — getTrend", () => {
  it("AC-2[P0]: 2026-09-29, 기록 07:100/08:50/09:75면 points는 2026-04~09 6개(4·5·6월 null), average 75, streak 0", () => {
    const trend = getTrend(TODAY, storeOf({ "2026-07": 100, "2026-08": 50, "2026-09": 75 }));

    expect(trend.points).toEqual([
      { month: "2026-04", rate: null },
      { month: "2026-05", rate: null },
      { month: "2026-06", rate: null },
      { month: "2026-07", rate: 100 },
      { month: "2026-08", rate: 50 },
      { month: "2026-09", rate: 75 },
    ]);
    expect(trend.average).toBe(75);
    expect(trend.streak).toBe(0);
    expect(trend.hasEnoughTrend).toBe(true);
  });

  it("AC-3[P1]: 기록 07:100/08:100/09:40이면 이번 달이 100 미만이라 지난달부터 세어 streak 2", () => {
    const trend = getTrend(TODAY, storeOf({ "2026-07": 100, "2026-08": 100, "2026-09": 40 }));

    expect(trend.streak).toBe(2);
    expect(trend.average).toBe(80);
  });

  it("AC-3[P1]: 기록 08:100/09:100이면 이번 달부터 거꾸로 세어 streak 2", () => {
    const trend = getTrend(TODAY, storeOf({ "2026-08": 100, "2026-09": 100 }));

    expect(trend.streak).toBe(2);
    expect(trend.average).toBe(100);
  });

  it("AC-4[P1]: 기록이 1개월뿐이거나 기록이 없으면 hasEnoughTrend false, 없으면 average null", () => {
    const one = getTrend(TODAY, storeOf({ "2026-09": 75 }));
    expect(one.hasEnoughTrend).toBe(false);
    expect(one.points).toHaveLength(6);

    const none = getTrend(TODAY, { version: 1, records: {} });
    expect(none.hasEnoughTrend).toBe(false);
    expect(none.average).toBeNull();
    expect(none.streak).toBe(0);
  });
});

describe("결과 잠금 층: 소득 구간 비교 + 6개월 추이 — LockedTierSection", () => {
  it("AC-1[P0]: bracket-row 5개, 저축액이 순서대로, '내 월급' Badge는 3번째 행에만, 연 저축액 8,640,000원 표시", () => {
    seedRecords({});
    renderSection();

    const compare = screen.getByTestId("bracket-compare");
    const rows = within(compare).getAllByTestId("bracket-row");
    expect(rows).toHaveLength(5);

    ["420,000", "570,000", "720,000", "870,000", "1,020,000"].forEach((saving, i) => {
      expect(within(rows[i]).getByText(new RegExp(`${saving}원`))).toBeTruthy();
    });

    expect(screen.getAllByText("내 월급")).toHaveLength(1);
    expect(within(rows[2]).getByText("내 월급")).toBeTruthy();
    [0, 1, 3, 4].forEach((i) => expect(within(rows[i]).queryByText("내 월급")).toBeNull());
    expect(within(rows[2]).getByText(/8,640,000원/)).toBeTruthy();
  });

  it("AC-1[P0]: 월급 1,000,000 / 고정비 600,000이면 bracket-row가 3개", () => {
    seedRecords({});
    renderSection({ salary: 1000000, fixedCosts: fixed(600000), ratios: [50, 30, 10, 10] });

    expect(screen.getAllByTestId("bracket-row")).toHaveLength(3);
    expect(screen.getAllByText("내 월급")).toHaveLength(1);
  });

  it("AC-2[P0]: 기록 07:100/08:50/09:75면 sparkline 1개, '6개월 평균 이행률 75%', '연속 완료 0개월'", () => {
    seedRecords({ "2026-07": 100, "2026-08": 50, "2026-09": 75 });
    renderSection();

    const block = screen.getByTestId("trend-block");
    expect(within(block).getAllByTestId("trend-sparkline")).toHaveLength(1);
    expect(within(block).getByTestId("trend-average").textContent).toContain("6개월 평균 이행률 75%");
    expect(within(block).getByTestId("trend-streak").textContent).toContain("연속 완료 0개월");
    expect(within(block).queryByText(EMPTY_TREND_TEXT)).toBeNull();
  });

  it("AC-3[P1]: 기록 07:100/08:100/09:40이면 '연속 완료 2개월'", () => {
    seedRecords({ "2026-07": 100, "2026-08": 100, "2026-09": 40 });
    renderSection();

    expect(screen.getByTestId("trend-streak").textContent).toContain("연속 완료 2개월");
    expect(screen.getByTestId("trend-average").textContent).toContain("6개월 평균 이행률 80%");
  });

  it("AC-4[P0]: 기록이 1개월뿐이면 안내 문구, sparkline 0개, bracket-compare는 렌더, console.error 0회", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    seedRecords({ "2026-09": 75 });
    renderSection();

    expect(within(screen.getByTestId("trend-block")).getByText(EMPTY_TREND_TEXT)).toBeTruthy();
    expect(screen.queryAllByTestId("trend-sparkline")).toHaveLength(0);
    expect(screen.getByTestId("bracket-compare")).toBeTruthy();
    expect(screen.getAllByTestId("bracket-row")).toHaveLength(5);
    expect(errorSpy).toHaveBeenCalledTimes(0);
    errorSpy.mockRestore();
  });

  it("AC-4[P0]: 'paysplit:records:v1'이 'null'이어도 안내 문구, sparkline 0개, bracket-compare 렌더, console.error 0회", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(RECORDS_KEY, "null");
    renderSection();

    expect(within(screen.getByTestId("trend-block")).getByText(EMPTY_TREND_TEXT)).toBeTruthy();
    expect(screen.queryAllByTestId("trend-sparkline")).toHaveLength(0);
    expect(screen.queryByTestId("trend-average")).toBeNull();
    expect(screen.getByTestId("bracket-compare")).toBeTruthy();
    expect(errorSpy).toHaveBeenCalledTimes(0);
    errorSpy.mockRestore();
  });

  it("AC-5[P1]: 3번 리렌더해도 logImpression('result_locked_tier')는 1회만 호출된다", () => {
    seedRecords({ "2026-07": 100, "2026-08": 50, "2026-09": 75 });
    const { rerenderSame } = renderSection();

    rerenderSame();
    rerenderSame();
    rerenderSame();

    const lockedCalls = logImpression.mock.calls.filter((c) => c[0] === "result_locked_tier");
    expect(lockedCalls).toHaveLength(1);
    expect(lockedCalls[0][0]).toBe("result_locked_tier");
  });
});
