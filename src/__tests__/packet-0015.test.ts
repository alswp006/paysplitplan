import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import Home from "@/pages/Home";
import { PLAN_KEY, RECORDS_KEY } from "@/lib/storage";
import type { RecordStore, SalaryPlan } from "@/lib/types";

mockTds();
mockAppsInToss();
mockRouter();

// ── 계약 (Coder가 이 시그니처대로 만든다) ──
// src/pages/Home.tsx  (default export Home, props 없음)
//   - 마운트 시 loadPlan()을 1회 읽는다. 홈은 location.state와 기록 키(paysplit:records:v1)를 쓰지 않는다(기록 읽기는 ChecklistCard 몫, 쓰기는 토글 때만).
//   - 계획 없음: '월급을 어디에 얼마씩 나눌지 정해볼까요?' + '월급 계획 짜기' 버튼(display="block").
//       dday-hero·checklist-row 없음. 버튼 onClick: logClick('home_start_plan') → navigate('/plan').
//   - 계획 있음: data-testid="dday-hero"(getNextPayday(getToday(), plan.payday) → 'D-{dday}' + label),
//       <ChecklistCard plan={plan} />, '배분 결과 보기'(→ navigate('/result')), '계획 수정'(→ navigate('/plan')), FloatingTabBar(홈·기록).
//   - navigate는 경로 문자열 하나만 넘긴다(state 없음 → 도착 화면의 location.state는 null).

const { logClick } = vi.hoisted(() => ({ logClick: vi.fn() }));
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  logClick,
}));

const CREATED = "2026-09-01T00:00:00.000Z";
const EMPTY_TITLE = "월급을 어디에 얼마씩 나눌지 정해볼까요?";

const fixedRent = { id: "fc_rent", name: "월세", amount: 600_000, createdAt: CREATED, updatedAt: CREATED };

// 예시 A: 300만 원 − 고정비 60만 원 = 240만 원 → 1,200,000 / 720,000 / 240,000 / 240,000
const planA: SalaryPlan = {
  version: 1,
  id: "plan_a",
  salary: 3_000_000,
  fixedCosts: [fixedRent],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
  createdAt: CREATED,
  updatedAt: CREATED,
};

const recordsWithPlanId: RecordStore = {
  version: 1,
  records: {
    "2026-08": {
      id: "rec_2026-08",
      planId: "plan_a",
      month: "2026-08",
      checked: { living: true, saving: true, emergency: false, leisure: false },
      eligible: ["living", "saving", "emergency", "leisure"],
      rate: 50,
      completedAt: null,
      snapshot: {
        salary: 3_000_000,
        fixedTotal: 600_000,
        available: 2_400_000,
        ratios: [50, 30, 10, 10],
        amounts: { living: 1_200_000, saving: 720_000, emergency: 240_000, leisure: 240_000 },
      },
      createdAt: CREATED,
      updatedAt: CREATED,
    },
  },
};

function seedPlan(plan: unknown) {
  localStorage.setItem(PLAN_KEY, typeof plan === "string" ? plan : JSON.stringify(plan));
}

function renderHome() {
  return render(React.createElement(MemoryRouter, null, React.createElement(Home)));
}

beforeEach(() => {
  // 2026-09-29 (로컬) — 모든 D-day 기대값의 기준일
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 29, 9, 0, 0));
  mockNavigate.mockClear();
  logClick.mockClear();
  mockLocation.state = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("홈 화면 (/)", () => {
  it("AC-1[P0]: payday 25, 오늘 2026-09-29이면 dday-hero에 'D-26'과 '10월 25일 월급날'이 있다", () => {
    seedPlan(planA);
    renderHome();

    const hero = screen.getByTestId("dday-hero");
    expect(hero.textContent).toContain("D-26");
    expect(hero.textContent).toContain("10월 25일 월급날");
    expect(screen.queryByText(EMPTY_TITLE)).toBeNull();
  });

  it("AC-1[P0]: payday 31이면 말일로 당겨져 'D-1'과 '9월 30일 월급날'이다", () => {
    seedPlan({ ...planA, payday: 31 });
    renderHome();

    const hero = screen.getByTestId("dday-hero");
    expect(hero.textContent).toMatch(/D-1(?!\d)/);
    expect(hero.textContent).toContain("9월 30일 월급날");
    expect(hero.textContent).not.toContain("D-26");
  });

  it("AC-1[P0]: 계획이 있으면 체크리스트 4행, 두 이동 버튼, 하단 탭(홈·기록)을 함께 렌더한다", () => {
    seedPlan(planA);
    renderHome();

    expect(screen.getAllByTestId("checklist-row")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "배분 결과 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계획 수정" })).toBeInTheDocument();
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual(["홈", "기록"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("AC-2[P0]: 계획이 없으면 안내 문구와 '월급 계획 짜기' 버튼만 보이고 dday-hero·checklist-row는 0개다", () => {
    renderHome();

    expect(screen.getByText(EMPTY_TITLE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "월급 계획 짜기" })).toBeInTheDocument();
    expect(screen.queryByTestId("dday-hero")).toBeNull();
    expect(screen.queryAllByTestId("checklist-row")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "배분 결과 보기" })).toBeNull();
  });

  it("AC-2[P0]: '월급 계획 짜기'를 탭하면 logClick('home_start_plan') 다음에 navigate('/plan')이 호출된다", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "월급 계획 짜기" }));

    expect(logClick).toHaveBeenCalledTimes(1);
    expect(logClick).toHaveBeenCalledWith("home_start_plan");
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/plan");
    expect(logClick.mock.invocationCallOrder[0]).toBeLessThan(mockNavigate.mock.invocationCallOrder[0]);
  });

  it("AC-3[P0]: '계획 수정'은 /plan으로, '배분 결과 보기'는 /result로 state 없이 이동한다", () => {
    seedPlan(planA);
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "계획 수정" }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[0]).toEqual(["/plan"]);

    fireEvent.click(screen.getByRole("button", { name: "배분 결과 보기" }));
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate.mock.calls[1]).toEqual(["/result"]);
  });

  it("AC-3[P0]: 들어올 때 붙은 location.state는 무시한다 — 화면도 이동 인자도 그대로다", () => {
    seedPlan(planA);
    mockLocation.state = { salary: 9_999_999, payday: 1 } as unknown as null;
    renderHome();

    expect(screen.getByTestId("dday-hero").textContent).toContain("D-26");
    fireEvent.click(screen.getByRole("button", { name: "계획 수정" }));
    expect(mockNavigate.mock.calls[0]).toEqual(["/plan"]);
  });

  it("AC-4[P0]: 계획 값이 '{broken'이면 빈 상태, 계획 키 삭제, console.error 0회, 기록 키는 그대로다", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(RECORDS_KEY, JSON.stringify(recordsWithPlanId));
    const recordsBefore = localStorage.getItem(RECORDS_KEY);
    seedPlan("{broken");

    renderHome();

    expect(screen.getByText(EMPTY_TITLE)).toBeInTheDocument();
    expect(screen.queryByTestId("dday-hero")).toBeNull();
    expect(localStorage.getItem(PLAN_KEY)).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(0);
    expect(localStorage.getItem(RECORDS_KEY)).toBe(recordsBefore);
    expect(recordsBefore).toContain("plan_a");
  });

  it("AC-4[P0]: salary가 문자열 '3000000'이면 빈 상태, 계획 키 삭제, console.error 0회, 기록 키는 그대로다", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(RECORDS_KEY, JSON.stringify(recordsWithPlanId));
    const recordsBefore = localStorage.getItem(RECORDS_KEY);
    seedPlan({ ...planA, salary: "3000000" });

    renderHome();

    expect(screen.getByRole("button", { name: "월급 계획 짜기" })).toBeInTheDocument();
    expect(screen.queryAllByTestId("checklist-row")).toHaveLength(0);
    expect(localStorage.getItem(PLAN_KEY)).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(0);
    expect(localStorage.getItem(RECORDS_KEY)).toBe(recordsBefore);
  });

  it("AC-4[P0]: 진입만으로는 기록 키를 쓰지 않고 계획 키는 마운트 때 1회만 읽는다", () => {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(recordsWithPlanId));
    const recordsBefore = localStorage.getItem(RECORDS_KEY);
    seedPlan(planA);
    const getSpy = vi.spyOn(Storage.prototype, "getItem");
    const setSpy = vi.spyOn(Storage.prototype, "setItem");

    const { rerender } = renderHome();
    rerender(React.createElement(MemoryRouter, null, React.createElement(Home)));

    const planReads = getSpy.mock.calls.filter(([key]) => key === PLAN_KEY);
    expect(planReads).toHaveLength(1);
    expect(setSpy.mock.calls.filter(([key]) => key === RECORDS_KEY)).toHaveLength(0);
    expect(localStorage.getItem(RECORDS_KEY)).toBe(recordsBefore);
  });
});
