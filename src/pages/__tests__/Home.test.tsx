import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { mockAll, mockOpenToast } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import Home from "@/pages/Home";
import { PLAN_KEY, RECORDS_KEY } from "@/lib/storage";

mockAll();

const TS = "2026-09-01T00:00:00.000Z";
const planA = {
  version: 1,
  id: "plan_a",
  salary: 3_000_000,
  fixedCosts: [{ id: "fc_rent", name: "월세", amount: 600_000, createdAt: TS, updatedAt: TS }],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
  createdAt: TS,
  updatedAt: TS,
};
const sept3of4 = {
  id: "rec_2026-09",
  planId: "plan_a",
  month: "2026-09",
  checked: { living: true, saving: true, emergency: true, leisure: false },
  eligible: ["living", "saving", "emergency", "leisure"],
  rate: 75,
  completedAt: null,
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 29, 9));
});

describe("Home 히어로 — 체크에 바로 반응한다", () => {
  it("3/4에서 마지막 스위치를 켜면 히어로가 '9월 이체 · 1개 남았어요' → '9월 이체 완료'가 되고 완료 토스트는 CTA 위로 뜬다", async () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(planA));
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, records: { "2026-09": sept3of4 } }));
    renderWithRouter(<Home />);

    const hero = screen.getByTestId("dday-hero");
    expect(hero.textContent).toContain("9월 이체");
    expect(hero.textContent).toContain("1개 남았어요");
    expect(hero.textContent).toContain("10월 25일 월급날까지 D-26");

    fireEvent.click(within(screen.getByTestId("checklist-card")).getByRole("switch", { name: "여가 통장 이체 완료" }));

    await waitFor(() => expect(screen.getByTestId("dday-hero").textContent).toContain("9월 이체 완료"));
    expect(screen.getByTestId("dday-hero").textContent).toContain("계획대로 옮겼어요");
    expect(mockOpenToast).toHaveBeenCalledWith("9월 이체를 모두 체크했어요", { higherThanCTA: true });
  });

  it("Top 제목은 앱 이름 '월급쪼개기'다", () => {
    renderWithRouter(<Home />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("월급쪼개기");
  });
});
