import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import History from "@/pages/History";
import { RECORDS_KEY } from "@/lib/storage";

mockAll();

vi.mock("@/components/AdSlot", async () => {
  const R = await import("react");
  return { AdSlot: () => R.createElement("div", { "data-testid": "ad-slot" }) };
});

const TS = "2026-09-01T00:00:00.000Z";

function record(month: string, rate: number) {
  const on = Math.round((rate / 100) * 4);
  return {
    id: `rec_${month}`,
    planId: "plan_a",
    month,
    checked: { living: on > 0, saving: on > 1, emergency: on > 2, leisure: on > 3 },
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
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 29, 9, 0, 0));
  mockNavigate.mockClear();
});

describe("History 화면", () => {
  it("최신 월부터 행을 보여주고 100%인 행에만 '완료'가 붙는다", () => {
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ version: 1, records: { "2026-07": record("2026-07", 100), "2026-09": record("2026-09", 75) } }),
    );
    renderWithRouter(<History />, { initialEntries: ["/history"] });

    const rows = screen.getAllByTestId("month-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("2026년 9월");
    expect(rows[1].textContent).toContain("2026년 7월");
    expect(screen.getAllByText("완료")).toHaveLength(1);
  });

  it("기록이 없으면 빈 상태를 보여주고 버튼이 홈으로 이동한다", () => {
    renderWithRouter(<History />, { initialEntries: ["/history"] });

    expect(screen.getByText("아직 기록이 없어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이번 달 체크하러 가기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
