import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { mockAll, mockLogClick, mockOpenToast } from "@/__tests__/__helpers__/mocks";
import type { FixedCost, RecordStore, SalaryPlan } from "@/lib/types";

// TDS·SDK·analytics 목. analytics는 doMock이라 컴포넌트를 목 등록 **뒤에** 불러온다.
mockAll();

const { EmergencyGoalCard } = await import("@/components/home/EmergencyGoalCard");
const { GOAL_KEY } = await import("@/lib/goal");

const TS = "2026-09-01T00:00:00.000Z";
const fc = (id: string, name: string, amount: number): FixedCost => ({ id, name, amount, createdAt: TS, updatedAt: TS });

// 시드 B — 필수 지출 1,557,000 · 6개월 목표 9,342,000 · 비상금 월 215,500
const PLAN_B: SalaryPlan = {
  version: 1,
  id: "plan_b",
  salary: 2_850_000,
  fixedCosts: [fc("fc_rent", "월세", 550_000), fc("fc_phone", "통신비", 65_000), fc("fc_bus", "교통비", 80_000)],
  presetId: "p442",
  ratios: [40, 40, 10, 10],
  payday: 10,
  createdAt: TS,
  updatedAt: TS,
};
const EMPTY: RecordStore = { version: 1, records: {} };
const SEPT_EMERGENCY: RecordStore = {
  version: 1,
  records: {
    "2026-09": {
      id: "rec_2026-09",
      planId: "plan_b",
      month: "2026-09",
      checked: { living: false, saving: false, emergency: true, leisure: false },
      eligible: ["living", "saving", "emergency", "leisure"],
      rate: 25,
      completedAt: null,
      snapshot: {
        salary: 2_850_000,
        fixedTotal: 695_000,
        available: 2_155_000,
        ratios: [40, 40, 10, 10],
        amounts: { living: 862_000, saving: 862_000, emergency: 215_500, leisure: 215_500 },
      },
      createdAt: TS,
      updatedAt: TS,
    },
  },
};

function renderCard(store: RecordStore = EMPTY) {
  return render(React.createElement(EmergencyGoalCard, { plan: PLAN_B, store }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 29, 9));
});

describe("비상금 목표 카드 (홈)", () => {
  it("목표가 없으면 한 달 필수 지출과 고정비·생활비 내역, 3·6·12개월치 버튼을 보인다(추천·권장 표시 없음)", () => {
    renderCard();
    const card = screen.getByTestId("emergency-goal");
    expect(within(card).getByText("한 달 필수 지출 1,557,000원")).toBeInTheDocument();
    expect(card.textContent).toContain("고정비 695,000원 + 생활비 862,000원 · 몇 달 치를 모을까요?");
    for (const label of ["3개월치", "6개월치", "12개월치"]) {
      expect(within(card).getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(card.textContent).not.toMatch(/권장|추천/);
  });

  it("'6개월치'를 누르면 목표가 저장되고 '목표 9,342,000원'과 진행률 막대가 보인다", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "6개월치" }));

    const saved = JSON.parse(localStorage.getItem(GOAL_KEY) ?? "null");
    expect(saved).toMatchObject({ version: 1, months: 6, baseBalance: 0, baseMonth: "2026-08" });
    const card = screen.getByTestId("emergency-goal");
    expect(card.textContent).toContain("아직 모은 비상금이 없어요");
    expect(card.textContent).toContain("0원 / 목표 9,342,000원");
    expect(within(card).getByRole("progressbar", { name: "비상금 목표 진행률" })).toBeInTheDocument();
    expect(card.textContent).toContain("지금 계획대로면 2030년 4월쯤 채워요");
    expect(within(card).getByRole("radio", { name: "6개월" })).toBeChecked();
    expect(mockLogClick).toHaveBeenCalledWith("goal_set");
  });

  it("이번 달 비상금을 체크한 기록이 오면 0.1개월치 · 이번 달 +215,500원을 바로 보인다", () => {
    localStorage.setItem(
      GOAL_KEY,
      JSON.stringify({ version: 1, months: 6, baseBalance: 0, baseMonth: "2026-08", createdAt: TS, updatedAt: TS }),
    );
    renderCard(SEPT_EMERGENCY);
    const card = screen.getByTestId("emergency-goal");
    expect(card.textContent).toContain("0.1개월치 모았어요");
    expect(card.textContent).toContain("이번 달 +215,500원");
    expect(card.textContent).toContain("2030년 4월쯤");
  });

  it("잔액 시트에서 3,000,000을 저장하면 '1.9개월치 모았어요' · 2029년 3월", async () => {
    localStorage.setItem(
      GOAL_KEY,
      JSON.stringify({ version: 1, months: 6, baseBalance: 0, baseMonth: "2026-08", createdAt: TS, updatedAt: TS }),
    );
    renderCard(SEPT_EMERGENCY);
    fireEvent.click(screen.getByRole("button", { name: "잔액 맞추기" }));

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("지금 비상금 통장 잔액")).toBeInTheDocument();
    const input = within(sheet).getByRole("textbox", { name: "비상금 통장 잔액" });
    fireEvent.change(input, { target: { value: "3000000" } });
    expect(input).toHaveValue("3,000,000");
    fireEvent.click(within(sheet).getByRole("button", { name: "잔액 저장" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const card = screen.getByTestId("emergency-goal");
    expect(card.textContent).toContain("1.9개월치 모았어요");
    expect(card.textContent).toContain("2029년 3월쯤");
    expect(card.textContent).not.toContain("이번 달 +"); // 잔액에 이번 달 이체가 이미 들어 있다
    expect(mockLogClick).toHaveBeenCalledWith("goal_balance_adjust");
  });

  it("잔액 칸을 비운 채 저장하면 칸 아래에 '금액을 입력해 주세요'가 뜨고 저장하지 않는다", async () => {
    localStorage.setItem(
      GOAL_KEY,
      JSON.stringify({ version: 1, months: 6, baseBalance: 0, baseMonth: "2026-08", createdAt: TS, updatedAt: TS }),
    );
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "잔액 맞추기" }));
    const sheet = await screen.findByRole("dialog");
    // 건드리기 전에는 오류가 아니라 도움말이다
    expect(within(sheet).getByText("이번 달 이체까지 포함한 금액이에요")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "잔액 저장" }));
    expect(within(sheet).getByRole("alert")).toHaveTextContent("금액을 입력해 주세요");

    fireEvent.change(within(sheet).getByRole("textbox", { name: "비상금 통장 잔액" }), { target: { value: "20000000000" } });
    expect(within(sheet).getByRole("alert")).toHaveTextContent("100억 원 이하로 입력해 주세요");
    expect(JSON.parse(localStorage.getItem(GOAL_KEY)!).baseBalance).toBe(0);
  });

  it("개월 수를 12개월로 바꾸면 저장되고 목표가 18,684,000원이 된다", () => {
    localStorage.setItem(
      GOAL_KEY,
      JSON.stringify({ version: 1, months: 6, baseBalance: 0, baseMonth: "2026-08", createdAt: TS, updatedAt: TS }),
    );
    renderCard();
    fireEvent.click(screen.getByRole("radio", { name: "12개월" }));
    expect(JSON.parse(localStorage.getItem(GOAL_KEY)!).months).toBe(12);
    expect(screen.getByTestId("emergency-goal").textContent).toContain("목표 18,684,000원");
    expect(mockLogClick).toHaveBeenCalledWith("goal_months");
  });

  it("저장된 목표 원문이 깨졌으면 크래시 없이 '목표 없음' 상태이고 원문은 그대로다", () => {
    localStorage.setItem(GOAL_KEY, "{bad");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderCard();
    expect(screen.getByRole("button", { name: "6개월치" })).toBeInTheDocument();
    expect(localStorage.getItem(GOAL_KEY)).toBe("{bad");
    expect(errorSpy).toHaveBeenCalledTimes(0);
    errorSpy.mockRestore();
  });

  it("저장에 실패하면 토스트로 알리고 화면은 목표 없음 상태로 남는다", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "3개월치" }));
    setItem.mockRestore();
    expect(mockOpenToast).toHaveBeenCalledWith("저장 공간이 부족해 저장하지 못했어요", { higherThanCTA: true });
    expect(screen.getByRole("button", { name: "3개월치" })).toBeInTheDocument();
  });
});
