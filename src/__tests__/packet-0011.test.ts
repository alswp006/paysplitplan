import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";

import {
  mockTds,
  mockAppsInToss,
  mockTossRewardAd,
  mockAnalytics,
  mockNavigate,
} from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/constants";
import type { Plan, PlanDraft } from "@/lib/types";

// react-router-dom: keep the REAL useLocation (so MemoryRouter initialEntries state flows
// through), only stub useNavigate for assertions. mockAll()/mockRouter() would replace
// useLocation with a static object and break state-driven tests here.
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// storage: keep real loadPlan/savePlan behavior by default, but allow overriding savePlan
// per-test (quota failure) via vi.mocked(savePlan).mockReturnValueOnce(...).
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, savePlan: vi.fn(actual.savePlan) };
});

mockTds();
mockAppsInToss();
mockTossRewardAd();
mockAnalytics();

import Ratio from "@/pages/Ratio";
import { savePlan } from "@/lib/storage";

const draft: PlanDraft = {
  salary: 3000000,
  payday: 25,
  fixedCosts: [{ id: "f1", name: "월세", amount: 700000 }],
};

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

function renderRatio(state?: { draft: PlanDraft }) {
  return renderWithRouter(React.createElement(Ratio), {
    initialEntries: [{ pathname: "/ratio", state: state ?? null }],
  });
}

beforeEach(() => {
  vi.mocked(savePlan).mockClear();
});

describe("Ratio 화면 (/ratio) 프리셋·직접 조정", () => {
  describe("AC-1[P0]: state 없이 진입 + 저장된 plan도 없음 — /setup으로 replace 이동", () => {
    it("AC-1a: should navigate to /setup with replace:true and not crash", () => {
      expect(() => renderRatio(undefined)).not.toThrow();

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/setup", { replace: true });
    });

    it("AC-1b: state가 null이어도 저장된 plan이 있으면 /setup으로 이동하지 않고 그 plan의 프리셋을 렌더한다", () => {
      seedLocalStorage({
        [STORAGE_KEYS.plan]: makePlan({
          presetId: "saving_4411",
          ratios: { living: 40, saving: 40, emergency: 10, leisure: 10 },
        }),
      });

      renderRatio(undefined);

      expect(mockNavigate).not.toHaveBeenCalledWith("/setup", { replace: true });
      const chip = screen.getByRole("button", { name: "저축 집중 4:4:1:1" });
      expect(chip).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("AC-2[P0]: '저축 집중 4:4:1:1' Chip 선택 — remaining 2,300,000 기준 미리보기 금액", () => {
    it("AC-2a: should show 저축 920,000원과 생활비 920,000원 after tapping the preset chip", () => {
      renderRatio({ draft });

      fireEvent.click(screen.getByRole("button", { name: "저축 집중 4:4:1:1" }));

      expect(screen.getByTestId("ratio-amount-saving")).toHaveTextContent("920,000원");
      expect(screen.getByTestId("ratio-amount-living")).toHaveTextContent("920,000원");
    });

    it("AC-2b: should also show 비상금 230,000원과 여가 230,000원 for the same preset", () => {
      renderRatio({ draft });

      fireEvent.click(screen.getByRole("button", { name: "저축 집중 4:4:1:1" }));

      expect(screen.getByTestId("ratio-amount-emergency")).toHaveTextContent("230,000원");
      expect(screen.getByTestId("ratio-amount-leisure")).toHaveTextContent("230,000원");
    });
  });

  describe("AC-3[P0]: 직접 조정 — 합계 불일치 시 저장 비활성, 합계 100에서 저장", () => {
    it("AC-3a: 합계가 90이면 저장 버튼이 disabled이고 ratio-sum에 90%가 표시된다", () => {
      renderRatio({ draft });

      // 기본값 50/30/10/10에서 saving만 20으로 바꿔 합계를 90으로 만든다
      fireEvent.change(screen.getByTestId("ratio-input-saving"), { target: { value: "20" } });

      expect(screen.getByTestId("ratio-sum")).toHaveTextContent("90%");
      expect(screen.getByRole("button", { name: "이 비율로 저장" })).toBeDisabled();
    });

    it("AC-3b: 합계가 100(45/35/10/10)이면 저장 시 psp.plan.v1에 presetId:custom과 ratios가 저장되고 /result로 이동한다", () => {
      renderRatio({ draft });

      fireEvent.change(screen.getByTestId("ratio-input-living"), { target: { value: "45" } });
      fireEvent.change(screen.getByTestId("ratio-input-saving"), { target: { value: "35" } });

      const saveButton = screen.getByRole("button", { name: "이 비율로 저장" });
      expect(saveButton).not.toBeDisabled();
      fireEvent.click(saveButton);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.plan) as string);
      expect(stored.presetId).toBe("custom");
      expect(stored.ratios).toEqual({ living: 45, saving: 35, emergency: 10, leisure: 10 });

      expect(mockNavigate).toHaveBeenCalledWith("/result", { state: { justSaved: true } });
    });
  });

  describe("AC-4[P1]: 저장 실패(quota) — Toast를 보여주고 /result로 이동하지 않는다", () => {
    it("AC-4a: savePlan이 quota 실패를 반환하면 Toast 문구가 표시되고 navigate('/result', ...)가 호출되지 않는다", () => {
      vi.mocked(savePlan).mockReturnValueOnce({ ok: false, reason: "quota" });

      renderRatio({ draft });

      fireEvent.click(screen.getByRole("button", { name: "이 비율로 저장" }));

      expect(screen.getByText("저장 공간이 부족해 저장하지 못했어요")).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalledWith(
        "/result",
        expect.objectContaining({ state: { justSaved: true } }),
      );
    });
  });
});
