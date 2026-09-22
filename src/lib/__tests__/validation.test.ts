import { describe, it, expect } from "vitest";
import type { PlanDraft } from "@/lib/types";
import { validateSetup, validateFixedCost, validateSetupInput } from "@/lib/validation";

describe("validateSetup", () => {
  it("월급이 최소값 미만이면 salary 에러를 반환한다", () => {
    const draft: PlanDraft = { salary: 99999, payday: 15, fixedCosts: [] };
    const errors = validateSetup(draft);
    expect(errors.salary).toBeTruthy();
  });

  it("유효한 입력은 에러가 없다", () => {
    const draft: PlanDraft = {
      salary: 3000000,
      payday: 25,
      fixedCosts: [{ id: "1", name: "월세", amount: 700000 }],
    };
    expect(Object.keys(validateSetup(draft))).toHaveLength(0);
  });

  it("월급날이 범위를 벗어나면 payday 에러를 반환한다", () => {
    expect(validateSetup({ salary: 3000000, payday: 0, fixedCosts: [] }).payday).toBeTruthy();
    expect(validateSetup({ salary: 3000000, payday: 32, fixedCosts: [] }).payday).toBeTruthy();
  });

  it("고정비 합계가 월급 이상이면 fixedTotal 에러를 반환한다", () => {
    const draft: PlanDraft = {
      salary: 1000000,
      payday: 15,
      fixedCosts: [{ id: "1", name: "월세", amount: 1000000 }],
    };
    expect(validateSetup(draft).fixedTotal).toBeTruthy();
  });
});

describe("validateFixedCost", () => {
  it("공백만 있는 이름은 name 에러를 반환한다", () => {
    expect(validateFixedCost("  ", 1000).name).toBeTruthy();
  });

  it("금액이 0이면 amount 에러를 반환한다", () => {
    expect(validateFixedCost("월세", 0).amount).toBeTruthy();
  });

  it("이름이 20자를 초과하면 name 에러를 반환한다", () => {
    expect(validateFixedCost("a".repeat(21), 1000).name).toBeTruthy();
  });
});

describe("validateSetupInput", () => {
  it("월급이 최소값 미만이면 invalid를 반환한다", () => {
    const result = validateSetupInput(99999, []);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("고정비 합계가 월급 이상이면 invalid를 반환한다", () => {
    const result = validateSetupInput(1000000, [{ id: "1", name: "월세", amount: 1000000 }]);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("유효한 입력은 valid: true를 반환한다", () => {
    const result = validateSetupInput(3000000, [{ id: "1", name: "월세", amount: 700000 }]);
    expect(result).toEqual({ valid: true });
  });
});
