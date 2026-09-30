import { describe, it, expect } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { mockAll, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import Plan from "@/pages/Plan";
import {
  buildDraft,
  formatAvailablePreview,
  validatePaydayInput,
  validateSalaryInput,
} from "@/lib/planForm";
import { isValidDraft } from "@/lib/validate";
import type { FixedCost, Ratios } from "@/lib/types";

mockAll();

const TS = "2026-09-01T00:00:00.000Z";
const rent: FixedCost = { id: "fc_rent", name: "월세", amount: 500_000, createdAt: TS, updatedAt: TS };
const ratios: Ratios = [50, 30, 10, 10];

describe("planForm", () => {
  it("월급 원문: 빈 값·숫자 아님·상한·고정비 초과를 구분한다", () => {
    expect(validateSalaryInput("", 0)).toMatchObject({ empty: true, error: "월급을 입력해주세요" });
    expect(validateSalaryInput("3,000원", 0).error).toBe("숫자만 입력해주세요");
    expect(validateSalaryInput("100000001", 0).error).toBe("1억 원 이하로 입력해주세요");
    expect(validateSalaryInput("1000000", 1_000_000).error).toBe("고정비가 월급보다 많아요. 금액을 확인해주세요");
    expect(validateSalaryInput("3,000,000", 600_000)).toMatchObject({ value: 3_000_000, error: null });
  });

  it("월급날 원문은 1~31 정수만 통과한다", () => {
    for (const raw of ["0", "32", "", "2.5", "abc"]) expect(validatePaydayInput(raw).error).not.toBeNull();
    expect(validatePaydayInput("31")).toEqual({ value: 31, error: null });
  });

  it("남는 돈 미리보기는 음수를 보여주지 않는다", () => {
    expect(formatAvailablePreview("3000000", 600_000)).toBe("남는 돈 2,400,000원");
    expect(formatAvailablePreview("400000", 500_000)).toBe("남는 돈 -원");
    expect(formatAvailablePreview("abc", 0)).toBe("남는 돈 -원");
  });

  it("buildDraft는 유효할 때만 초안을 돌려주고 저장 메타 키가 없다", () => {
    const draft = buildDraft({ salaryRaw: "3000000", paydayRaw: "25", fixedCosts: [rent], ratios, presetId: "p532" });
    expect(draft).not.toBeNull();
    expect(isValidDraft(draft)).toBe(true);
    expect(Object.keys(draft!).sort()).toEqual(["fixedCosts", "payday", "presetId", "ratios", "salary"]);
    expect(buildDraft({ salaryRaw: "", paydayRaw: "25", fixedCosts: [], ratios, presetId: "p532" })).toBeNull();
    expect(buildDraft({ salaryRaw: "3000000", paydayRaw: "32", fixedCosts: [], ratios, presetId: "p532" })).toBeNull();
  });
});

describe("Plan 화면 — 입력칸 접근성과 하단 안내", () => {
  it("월급·월급날 칸의 접근성 이름은 placeholder가 아니라 라벨이다", () => {
    mockLocation.state = null;
    renderWithRouter(<Plan />);
    expect(screen.getAllByRole("textbox", { name: "월급" })).toHaveLength(1);
    expect(screen.getAllByRole("textbox", { name: "월급날" })).toHaveLength(1);
    // 기존 라벨 연결도 그대로다
    expect(screen.getByLabelText("월급")).toBe(screen.getByRole("textbox", { name: "월급" }));
  });

  it("비율 합계가 100이 아니면 칸 아래에는 자세한 문구, 하단 안내는 다음 행동 한 줄(같은 문구 중복 없음)", () => {
    renderWithRouter(<Plan />);
    fireEvent.change(screen.getByRole("textbox", { name: "월급" }), { target: { value: "3000000" } });
    fireEvent.click(screen.getByRole("button", { name: "여가 5% 줄이기" }));
    expect(screen.getAllByText("비율 합계를 100%로 맞춰주세요 (현재 95%)")).toHaveLength(1);
    expect(screen.getByText("비율 합계가 100%가 되면 결과를 볼 수 있어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "배분 결과 보기" })).toBeDisabled();
  });
});
