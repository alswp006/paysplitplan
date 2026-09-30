import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { LockedTierSection } from "@/components/result/LockedTierSection";
import { RECORDS_KEY } from "@/lib/storage";

mockTds();
mockAppsInToss();

const { logImpression } = vi.hoisted(() => ({ logImpression: vi.fn() }));
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  logImpression,
}));

const plan = {
  salary: 3000000,
  fixedCosts: [{ id: "fc", name: "월세", amount: 600000, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }],
  ratios: [50, 30, 10, 10] as [number, number, number, number],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T09:00:00+09:00"));
});

describe("LockedTierSection", () => {
  it("극단값(월급 1억 · 나눌 돈 1원)이면 1억 초과·저축 0원 비교 행 없이 내 월급 행 1개만 보인다", () => {
    render(
      <LockedTierSection
        plan={{ ...plan, salary: 100_000_000, fixedCosts: [{ ...plan.fixedCosts[0], amount: 99_999_999 }] }}
      />,
    );
    const rows = screen.getAllByTestId("bracket-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("100,000,000원");
    expect(rows[0].textContent).toContain("내 월급");
  });

  it("기록이 없으면 구간 5행과 안내 문구만 보이고 노출 로그는 1회", () => {
    const { rerender } = render(<LockedTierSection plan={plan} />);
    rerender(<LockedTierSection plan={plan} />);

    expect(screen.getAllByTestId("bracket-row")).toHaveLength(5);
    expect(screen.queryByTestId("trend-sparkline")).toBeNull();
    expect(screen.getByText("이행 기록이 2개월 이상 쌓이면 추이를 보여드려요")).toBeTruthy();
    expect(logImpression).toHaveBeenCalledTimes(1);
    expect(logImpression).toHaveBeenCalledWith("result_locked_tier");
  });

  it("N13: 추이가 있으면 Sparkline 아래에 최근 6개월 달 이름 6칸(4월~9월)이 있다", () => {
    const TS = "2026-09-01T00:00:00.000Z";
    const rec = (month: string, rate: number) => ({
      id: `rec_${month}`,
      planId: "plan_a",
      month,
      checked: { living: rate === 100, saving: true, emergency: rate === 100, leisure: rate === 100 },
      eligible: ["living", "saving", "emergency", "leisure"],
      rate,
      completedAt: rate === 100 ? TS : null,
      snapshot: {
        salary: 3_000_000,
        fixedTotal: 600_000,
        available: 2_400_000,
        ratios: [50, 30, 10, 10],
        amounts: { living: 1_200_000, saving: 720_000, emergency: 240_000, leisure: 240_000 },
      },
      createdAt: TS,
      updatedAt: TS,
    });
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ version: 1, records: { "2026-08": rec("2026-08", 100), "2026-09": rec("2026-09", 25) } }),
    );
    render(<LockedTierSection plan={plan} />);

    expect(screen.getByTestId("trend-sparkline")).toBeTruthy();
    const labels = screen.getByTestId("trend-month-labels");
    expect(Array.from(labels.children).map((c) => c.textContent)).toEqual(["4월", "5월", "6월", "7월", "8월", "9월"]);
  });

  it("D10: 구간 행 오른쪽은 금액 하나뿐이다 — 막대(progressbar)·배지 없음, '내 월급'은 월급 옆", () => {
    render(<LockedTierSection plan={plan} />);
    const rows = screen.getAllByTestId("bracket-row");
    for (const row of rows) {
      expect(within(row).queryAllByRole("progressbar")).toHaveLength(0);
      const right = row.querySelector('[data-slot="right"]');
      // 오른쪽은 월 저축액 하나 — "월"을 붙인다(아랫줄 "연 …원"과 구별, 고도화 0930).
      expect(right?.textContent).toMatch(/^월 [\d,]+원$/);
    }
    const mine = rows.filter((r) => r.textContent?.includes("내 월급"));
    expect(mine).toHaveLength(1);
    expect(mine[0].querySelector('[data-slot="top"]')?.textContent).toContain("내 월급");
  });
});
