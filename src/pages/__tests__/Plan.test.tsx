import { describe, it, expect } from "vitest";
import {
  buildDraft,
  formatAvailablePreview,
  validatePaydayInput,
  validateSalaryInput,
} from "@/lib/planForm";
import { isValidDraft } from "@/lib/validate";
import type { FixedCost, Ratios } from "@/lib/types";

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
