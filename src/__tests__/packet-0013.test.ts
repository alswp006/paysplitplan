import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { screen, fireEvent, within } from "@testing-library/react";
import {
  mockAll,
  mockNavigate,
  mockLocation,
  mockLogClick,
  mockShareApp,
} from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { savePlan } from "@/lib/storage";
import type { PlanDraft } from "@/lib/types";

// TDS·SDK·router(useNavigate/useLocation)·analytics·share 목. useLocation은 mockLocation을 돌려준다.
mockAll();

// 게이트 경계를 DOM 조상 검사로 확인하려고 TossRewardAd를 표시용 래퍼로 바꾼다(mockAll의 목보다 나중에 등록).
vi.doMock("@/components/TossRewardAd", () => ({
  TossRewardAd: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "reward-gate" }, children),
}));

// 히어로 값(value prop)을 검증하려고 CountUp을 기록용 목으로 바꾼다 — 애니메이션 없이 최종값만 그린다.
const countUpValues: number[] = [];
vi.doMock("@/components/CountUp", () => ({
  CountUp: ({ value, unit }: { value: number; unit?: string }) => {
    countUpValues.push(value);
    const text = String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return React.createElement("span", { "data-testid": "count-up" }, `${text}${unit ?? ""}`);
  },
}));

const { default: Result } = await import("@/pages/Result");

const TS = "2026-09-01T00:00:00.000Z";
const EXAMPLE_A: PlanDraft = {
  salary: 3_000_000,
  fixedCosts: [{ id: "fc_rent", name: "월세", amount: 600_000, createdAt: TS, updatedAt: TS }],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
};

function setState(state: unknown) {
  (mockLocation as { state: unknown }).state = state;
}

function renderResult() {
  return renderWithRouter(React.createElement(Result));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-20T09:00:00+09:00"));
  countUpValues.length = 0;
  setState(null);
});

afterEach(() => {
  setState(null);
});

describe("배분 결과 화면 (/result)", () => {
  it("AC-1[P0]: 예시 A 초안이 state로 오면 free-tier에 나눌 돈과 4개 통장 금액이 보인다", () => {
    setState({ draft: EXAMPLE_A });
    renderResult();

    const free = screen.getByTestId("free-tier");
    const hero = within(free).getByTestId("available-hero");
    expect(hero.textContent).toContain("나눌 돈");
    expect(hero.textContent).toContain("2,400,000원");
    // 히어로 숫자는 CountUp의 value prop = 2400000
    expect(countUpValues).toContain(2_400_000);

    const cards = within(free).getAllByTestId("allocation-card");
    expect(cards).toHaveLength(4);
    const expected: Array<[string, string]> = [
      ["생활비", "1,200,000원"],
      ["저축", "720,000원"],
      ["비상금", "240,000원"],
      ["여가", "240,000원"],
    ];
    expected.forEach(([label, amount], i) => {
      expect(cards[i].textContent).toContain(label);
      expect(cards[i].textContent).toContain(amount);
    });
  });

  it("AC-1[P0]: state 초안이 유효하면 저장된 계획보다 우선하고 저장 CTA는 '이 계획 저장하기'다", () => {
    savePlan(EXAMPLE_A);
    setState({ draft: { ...EXAMPLE_A, salary: 3_500_000 } });
    renderResult();

    const free = screen.getByTestId("free-tier");
    // 3,500,000 − 600,000 = 2,900,000
    expect(within(free).getByTestId("available-hero").textContent).toContain("2,900,000원");
    expect(countUpValues).toContain(2_900_000);
    expect(screen.getByRole("button", { name: "이 계획 저장하기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "홈에서 이체 체크하기" })).toBeNull();
  });

  it("AC-2[P0]: free-tier는 게이트 밖, locked-tier는 게이트 안에만 있고 비교·추이 블록을 담는다", () => {
    setState({ draft: EXAMPLE_A });
    renderResult();

    const gates = screen.getAllByTestId("reward-gate");
    expect(gates).toHaveLength(1);
    const gate = gates[0];

    const free = screen.getByTestId("free-tier");
    expect(gate.contains(free)).toBe(false);
    expect(free.closest('[data-testid="reward-gate"]')).toBeNull();
    expect(within(free).getByRole("button", { name: "비율 공유하기" })).toBeInTheDocument();

    const lockedAll = screen.getAllByTestId("locked-tier");
    expect(lockedAll).toHaveLength(1);
    const locked = lockedAll[0];
    expect(gate.contains(locked)).toBe(true);
    expect(within(locked).getByTestId("bracket-compare")).toBeInTheDocument();
    expect(within(locked).getByTestId("trend-block")).toBeInTheDocument();
    // 무료 층 요소는 잠금 층 안에 섞여 있지 않다
    expect(within(locked).queryByTestId("allocation-card")).toBeNull();
    expect(within(locked).queryByTestId("available-hero")).toBeNull();
  });

  it("AC-2[P0]: 소스에 <TossRewardAd 사용은 정확히 1줄이다", () => {
    const src = readFileSync(resolve(__dirname, "..", "pages", "Result.tsx"), "utf8");
    // grep -c "<TossRewardAd" — 일치하는 줄 수
    const count = src.split("\n").filter((line) => line.includes("<TossRewardAd")).length;
    expect(count).toBe(1);
    expect(src).not.toMatch(/<TossRewardAd[^>]*>\s*<ScreenScaffold/);
  });

  it("AC-3[P0]: state 없이 저장된 예시 A로 진입하면 같은 금액과 '홈에서 이체 체크하기'가 보인다", () => {
    savePlan(EXAMPLE_A);
    renderResult();

    const free = screen.getByTestId("free-tier");
    expect(within(free).getByTestId("available-hero").textContent).toContain("2,400,000원");
    expect(within(free).getAllByTestId("allocation-card")).toHaveLength(4);
    expect(free.textContent).toContain("1,200,000원");
    expect(screen.getByRole("button", { name: "홈에서 이체 체크하기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이 계획 저장하기" })).toBeNull();
  });

  const invalidStates: Array<[string, unknown]> = [
    ["undefined", undefined],
    ["null", null],
    ["'garbage'", "garbage"],
    ["123", 123],
    ["{}", {}],
    ["{draft:null}", { draft: null }],
    ["합 90 비율", { draft: { ...EXAMPLE_A, ratios: [50, 30, 10, 0] } }],
    ["payday 32", { draft: { ...EXAMPLE_A, payday: 32 } }],
  ];

  it.each(invalidStates)(
    "AC-3[P0]: 잘못된 state(%s)는 무시하고 저장된 계획을 보여주며 크래시·console.error가 없다",
    (_name, state) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      savePlan(EXAMPLE_A);
      setState(state);

      expect(() => renderResult()).not.toThrow();

      const free = screen.getByTestId("free-tier");
      expect(within(free).getByTestId("available-hero").textContent).toContain("2,400,000원");
      expect(within(free).getAllByTestId("allocation-card")).toHaveLength(4);
      expect(screen.getByRole("button", { name: "홈에서 이체 체크하기" })).toBeInTheDocument();
      expect(errorSpy).toHaveBeenCalledTimes(0);
      errorSpy.mockRestore();
    },
  );

  it("AC-4[P1]: state도 계획도 없으면 빈 상태를 보이고 '월급 계획 짜기'가 /plan으로 이동한다", () => {
    renderResult();

    expect(screen.getByText("아직 계획이 없어요")).toBeInTheDocument();
    expect(screen.queryByTestId("free-tier")).toBeNull();
    expect(screen.queryByTestId("locked-tier")).toBeNull();
    expect(screen.queryAllByTestId("allocation-card")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "월급 계획 짜기" }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/plan");
  });

  it("AC-4[P1]: 잘못된 state만 있고 저장된 계획도 없으면 빈 상태이며 console.error가 없다", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setState({ draft: { ...EXAMPLE_A, salary: "3000000" } });
    renderResult();

    expect(screen.getByText("아직 계획이 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "월급 계획 짜기" })).toBeInTheDocument();
    expect(screen.queryByTestId("free-tier")).toBeNull();
    expect(screen.queryByTestId("locked-tier")).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(0);
    errorSpy.mockRestore();
  });

  it("AC-5[P2]: '비율 공유하기'를 탭하면 logClick('result_share')와 shareApp이 1회씩 호출된다 — 월급 없이 비율만, intoss 경로", () => {
    setState({ draft: EXAMPLE_A });
    renderResult();

    expect(mockShareApp).toHaveBeenCalledTimes(0);
    fireEvent.click(screen.getByRole("button", { name: "비율 공유하기" }));

    const shareLogs = mockLogClick.mock.calls.filter(([name]) => name === "result_share");
    expect(shareLogs).toHaveLength(1);
    expect(mockShareApp).toHaveBeenCalledTimes(1);
    expect(mockShareApp).toHaveBeenCalledWith({
      message: "월급쪼개기로 이렇게 나눠요\n생활비 50% · 저축 30% · 비상금 10% · 여가 10%\n내 월급으로 계산해 보기",
      path: "intoss://paysplitplan/plan?r=50-30-10-10",
    });
    // 금액(월급·통장 금액)은 메시지에 싣지 않는다
    const [{ message }] = mockShareApp.mock.calls[0] as unknown as [{ message: string }];
    expect(message).not.toMatch(/\d{1,3}(,\d{3})+원|만 원/);
  });
});
