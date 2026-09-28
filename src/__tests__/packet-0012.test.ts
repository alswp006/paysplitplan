import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  mockTds,
  mockAppsInToss,
  mockRouter,
  mockNavigate,
  mockOpenToast,
  mockDialog,
} from "@/__tests__/__helpers__/mocks";
import { ResultSaveFooter } from "@/components/result/ResultSaveFooter";
import { loadPlan, PLAN_KEY } from "@/lib/storage";
import type { PlanDraft, SalaryPlan } from "@/lib/types";

mockTds();
mockAppsInToss();
mockRouter();

// ResultSaveFooter 계약:
//   <ResultSaveFooter draft={PlanDraft} initiallySaved={boolean} />   (named export)
// - 라벨: 저장 전 '이 계획 저장하기' → 저장 후 '홈에서 이체 체크하기'(탭하면 navigate('/'), savePlan은 부르지 않는다)
// - 저장된 계획은 @/lib/storage의 loadPlan()으로 읽고, isSamePlan(draft, saved)=false면 savePlan 전에
//   useDialog().openConfirm({ title: '저장된 계획을 바꿀까요?', confirmButton: '바꾸기', cancelButton: '닫기', ... })로 묻는다.
//   (true를 돌려주면 '바꾸기', false면 '닫기'다.)
// - 저장 성공: useToast().openToast('계획을 저장했어요') + requestReviewOnce() 1회.
// - savePlan이 {ok:false,error:'QUOTA'}면 openToast('저장 공간이 부족해 저장하지 못했어요'), 라벨 유지, 리뷰 0회.
// - '바꾸기' 확정 시 logClick('plan_overwrite_confirm') 1회.

const { logClick, requestReviewOnce, savePlanSpy, actualSavePlan } = vi.hoisted(() => ({
  logClick: vi.fn(),
  requestReviewOnce: vi.fn(),
  savePlanSpy: vi.fn(),
  actualSavePlan: { fn: undefined as unknown as (draft: unknown) => unknown },
}));

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  logClick,
}));
vi.mock("@/lib/review", () => ({ requestReviewOnce }));
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  actualSavePlan.fn = actual.savePlan as (draft: unknown) => unknown;
  return { ...actual, savePlan: savePlanSpy };
});

const CREATED = "2026-09-01T00:00:00.000Z";
const NOW = "2026-09-29T02:00:00.000Z";

const draftA: PlanDraft = {
  salary: 3_000_000,
  fixedCosts: [{ id: "fc_rent", name: "월세", amount: 600_000, createdAt: CREATED, updatedAt: CREATED }],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
};

const planA: SalaryPlan = { version: 1, id: "plan_a", ...draftA, createdAt: CREATED, updatedAt: CREATED };

function seedPlanA() {
  localStorage.setItem(PLAN_KEY, JSON.stringify(planA));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  savePlanSpy.mockReset().mockImplementation((d) => actualSavePlan.fn(d));
  mockDialog.openConfirm.mockReset().mockImplementation(async () => true);
});

function renderFooter(draft: PlanDraft, initiallySaved = false) {
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ResultSaveFooter, { draft, initiallySaved }),
    ),
  );
}

const saveButton = () => screen.getByRole("button", { name: "이 계획 저장하기" });
const toastMessages = () => mockOpenToast.mock.calls.map((c) => c[0]);

describe("결과 저장 버튼 + 덮어쓰기 확인 (ResultSaveFooter)", () => {
  it("AC-1[P0]: 저장된 계획이 없으면 Dialog 없이 저장하고 Toast·리뷰 1회, 라벨이 바뀌며 탭하면 navigate('/')", async () => {
    renderFooter(draftA);

    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByRole("button", { name: "홈에서 이체 체크하기" })).toBeTruthy());
    expect(mockDialog.openConfirm).toHaveBeenCalledTimes(0);
    expect(savePlanSpy).toHaveBeenCalledTimes(1);
    expect(toastMessages()).toEqual(["계획을 저장했어요"]);
    expect(requestReviewOnce).toHaveBeenCalledTimes(1);
    expect(logClick).not.toHaveBeenCalledWith("plan_overwrite_confirm");
    expect(screen.queryByRole("button", { name: "이 계획 저장하기" })).toBeNull();
    const saved = loadPlan();
    expect(saved?.salary).toBe(3_000_000);
    expect(saved?.createdAt).toBe(saved?.updatedAt);

    expect(mockNavigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "홈에서 이체 체크하기" }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(savePlanSpy).toHaveBeenCalledTimes(1);
  });

  it("AC-1[P0]: initiallySaved=true면 처음부터 '홈에서 이체 체크하기'이고 탭하면 저장 없이 navigate('/')", () => {
    seedPlanA();
    renderFooter(draftA, true);

    expect(screen.queryByRole("button", { name: "이 계획 저장하기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "홈에서 이체 체크하기" }));

    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(savePlanSpy).toHaveBeenCalledTimes(0);
    expect(mockDialog.openConfirm).toHaveBeenCalledTimes(0);
  });

  it("AC-2[P0]: 다른 계획이 저장돼 있으면 savePlan 전에 '저장된 계획을 바꿀까요?'(닫기/바꾸기)를 묻고, '바꾸기' 후 로그·저장·Toast가 이어진다", async () => {
    seedPlanA();
    const before = localStorage.getItem(PLAN_KEY);
    let savePlanCallsWhenAsked = -1;
    let storedWhenAsked: string | null = null;
    mockDialog.openConfirm.mockImplementationOnce(async () => {
      savePlanCallsWhenAsked = savePlanSpy.mock.calls.length;
      storedWhenAsked = localStorage.getItem(PLAN_KEY);
      expect(toastMessages()).toEqual([]);
      expect(requestReviewOnce).toHaveBeenCalledTimes(0);
      return true;
    });
    renderFooter({ ...draftA, salary: 3_500_000 });

    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByRole("button", { name: "홈에서 이체 체크하기" })).toBeTruthy());
    expect(mockDialog.openConfirm).toHaveBeenCalledTimes(1);
    expect(mockDialog.openConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "저장된 계획을 바꿀까요?", confirmButton: "바꾸기", cancelButton: "닫기" }),
    );
    expect(savePlanCallsWhenAsked).toBe(0);
    expect(storedWhenAsked).toBe(before);
    expect(logClick).toHaveBeenCalledTimes(1);
    expect(logClick).toHaveBeenCalledWith("plan_overwrite_confirm");
    expect(savePlanSpy).toHaveBeenCalledTimes(1);
    expect(toastMessages()).toEqual(["계획을 저장했어요"]);
    expect(requestReviewOnce).toHaveBeenCalledTimes(1);
    const saved = loadPlan();
    expect(saved?.salary).toBe(3_500_000);
    expect(saved?.id).toBe("plan_a");
    expect(saved?.createdAt).toBe(CREATED);
    expect(saved?.updatedAt).toBe(NOW);
  });

  it("AC-2[P0]: 확인창에서 '닫기'를 고르면 저장·Toast·리뷰·로그가 모두 0회이고 라벨과 저장값이 그대로다", async () => {
    seedPlanA();
    const before = localStorage.getItem(PLAN_KEY);
    mockDialog.openConfirm.mockImplementationOnce(async () => false);
    renderFooter({ ...draftA, salary: 3_500_000 });

    fireEvent.click(saveButton());

    await waitFor(() => expect(mockDialog.openConfirm).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(savePlanSpy).toHaveBeenCalledTimes(0);
    expect(toastMessages()).toEqual([]);
    expect(requestReviewOnce).toHaveBeenCalledTimes(0);
    expect(logClick).not.toHaveBeenCalledWith("plan_overwrite_confirm");
    expect(localStorage.getItem(PLAN_KEY)).toBe(before);
    expect(loadPlan()?.salary).toBe(3_000_000);
    expect(saveButton()).toBeTruthy();
  });

  it("AC-3[P0]: 저장된 계획과 isSamePlan이면 Dialog 0회로 바로 저장하고 id·createdAt이 그대로다", async () => {
    seedPlanA();
    const sameDraft: PlanDraft = {
      ...draftA,
      presetId: "custom",
      fixedCosts: [{ id: "fc_other", name: "월세", amount: 600_000, createdAt: NOW, updatedAt: NOW }],
    };
    renderFooter(sameDraft);

    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByRole("button", { name: "홈에서 이체 체크하기" })).toBeTruthy());
    expect(mockDialog.openConfirm).toHaveBeenCalledTimes(0);
    expect(savePlanSpy).toHaveBeenCalledTimes(1);
    expect(toastMessages()).toEqual(["계획을 저장했어요"]);
    expect(requestReviewOnce).toHaveBeenCalledTimes(1);
    const saved = loadPlan();
    expect(saved?.id).toBe("plan_a");
    expect(saved?.createdAt).toBe(CREATED);
  });

  it("AC-4[P0]: 저장 실패(QUOTA)면 실패 Toast만 뜨고 라벨은 '이 계획 저장하기' 그대로, 리뷰 0회", async () => {
    savePlanSpy.mockReturnValueOnce({ ok: false, error: "QUOTA" });
    renderFooter(draftA);

    fireEvent.click(saveButton());

    await waitFor(() => expect(toastMessages()).toEqual(["저장 공간이 부족해 저장하지 못했어요"]));
    expect(mockDialog.openConfirm).toHaveBeenCalledTimes(0);
    expect(savePlanSpy).toHaveBeenCalledTimes(1);
    expect(requestReviewOnce).toHaveBeenCalledTimes(0);
    expect(saveButton()).toBeTruthy();
    expect(screen.queryByRole("button", { name: "홈에서 이체 체크하기" })).toBeNull();
  });

  it("AC-4[P0]: '바꾸기' 경로에서도 QUOTA면 실패 Toast, 라벨 유지, 리뷰 0회, 저장값은 기존 그대로", async () => {
    seedPlanA();
    const before = localStorage.getItem(PLAN_KEY);
    savePlanSpy.mockReturnValueOnce({ ok: false, error: "QUOTA" });
    renderFooter({ ...draftA, salary: 3_500_000 });

    fireEvent.click(saveButton());

    await waitFor(() => expect(toastMessages()).toEqual(["저장 공간이 부족해 저장하지 못했어요"]));
    expect(mockDialog.openConfirm).toHaveBeenCalledTimes(1);
    expect(savePlanSpy).toHaveBeenCalledTimes(1);
    expect(requestReviewOnce).toHaveBeenCalledTimes(0);
    expect(saveButton()).toBeTruthy();
    expect(screen.queryByRole("button", { name: "홈에서 이체 체크하기" })).toBeNull();
    expect(localStorage.getItem(PLAN_KEY)).toBe(before);
  });
});
