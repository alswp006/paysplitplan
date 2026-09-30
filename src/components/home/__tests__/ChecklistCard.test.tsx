import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockRouter, mockOpenToast } from "@/__tests__/__helpers__/mocks";
import { ChecklistCard } from "@/components/home/ChecklistCard";
import * as recordToggle from "@/lib/recordToggle";
import { loadRecords, PLAN_KEY } from "@/lib/storage";
import type { SalaryPlan } from "@/lib/types";

mockTds();
mockAppsInToss();
mockRouter();

const TS = "2026-09-01T00:00:00.000Z";
const plan: SalaryPlan = {
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T02:00:00.000Z"));
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
});

function renderCard() {
  return render(
    <MemoryRouter>
      <ChecklistCard plan={plan} />
    </MemoryRouter>,
  );
}

describe("ChecklistCard", () => {
  it("행마다 통장명·금액과 Switch를 그리고 카드 하나로 묶는다", () => {
    renderCard();
    expect(screen.getAllByTestId("checklist-card")).toHaveLength(1);
    expect(screen.getAllByTestId("checklist-row")).toHaveLength(4);
    expect(screen.getByText(/저축 통장 · 720,000원/)).toBeInTheDocument();
  });

  it("행 탭은 토글하지 않고, 스위치를 누르면 한 번만 토글되어 이번 달 기록에 저장된다", async () => {
    const toggle = vi.spyOn(recordToggle, "toggleRecordItem");
    renderCard();
    const row = screen.getAllByTestId("checklist-row")[1];
    fireEvent.click(row);
    expect(toggle).toHaveBeenCalledTimes(0);
    expect(screen.getByTestId("progress-text")).toHaveTextContent("0/4 완료 · 0%");

    fireEvent.click(screen.getByRole("switch", { name: "저축 통장 이체 완료" }));
    await waitFor(() => expect(screen.getByTestId("progress-text")).toHaveTextContent("1/4 완료 · 25%"));
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(loadRecords().records["2026-09"].checked.saving).toBe(true);
    expect(mockOpenToast).not.toHaveBeenCalled();
    toggle.mockRestore();
  });
});
