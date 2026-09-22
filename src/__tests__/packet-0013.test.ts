import { describe, it, expect, vi } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";

import {
  mockTds,
  mockAppsInToss,
  mockAnalytics,
  mockNavigate,
  mockRequestReviewOnce,
} from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS, MSG } from "@/lib/constants";
import type { Plan } from "@/lib/types";

// react-router-dom: keep the REAL useLocation (so MemoryRouter initialEntries state flows
// through), only stub useNavigate for assertions — same pattern as packet-0011.
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// @/components/TossRewardAd: unlike the shared mockTossRewardAd() helper (which renders
// children directly and would make locked content indistinguishable from free content),
// this mock renders a locked placeholder and NEVER renders children. If the free-tier
// bucket rows still appear in the DOM, that proves they live outside this gate — that's
// exactly what F1-AC1 requires ("이 무료 층은 TossRewardAd 바깥에 렌더된다").
vi.mock("@/components/TossRewardAd", () => ({
  TossRewardAd: ({ slotId }: { slotId?: string }) =>
    React.createElement(
      "div",
      { "data-testid": "reward-gate-locked", "data-slot-id": slotId ?? "" },
      "광고 시청 후 확인",
    ),
}));

mockTds();
mockAppsInToss();
mockAnalytics();

import Result from "@/pages/Result";

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

function renderResult(state?: { justSaved: boolean }) {
  return renderWithRouter(React.createElement(Result), {
    initialEntries: [{ pathname: "/result", state: state ?? null }],
  });
}

describe("Result 화면 (/result) 무료 층 + 잠금 층·배너·공유", () => {
  describe("F1-AC1[P0]: 저장된 Plan — 4칸 배분이 TossRewardAd 바깥(무료 층)에 표시된다", () => {
    it("AC1a: bucket-row 4개에 생활비 1,150,000원·저축 690,000원·비상금 230,000원·여가 230,000원이 표시된다", () => {
      seedLocalStorage({ [STORAGE_KEYS.plan]: makePlan() });

      renderResult();

      const rows = screen.getAllByTestId("bucket-row");
      expect(rows).toHaveLength(4);
      expect(rows[0]).toHaveTextContent("생활비");
      expect(rows[0]).toHaveTextContent("1,150,000원");
      expect(rows[1]).toHaveTextContent("저축");
      expect(rows[1]).toHaveTextContent("690,000원");
      expect(rows[2]).toHaveTextContent("비상금");
      expect(rows[2]).toHaveTextContent("230,000원");
      expect(rows[3]).toHaveTextContent("여가");
      expect(rows[3]).toHaveTextContent("230,000원");
    });

    it("AC1b: 4칸 배분은 잠금 게이트(TossRewardAd)가 아무 콘텐츠도 열지 않았을 때도 보인다", () => {
      seedLocalStorage({ [STORAGE_KEYS.plan]: makePlan() });

      renderResult();

      // TossRewardAd 목은 children을 절대 렌더하지 않는다 — 그래도 무료 층은 살아있다.
      expect(screen.getByTestId("reward-gate-locked")).toBeInTheDocument();
      expect(screen.getAllByTestId("bucket-row")).toHaveLength(4);
    });
  });

  describe("F1-AC2[P0]: justSaved 여부에 따른 저장 완료 Toast", () => {
    it("AC2a: state {justSaved:true}로 진입하면 Toast '계획을 저장했어요'가 1회 표시되고 requestReviewOnce가 호출된다", () => {
      seedLocalStorage({ [STORAGE_KEYS.plan]: makePlan() });

      renderResult({ justSaved: true });

      expect(screen.getAllByText(MSG.saved)).toHaveLength(1);
      expect(mockRequestReviewOnce).toHaveBeenCalledTimes(1);
    });

    it("AC2b: state 없이 진입하면 Toast가 표시되지 않고 requestReviewOnce도 호출되지 않는다", () => {
      seedLocalStorage({ [STORAGE_KEYS.plan]: makePlan() });

      renderResult(undefined);

      expect(screen.queryByText(MSG.saved)).not.toBeInTheDocument();
      expect(mockRequestReviewOnce).not.toHaveBeenCalled();
    });
  });

  describe("F1-AC3[P0]: 저장된 Plan이 없음 — 빈 상태 + '계획 만들기'", () => {
    it("AC3a: Plan이 없으면 data-testid='result-empty'와 '계획 만들기' 버튼이 표시된다", () => {
      renderResult();

      expect(screen.getByTestId("result-empty")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "계획 만들기" })).toBeInTheDocument();
      expect(screen.queryByTestId("bucket-row")).not.toBeInTheDocument();
    });

    it("AC3b: '계획 만들기'를 탭하면 /setup으로 이동한다", () => {
      renderResult();

      fireEvent.click(screen.getByRole("button", { name: "계획 만들기" }));

      expect(mockNavigate).toHaveBeenCalledWith("/setup");
    });
  });
});
