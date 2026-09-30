import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate, mockOpenToast } from "@/__tests__/__helpers__/mocks";
import Plan from "@/pages/Plan";
import { isValidDraft } from "@/lib/validate";
import { PLAN_KEY } from "@/lib/storage";
import type { FixedCost, PlanDraft, SalaryPlan } from "@/lib/types";

mockTds();
mockAppsInToss();
mockRouter();

// ── 계약 (Coder가 이 동작대로 만든다) ──
// src/lib/planForm.ts — 월급·월급날 원문 검증 / 나눌 돈 미리보기 문구 / buildDraft(유효할 때만 PlanDraft, 아니면 null)
// src/pages/Plan.tsx (default export)
//   - 저장된 계획(loadPlan)이 있으면 월급 칸은 천 단위 쉼표로("3,000,000"), 월급날·고정비·비율을 채우고
//     presetId는 저장값이 아니라 resolvePresetId(ratios)로 복원한다. 없으면 월급 '', 월급날 '25', p532, 고정비 없음.
//   - 월급 칸 label '월급', 월급날 칸 label '월급날'(둘 다 inputMode numeric). help = 에러 ?? 안내.
//     월급 안내는 formatManwon(salary) → '300만 원', 월급날 안내는 '매달 25일처럼 날짜만 입력해요'.
//   - data-testid="available-preview": '나눌 돈 {n}원'. 월급이 유효하지 않거나 나눌 돈이 0 이하면 '나눌 돈 -원'(음수 금지).
//   - 고정비 행: ListRow contents(top=이름, bottom='500,000원'), 빈 목록이면 안내 '월세·통신비처럼 매달 나가는 돈을 넣어 주세요'.
//   - '고정비 추가' 버튼 → FixedCostSheet(role=dialog). 10개면 시트 대신 openToast('고정비는 최대 10개까지 추가할 수 있어요').
//     추가가 끝나면 시트는 닫힌다.
//   - 1차 CTA는 SubmitFooter '세팅표 보기'. 월급이 빈 값이면 enabled이고 탭하면 '월급을 입력해주세요'(제출 안 함),
//     그 외 검증 실패(월급·월급날·고정비 합계)는 disabled.
//   - 제출: logClick('plan_submit') → navigate('/result', { state: { draft } }). draft는 PlanDraft(id·createdAt·updatedAt·version 없음).

const { logClick } = vi.hoisted(() => ({ logClick: vi.fn() }));

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  logClick,
}));

const TS = "2026-09-01T00:00:00.000Z";
const SALARY_ERR_EMPTY = "월급을 입력해주세요";
const SALARY_ERR_MAX = "1억 원 이하로 입력해주세요";
const SALARY_ERR_FIXED = "고정비가 월급보다 많아요. 금액을 확인해주세요";
const SALARY_ERR_NAN = "숫자만 입력해주세요";
const PAYDAY_HELP = "매달 25일처럼 날짜만 입력해요";
const EMPTY_FIXED_HINT = "월세·통신비처럼 매달 나가는 돈을 넣어 주세요";
const MAX_TOAST = "고정비는 최대 10개까지 추가할 수 있어요";
const CTA = "세팅표 보기";

const rent: FixedCost = { id: "fc_rent", name: "월세", amount: 500_000, createdAt: TS, updatedAt: TS };
const phone: FixedCost = { id: "fc_phone", name: "통신비", amount: 100_000, createdAt: TS, updatedAt: TS };

// 예시 A: 300만 원 − 고정비 60만 원 = 240만 원
const planA: SalaryPlan = {
  version: 1,
  id: "plan_a",
  salary: 3_000_000,
  fixedCosts: [rent, phone],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
  createdAt: TS,
  updatedAt: TS,
};

function seed(plan: SalaryPlan) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}

function costs(n: number): FixedCost[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `fc_${i}`,
    name: `항목${i + 1}`,
    amount: 10_000,
    createdAt: TS,
    updatedAt: TS,
  }));
}

function renderPlan() {
  return render(React.createElement(MemoryRouter, null, React.createElement(Plan)));
}

const salaryInput = () => screen.getByLabelText("월급") as HTMLInputElement;
const paydayInput = () => screen.getByLabelText("월급날") as HTMLInputElement;
const cta = () => screen.getByRole("button", { name: CTA }) as HTMLButtonElement;
const preview = () => screen.getByTestId("available-preview");

function typeSalary(value: string) {
  fireEvent.change(salaryInput(), { target: { value } });
}
function typePayday(value: string) {
  fireEvent.change(paydayInput(), { target: { value } });
}

async function addCost(name: string, amount: string) {
  fireEvent.click(screen.getByRole("button", { name: "고정비 추가" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/이름/), { target: { value: name } });
  fireEvent.change(within(dialog).getByLabelText(/금액/), { target: { value: amount } });
  fireEvent.click(within(dialog).getByRole("button", { name: "추가" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

function submittedDraft(): PlanDraft {
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  const [path, options] = mockNavigate.mock.calls[0];
  expect(path).toBe("/result");
  return (options as { state: { draft: PlanDraft } }).state.draft;
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockOpenToast.mockClear();
  logClick.mockClear();
});

describe("계획 짜기 화면 (/plan)", () => {
  it("AC-1[P0]: 월급 300만 원에 월세·통신비를 추가하면 '300만 원'과 '나눌 돈 2,400,000원'이 보이고, 제출하면 초안이 /result로 넘어간다", async () => {
    renderPlan();
    typeSalary("3000000");
    await addCost("월세", "500000");
    await addCost("통신비", "100000");

    expect(screen.getByText("300만 원")).toBeInTheDocument();
    expect(preview().textContent).toBe("나눌 돈 2,400,000원");
    expect(screen.getByText("월세")).toBeInTheDocument();
    expect(screen.getByText("500,000원")).toBeInTheDocument();
    expect(screen.getByText("통신비")).toBeInTheDocument();
    expect(screen.getByText("100,000원")).toBeInTheDocument();

    expect(cta().disabled).toBe(false);
    fireEvent.click(cta());

    const draft = submittedDraft();
    expect(draft.salary).toBe(3_000_000);
    expect(draft.payday).toBe(25);
    expect(draft.presetId).toBe("p532");
    expect(draft.ratios).toEqual([50, 30, 10, 10]);
    expect(draft.fixedCosts.map((c) => [c.name, c.amount])).toEqual([
      ["월세", 500_000],
      ["통신비", 100_000],
    ]);
    expect(Object.keys(draft).sort()).toEqual(["fixedCosts", "payday", "presetId", "ratios", "salary"]);
    for (const key of ["id", "createdAt", "updatedAt", "version"]) expect(draft).not.toHaveProperty(key);
    expect(isValidDraft(draft)).toBe(true);
  });

  it("AC-1[P0]: 제출은 logClick('plan_submit')을 부른 뒤에 navigate한다", () => {
    seed(planA);
    renderPlan();
    fireEvent.click(cta());

    expect(logClick).toHaveBeenCalledWith("plan_submit");
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const submitCall = logClick.mock.calls.findIndex((c) => c[0] === "plan_submit");
    expect(logClick.mock.invocationCallOrder[submitCall]).toBeLessThan(mockNavigate.mock.invocationCallOrder[0]);
  });

  it("AC-2[P0]: 월급이 빈 값이면 버튼은 enabled이고, 탭하면 '월급을 입력해주세요'가 보이며 이동하지 않는다", () => {
    renderPlan();
    expect(cta().disabled).toBe(false);

    fireEvent.click(cta());

    expect(screen.getAllByText(SALARY_ERR_EMPTY).length).toBeGreaterThanOrEqual(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(logClick.mock.calls.some((c) => c[0] === "plan_submit")).toBe(false);
  });

  it("AC-2[P0]: 월급 100000001이면 '1억 원 이하로 입력해주세요'와 disabled, 100000000은 통과한다", () => {
    renderPlan();
    typeSalary("100000001");
    expect(screen.getAllByText(SALARY_ERR_MAX).length).toBeGreaterThanOrEqual(1);
    expect(cta().disabled).toBe(true);

    typeSalary("100000000");
    expect(screen.queryByText(SALARY_ERR_MAX)).toBeNull();
    expect(cta().disabled).toBe(false);
  });

  it("AC-2[P0]: 월급 1000000에 고정비 1000000이면 '고정비가 월급보다 많아요…'와 disabled, 고정비가 월급보다 작으면 풀린다", () => {
    seed({ ...planA, fixedCosts: [{ ...rent, amount: 1_000_000 }] });
    renderPlan();
    typeSalary("1000000");
    expect(screen.getAllByText(SALARY_ERR_FIXED).length).toBeGreaterThanOrEqual(1);
    expect(cta().disabled).toBe(true);
    fireEvent.click(cta());
    expect(mockNavigate).not.toHaveBeenCalled();

    typeSalary("1000001");
    expect(screen.queryByText(SALARY_ERR_FIXED)).toBeNull();
    expect(cta().disabled).toBe(false);
  });

  it.each(["32", "0", "", "2.5", "abc"])(
    "AC-3[P0]: 월급날 '%s'이면 월급날 에러가 보이고 버튼이 disabled이며 원문이 그대로 남는다",
    (raw) => {
      renderPlan();
      typeSalary("3000000");
      typePayday(raw);

      expect(paydayInput().value).toBe(raw);
      expect(paydayInput().getAttribute("aria-invalid")).toBe("true");
      expect(screen.queryByText(PAYDAY_HELP)).toBeNull();
      expect(cta().disabled).toBe(true);
      fireEvent.click(cta());
      expect(mockNavigate).not.toHaveBeenCalled();
    },
  );

  it.each(["1", "31"])("AC-3[P0]: 월급날 경계값 '%s'는 통과하고 초안 payday로 들어간다", (raw) => {
    renderPlan();
    typeSalary("3000000");
    typePayday(raw);

    expect(paydayInput().getAttribute("aria-invalid")).toBeNull();
    expect(cta().disabled).toBe(false);
    fireEvent.click(cta());
    expect(submittedDraft().payday).toBe(Number(raw));
  });

  it("AC-3[P0]: 고정비가 10개면 '고정비 추가'에서 Toast가 뜨고 시트는 열리지 않으며, 9개면 시트가 열린다", () => {
    seed({ ...planA, salary: 3_000_000, fixedCosts: costs(10) });
    const { unmount } = renderPlan();
    fireEvent.click(screen.getByRole("button", { name: "고정비 추가" }));

    expect(mockOpenToast.mock.calls.map((c) => c[0])).toContain(MAX_TOAST);
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();

    mockOpenToast.mockClear();
    seed({ ...planA, fixedCosts: costs(9) });
    renderPlan();
    fireEvent.click(screen.getByRole("button", { name: "고정비 추가" }));

    expect(mockOpenToast).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it.each(["", "0", "abc", "3,000원"])("AC-4[P0]: 월급 '%s'이면 나눌 돈 미리보기에 음수가 나오지 않는다", (raw) => {
    renderPlan();
    typeSalary(raw);

    expect(preview().textContent).toBe("나눌 돈 -원");
    expect(preview().textContent).not.toMatch(/-\d/);
  });

  it("AC-4[P0]: 월급 400000에 고정비 500000이면 '나눌 돈 -원'이고 음수 금액은 없다", () => {
    seed({ ...planA, fixedCosts: [rent] });
    renderPlan();
    typeSalary("400000");

    expect(preview().textContent).toBe("나눌 돈 -원");
    expect(preview().textContent).not.toMatch(/-\d/);
  });

  it.each(["abc", "3,000원"])("AC-4[P0]: 월급 '%s'이면 '숫자만 입력해주세요'가 보이고 원문·disabled가 유지된다", (raw) => {
    renderPlan();
    typeSalary(raw);

    expect(screen.getAllByText(SALARY_ERR_NAN).length).toBeGreaterThanOrEqual(1);
    expect(cta().disabled).toBe(true);
    if (raw === "abc") expect(salaryInput().value).toBe("abc");
  });

  it("AC-5[P0]: 저장된 예시 A로 진입하면 월급 '3,000,000'과 고정비 2행이 채워지고, 그대로 제출하면 id가 ['fc_rent','fc_phone']이다", () => {
    seed(planA);
    renderPlan();

    expect(salaryInput().value).toBe("3,000,000");
    expect(paydayInput().value).toBe("25");
    expect(screen.getByText("월세")).toBeInTheDocument();
    expect(screen.getByText("통신비")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_FIXED_HINT)).toBeNull();
    expect(preview().textContent).toBe("나눌 돈 2,400,000원");

    fireEvent.click(cta());
    const draft = submittedDraft();
    expect(draft.fixedCosts.map((c) => c.id)).toEqual(["fc_rent", "fc_phone"]);
    expect(draft.salary).toBe(3_000_000);
    expect(isValidDraft(draft)).toBe(true);
  });

  it("AC-5[P0]: 저장된 계획이 없으면 월급날 '25', 프리셋 기본 5:3:1:1, 빈 고정비 안내가 보이고 월급 칸은 비어 있다", () => {
    renderPlan();

    expect(salaryInput().value).toBe("");
    expect(paydayInput().value).toBe("25");
    expect(screen.getByRole("button", { name: "기본 5:3:1:1", pressed: true })).toBeInTheDocument();
    expect(screen.getByText(EMPTY_FIXED_HINT)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("AC-5[P1]: 프리셋은 저장된 presetId가 아니라 비율로 복원한다(resolvePresetId)", () => {
    seed({ ...planA, presetId: "custom", ratios: [40, 40, 10, 10] });
    const { unmount } = renderPlan();
    expect(screen.getByRole("button", { name: "저축 집중 4:4:1:1", pressed: true })).toBeInTheDocument();
    fireEvent.click(cta());
    expect(submittedDraft().presetId).toBe("p442");
    unmount();

    mockNavigate.mockClear();
    seed({ ...planA, presetId: "p532", ratios: [55, 25, 10, 10] });
    renderPlan();
    expect(screen.getByRole("button", { name: "직접 조정", pressed: true })).toBeInTheDocument();
    fireEvent.click(cta());
    const draft = submittedDraft();
    expect(draft.presetId).toBe("custom");
    expect(draft.ratios).toEqual([55, 25, 10, 10]);
  });

  it("Layout: 1차 CTA는 하나뿐이고 버튼이 중첩되지 않으며 숫자 칸은 숫자 키패드를 쓴다", () => {
    const { container } = renderPlan();

    expect(screen.getAllByRole("button", { name: CTA })).toHaveLength(1);
    expect(container.querySelector("button button")).toBeNull();
    expect(screen.getByText("계획 짜기")).toBeInTheDocument();
    expect(salaryInput().getAttribute("inputmode")).toBe("numeric");
    expect(paydayInput().getAttribute("inputmode")).toBe("numeric");
  });
});
