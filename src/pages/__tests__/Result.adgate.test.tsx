import { describe, it, expect, vi } from "vitest";
import React from "react";
import { screen } from "@testing-library/react";
import { mockAll, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import type { PlanDraft } from "@/lib/types";

mockAll();

// 광고 ID가 있는 빌드를 흉내 낸다 — Result는 모듈 로드 때 env를 읽으므로 import 전에 넣는다.
vi.stubEnv("VITE_TOSS_AD_SLOT_ID", "ag-reward");

// 게이트가 받은 prop을 DOM에 적는 목 — 어떤 광고 ID·문구로 잠갔는지 본다.
vi.doMock("@/components/TossRewardAd", () => ({
  TossRewardAd: ({ adGroupId, description, children }: { adGroupId: string; description?: string; children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "reward-gate", "data-ad-group-id": adGroupId, "data-description": description }, children),
}));

const { default: Result } = await import("@/pages/Result");

const base: PlanDraft = { salary: 3_000_000, fixedCosts: [], presetId: "custom", ratios: [50, 30, 10, 10], payday: 25 };

function renderWith(ratios: PlanDraft["ratios"]) {
  // mockLocation.state는 null로 선언돼 있다(목 헬퍼) — 다른 테스트와 같은 방식으로 넓혀 넣는다.
  mockLocation.state = { draft: { ...base, ratios } } as unknown as null;
  return renderWithRouter(React.createElement(Result));
}

describe("잠금 층 광고 게이트 — 약속한 내용이 있을 때만 잠근다 (review 0930 D-4)", () => {
  it("저축·비상금이 있으면 광고 ID로 잠그고 '1년 뒤 모이는 돈과 월급 구간별 저축 비교'를 말한다", () => {
    renderWith([50, 30, 10, 10]);
    const gate = screen.getByTestId("reward-gate");
    expect(gate.getAttribute("data-ad-group-id")).toBe("ag-reward");
    expect(gate.getAttribute("data-description")).toContain("월급 구간별 저축 비교");
  });

  it("저축 0% · 비상금만 있으면 문구가 비상금·이행 추이를 말한다(없는 저축 비교를 약속하지 않는다)", () => {
    renderWith([80, 0, 10, 10]);
    const gate = screen.getByTestId("reward-gate");
    expect(gate.getAttribute("data-ad-group-id")).toBe("ag-reward");
    expect(gate.getAttribute("data-description")).not.toContain("저축 비교");
  });

  it("저축·비상금이 둘 다 0%면 광고 없이 연다(빈 약속으로 광고를 보게 하지 않는다)", () => {
    renderWith([100, 0, 0, 0]);
    expect(screen.getByTestId("reward-gate").getAttribute("data-ad-group-id")).toBe("");
  });
});
