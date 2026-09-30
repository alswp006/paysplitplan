import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
import { mockAll, mockNavigate, mockLogClick, mockShareApp } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { savePlan } from "@/lib/storage";
import type { PlanDraft } from "@/lib/types";

mockAll();

// 게이트 경계를 DOM에서 확인하려고 TossRewardAd를 표시용 래퍼로 바꾼다(mocks.ts의 목보다 나중에 등록).
vi.doMock("@/components/TossRewardAd", async () => {
  const R = await import("react");
  return {
    TossRewardAd: ({ children }: { children: React.ReactNode }) =>
      R.createElement("div", { "data-testid": "reward-gate" }, children),
  };
});

const { default: Result } = await import("@/pages/Result");

const TS = "2026-09-01T00:00:00.000Z";
const EXAMPLE_A: PlanDraft = {
  salary: 3_000_000,
  fixedCosts: [{ id: "fc_rent", name: "월세", amount: 600_000, createdAt: TS, updatedAt: TS }],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-20T09:00:00+09:00"));
});

describe("Result 레이아웃", () => {
  it("저장된 계획으로 들어오면 무료 층에 남는 돈과 배분 카드 4개가 보인다", async () => {
    savePlan(EXAMPLE_A);
    renderWithRouter(<Result />);

    const free = screen.getByTestId("free-tier");
    expect(within(free).getByTestId("available-hero")).toBeInTheDocument();
    expect(await within(free).findByText("2,400,000원")).toBeInTheDocument();
    expect(within(free).getAllByTestId("allocation-card")).toHaveLength(4);
    expect(within(free).getByText("1,200,000원")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "홈에서 이체 체크하기" })).toBeInTheDocument();
  });

  it("무료 층은 광고 게이트 밖, 잠금 층은 게이트 안에만 있다", () => {
    savePlan(EXAMPLE_A);
    renderWithRouter(<Result />);

    const gate = screen.getByTestId("reward-gate");
    expect(gate.contains(screen.getByTestId("free-tier"))).toBe(false);
    const locked = within(gate).getByTestId("locked-tier");
    expect(within(locked).getByTestId("bracket-compare")).toBeInTheDocument();
    expect(within(locked).getByTestId("trend-block")).toBeInTheDocument();
  });

  it("공유 버튼('비율 공유하기')은 result_share 로그와 shareApp을 1회씩 부르고, 금액 없이 비율과 intoss 경로만 넘긴다", () => {
    savePlan(EXAMPLE_A);
    renderWithRouter(<Result />);

    fireEvent.click(screen.getByRole("button", { name: "비율 공유하기" }));
    expect(mockLogClick).toHaveBeenCalledWith("result_share");
    expect(mockShareApp).toHaveBeenCalledTimes(1);
    expect(mockShareApp).toHaveBeenCalledWith({
      message: "월급쪼개기로 이렇게 나눠요\n생활비 50 · 저축 30 · 비상금 10 · 여가 10\n내 월급으로 계산해 보기",
      path: "intoss://paysplitplan/plan?r=50-30-10-10",
    });
    const [{ message }] = mockShareApp.mock.calls[0] as unknown as [{ message: string }];
    expect(message).not.toMatch(/\d{1,3}(,\d{3})+원|만 원/);
  });

  it("잠금 층 맨 앞에 '이 계획대로 1년이면' — 시드 A 저축 8,640,000원 · 비상금 2,880,000원(무료 층에는 없다)", () => {
    savePlan(EXAMPLE_A);
    renderWithRouter(<Result />);

    const locked = screen.getByTestId("locked-tier");
    const year = within(locked).getByTestId("year-projection");
    expect(year.textContent).toContain("이 계획대로 1년이면");
    expect(within(year).getByText("8,640,000원")).toBeInTheDocument();
    expect(within(year).getByText("2,880,000원")).toBeInTheDocument();
    expect(year.textContent).toContain("매달 계획대로 옮긴다고 가정한 단순 합계예요");
    // 1년 카드가 구간 비교보다 앞이다
    expect(year.compareDocumentPosition(within(locked).getByTestId("bracket-compare")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(screen.getByTestId("free-tier")).queryByTestId("year-projection")).toBeNull();
  });

  it("무료 층은 히어로 → 세팅표 → '비율 공유하기' 순이고 Top 제목은 '통장별 세팅표'다", () => {
    savePlan(EXAMPLE_A);
    renderWithRouter(<Result />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("통장별 세팅표");
    const free = screen.getByTestId("free-tier");
    const hero = within(free).getByTestId("available-hero");
    const sheet = within(free).getByTestId("setup-sheet");
    const share = within(free).getByRole("button", { name: "비율 공유하기" });
    expect(hero.compareDocumentPosition(sheet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sheet.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 통장 카드는 세팅표의 행이다(예전 카드 4개 + MiniBar는 없다)
    expect(within(sheet).getAllByTestId("allocation-card")).toHaveLength(4);
    expect(within(free).queryAllByRole("progressbar")).toHaveLength(0);
  });

  it("계획이 없으면 빈 상태와 '월급 계획 짜기'를 보이고 결과 층은 없다", () => {
    renderWithRouter(<Result />);

    expect(screen.getByText("아직 계획이 없어요")).toBeInTheDocument();
    expect(screen.queryByTestId("free-tier")).toBeNull();
    expect(screen.queryByTestId("locked-tier")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "월급 계획 짜기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/plan");
  });
});
