import { describe, it, expect } from "vitest";
import React from "react";
import { screen } from "@testing-library/react";

import { mockTds } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import type { Plan } from "@/lib/types";

mockTds();

import IncomeScenarioSection from "@/components/IncomeScenarioSection";

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    version: 1,
    salary: 3000000,
    payday: 25,
    fixedCosts: [{ id: "f1", name: "월세", amount: 700000 }],
    presetId: "basic_5311",
    ratios: { living: 50, saving: 30, emergency: 10, leisure: 10 },
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("소득 구간 비교 섹션 (Result 잠금 층 컴포넌트)", () => {
  describe("AC-1[P0]: salary 3,000,000 / 고정비 700,000 / 50-30-10-10", () => {
    it("AC-1a: should render 5 scenario rows", () => {
      const plan = makePlan();
      renderWithRouter(React.createElement(IncomeScenarioSection, { plan }));

      const rows = screen.getAllByTestId("scenario-row");
      expect(rows).toHaveLength(5);
    });

    it("AC-1b: should include '연 4,680,000원' in the first row", () => {
      const plan = makePlan();
      renderWithRouter(React.createElement(IncomeScenarioSection, { plan }));

      const rows = screen.getAllByTestId("scenario-row");
      expect(rows[0]).toHaveTextContent("연 4,680,000원");
    });
  });

  describe("AC-2: salary 1,200,000 / 고정비 600,000", () => {
    it("AC-2a: should render 4 scenario rows", () => {
      const plan = makePlan({
        salary: 1200000,
        fixedCosts: [{ id: "f1", name: "월세", amount: 600000 }],
      });
      renderWithRouter(React.createElement(IncomeScenarioSection, { plan }));

      const rows = screen.getAllByTestId("scenario-row");
      expect(rows).toHaveLength(4);
    });

    it("AC-2b: should start from the 700,000원 salary bracket", () => {
      const plan = makePlan({
        salary: 1200000,
        fixedCosts: [{ id: "f1", name: "월세", amount: 600000 }],
      });
      renderWithRouter(React.createElement(IncomeScenarioSection, { plan }));

      const rows = screen.getAllByTestId("scenario-row");
      expect(rows[0]).toHaveTextContent("700,000원");
    });
  });

  describe("AC-3[P0]: 현재 월급 행에만 '지금' Badge 표시", () => {
    it("AC-3a: should show exactly one '지금' badge", () => {
      const plan = makePlan();
      renderWithRouter(React.createElement(IncomeScenarioSection, { plan }));

      const badges = screen.getAllByText("지금");
      expect(badges).toHaveLength(1);
    });

    it("AC-3b: the '지금' badge should sit inside the row matching the current salary", () => {
      const plan = makePlan();
      renderWithRouter(React.createElement(IncomeScenarioSection, { plan }));

      const rows = screen.getAllByTestId("scenario-row");
      const currentRow = rows.find((row) => row.textContent?.includes("지금"));

      expect(currentRow).toBeDefined();
      expect(currentRow).toHaveTextContent("3,000,000원");

      const otherRows = rows.filter((row) => row !== currentRow);
      otherRows.forEach((row) => {
        expect(row).not.toHaveTextContent("지금");
      });
    });
  });

  describe("표현: 월 저축 상대 비교 MiniBar", () => {
    it("should render one progressbar per scenario row", () => {
      const plan = makePlan();
      renderWithRouter(React.createElement(IncomeScenarioSection, { plan }));

      const bars = screen.getAllByRole("progressbar");
      expect(bars).toHaveLength(5);
    });
  });
});
