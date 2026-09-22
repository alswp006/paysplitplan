import { describe, it, expect } from "vitest";
import React from "react";
import { screen } from "@testing-library/react";

import { mockTds } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import type { MonthRecordMap } from "@/lib/types";

mockTds();

import { TrendSection } from "@/components/TrendSection";

function makeRecords(entries: Record<string, number>): MonthRecordMap {
  const map: MonthRecordMap = {};
  for (const [month, rate] of Object.entries(entries)) {
    map[month] = {
      month,
      checked: [],
      total: 4,
      rate,
      updatedAt: `${month}-01T00:00:00.000Z`,
    };
  }
  return map;
}

describe("[부가] 6개월 이행 추이 섹션 (History 잠금 층 컴포넌트)", () => {
  describe("AC-1[P0]: 2026-04~2026-09 rate [0,50,75,100,100,25]", () => {
    const records = makeRecords({
      "2026-04": 0,
      "2026-05": 50,
      "2026-06": 75,
      "2026-07": 100,
      "2026-08": 100,
      "2026-09": 25,
    });
    const today = new Date(2026, 8, 23); // 2026-09-23

    it("AC-1a: Sparkline에 6개 데이터 포인트가 오래된 달부터 그려진다", () => {
      renderWithRouter(React.createElement(TrendSection, { records, today }));

      const svg = screen.getByTestId("trend-sparkline");
      const paths = svg.querySelectorAll("path");
      // path[1] = line stroke path (M/L commands, one per data point)
      const commands = paths[1].getAttribute("d")?.match(/[ML]/g);
      expect(commands).toHaveLength(6);
      expect(svg).toBeInTheDocument();
    });

    it("AC-1b: data-testid='trend-avg'에 '평균 58%'가 표시된다", () => {
      renderWithRouter(React.createElement(TrendSection, { records, today }));

      const avg = screen.getByTestId("trend-avg");
      expect(avg).toHaveTextContent("평균 58%");
    });

    it("AC-2[P0]: data-testid='trend-full'에 '100% 달성 2개월'이 표시된다", () => {
      renderWithRouter(React.createElement(TrendSection, { records, today }));

      const full = screen.getByTestId("trend-full");
      expect(full).toHaveTextContent("100% 달성 2개월");
    });
  });

  describe("AC-3: 기록이 1개월뿐이면 안내 문구로 대체된다", () => {
    it("should render '두 달 이상 기록되면 추이를 보여드려요' instead of Sparkline", () => {
      const records = makeRecords({ "2026-09": 40 });
      const today = new Date(2026, 8, 23);

      renderWithRouter(React.createElement(TrendSection, { records, today }));

      expect(
        screen.getByText("두 달 이상 기록되면 추이를 보여드려요")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("trend-sparkline")).not.toBeInTheDocument();
      expect(screen.queryByTestId("trend-avg")).not.toBeInTheDocument();
      expect(screen.queryByTestId("trend-full")).not.toBeInTheDocument();
    });
  });

  describe("기록이 없으면 빈 달을 0으로 채우지 않고 제외한다", () => {
    it("should only average months that actually have records", () => {
      // 2026-06, 2026-07 기록 없음(중간 달 skip) — 4개월만 존재
      const records = makeRecords({
        "2026-04": 40,
        "2026-05": 60,
        "2026-08": 80,
        "2026-09": 100,
      });
      const today = new Date(2026, 8, 23);

      renderWithRouter(React.createElement(TrendSection, { records, today }));

      const svg = screen.getByTestId("trend-sparkline");
      const paths = svg.querySelectorAll("path");
      const commands = paths[1].getAttribute("d")?.match(/[ML]/g);
      expect(commands).toHaveLength(4);
      // 평균 = (40+60+80+100)/4 = 70
      expect(screen.getByTestId("trend-avg")).toHaveTextContent("평균 70%");
    });
  });
});
