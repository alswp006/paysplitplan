import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { LockedTierSection } from "@/components/result/LockedTierSection";

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
  it("극단값(월급 1억 · 남는 돈 1원)이면 1억 초과·저축 0원 비교 행 없이 내 월급 행 1개만 보인다", () => {
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
});
