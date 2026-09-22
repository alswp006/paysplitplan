import { describe, it, expect } from "vitest";
import type { PlanDraft, SetupErrors } from "@/lib/types";

// These functions don't exist yet — tests will fail until implementation is added
// @ts-expect-error - importing non-existent functions for TDD
import { validateSetup, validateFixedCost } from "@/lib/validation";

describe("Packet 0007: Setup 입력 검증", () => {
  describe("AC-1: salary validation with valid inputs", () => {
    it("AC-1a: should return salary error for 99999 (below minimum 100000)", () => {
      const draft: PlanDraft = {
        salary: 99999,
        payday: 15,
        fixedCosts: [],
      };
      const errors = validateSetup(draft);
      expect(errors.salary).toBeDefined();
      expect(errors.salary).not.toBe("");
      expect(errors.salary).toContain("100,000");
    });

    it("AC-1b: should return no errors for valid salary 3000000, payday 25, fixed cost 700000", () => {
      const draft: PlanDraft = {
        salary: 3000000,
        payday: 25,
        fixedCosts: [{ id: "1", name: "월세", amount: 700000 }],
      };
      const errors = validateSetup(draft);
      expect(errors.salary).toBeUndefined();
      expect(errors.payday).toBeUndefined();
      expect(errors.fixedTotal).toBeUndefined();
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it("should return salary error for salary above maximum (100000000 + 1)", () => {
      const draft: PlanDraft = {
        salary: 100000001,
        payday: 15,
        fixedCosts: [],
      };
      const errors = validateSetup(draft);
      expect(errors.salary).toBeDefined();
      expect(errors.salary).toContain("100,000,000");
    });

    it("should return no errors for minimum valid salary (100000)", () => {
      const draft: PlanDraft = {
        salary: 100000,
        payday: 15,
        fixedCosts: [],
      };
      const errors = validateSetup(draft);
      expect(errors.salary).toBeUndefined();
    });

    it("should return no errors for maximum valid salary (100000000)", () => {
      const draft: PlanDraft = {
        salary: 100000000,
        payday: 15,
        fixedCosts: [],
      };
      const errors = validateSetup(draft);
      expect(errors.salary).toBeUndefined();
    });

    it("should return salary error if salary is not integer", () => {
      const draft: PlanDraft = {
        salary: 3000000.5,
        payday: 15,
        fixedCosts: [],
      };
      const errors = validateSetup(draft);
      expect(errors.salary).toBeDefined();
      expect(errors.salary).toContain("정수");
    });
  });

  describe("AC-2: payday and fixedTotal validation", () => {
    it("AC-2a: should return payday error for day 0", () => {
      const draft: PlanDraft = {
        salary: 3000000,
        payday: 0,
        fixedCosts: [],
      };
      const errors = validateSetup(draft);
      expect(errors.payday).toBeDefined();
      expect(errors.payday).not.toBe("");
      expect(errors.payday).toContain("1");
      expect(errors.payday).toContain("31");
    });

    it("AC-2b: should return payday error for day 32", () => {
      const draft: PlanDraft = {
        salary: 3000000,
        payday: 32,
        fixedCosts: [],
      };
      const errors = validateSetup(draft);
      expect(errors.payday).toBeDefined();
      expect(errors.payday).not.toBe("");
    });

    it("AC-2c: should return fixedTotal error when fixed costs equal salary", () => {
      const draft: PlanDraft = {
        salary: 1000000,
        payday: 15,
        fixedCosts: [
          { id: "1", name: "월세", amount: 500000 },
          { id: "2", name: "식비", amount: 500000 },
        ],
      };
      const errors = validateSetup(draft);
      expect(errors.fixedTotal).toBeDefined();
      expect(errors.fixedTotal).not.toBe("");
      expect(errors.fixedTotal).toContain("초과");
    });

    it("should return no errors for valid payday (boundary: 1)", () => {
      const draft: PlanDraft = {
        salary: 3000000,
        payday: 1,
        fixedCosts: [],
      };
      const errors = validateSetup(draft);
      expect(errors.payday).toBeUndefined();
    });

    it("should return no errors for valid payday (boundary: 31)", () => {
      const draft: PlanDraft = {
        salary: 3000000,
        payday: 31,
        fixedCosts: [],
      };
      const errors = validateSetup(draft);
      expect(errors.payday).toBeUndefined();
    });

    it("should return fixedTotal error when fixed costs exceed salary", () => {
      const draft: PlanDraft = {
        salary: 1000000,
        payday: 15,
        fixedCosts: [
          { id: "1", name: "월세", amount: 700000 },
          { id: "2", name: "식비", amount: 400000 },
        ],
      };
      const errors = validateSetup(draft);
      expect(errors.fixedTotal).toBeDefined();
    });

    it("should return no fixedTotal error when fixed costs are less than salary", () => {
      const draft: PlanDraft = {
        salary: 1000000,
        payday: 15,
        fixedCosts: [
          { id: "1", name: "월세", amount: 400000 },
          { id: "2", name: "식비", amount: 500000 },
        ],
      };
      const errors = validateSetup(draft);
      expect(errors.fixedTotal).toBeUndefined();
    });

    it("should reject more than 20 fixed cost items", () => {
      const fixedCosts = Array.from({ length: 21 }, (_, i) => ({
        id: `${i}`,
        name: `cost-${i}`,
        amount: 10000,
      }));
      const draft: PlanDraft = {
        salary: 3000000,
        payday: 15,
        fixedCosts,
      };
      const errors = validateSetup(draft);
      expect(errors).toBeDefined();
      // Should have an error related to max items
      expect(Object.keys(errors).length).toBeGreaterThan(0);
    });
  });

  describe("AC-3: validateFixedCost — individual item validation", () => {
    it("AC-3a: should return name error for whitespace-only string", () => {
      const errors = validateFixedCost("  ", 1000);
      expect(errors.name).toBeDefined();
      expect(errors.name).not.toBe("");
    });

    it("AC-3b: should return amount error for 0", () => {
      const errors = validateFixedCost("월세", 0);
      expect(errors.amount).toBeDefined();
      expect(errors.amount).not.toBe("");
      expect(errors.amount).toContain("1");
    });

    it("AC-3c: should return name error for string over 20 characters", () => {
      const longName = "a".repeat(21);
      const errors = validateFixedCost(longName, 1000);
      expect(errors.name).toBeDefined();
      expect(errors.name).not.toBe("");
      expect(errors.name).toContain("20");
    });

    it("should return no errors for valid name and amount", () => {
      const errors = validateFixedCost("월세", 500000);
      expect(errors.name).toBeUndefined();
      expect(errors.amount).toBeUndefined();
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it("should trim whitespace from name before validation", () => {
      const errors = validateFixedCost("  월세  ", 500000);
      expect(errors.name).toBeUndefined();
    });

    it("should return name error for exactly 21 characters (boundary)", () => {
      const name21 = "a".repeat(21);
      const errors = validateFixedCost(name21, 1000);
      expect(errors.name).toBeDefined();
    });

    it("should return no error for exactly 20 characters (boundary)", () => {
      const name20 = "a".repeat(20);
      const errors = validateFixedCost(name20, 1000);
      expect(errors.name).toBeUndefined();
    });

    it("should return no error for exactly 1 character (boundary)", () => {
      const errors = validateFixedCost("a", 1000);
      expect(errors.name).toBeUndefined();
    });

    it("should return no error for amount 1 (boundary)", () => {
      const errors = validateFixedCost("월세", 1);
      expect(errors.amount).toBeUndefined();
    });

    it("should return no error for amount 100000000 (boundary)", () => {
      const errors = validateFixedCost("월세", 100000000);
      expect(errors.amount).toBeUndefined();
    });

    it("should return amount error for amount above 100000000", () => {
      const errors = validateFixedCost("월세", 100000001);
      expect(errors.amount).toBeDefined();
    });

    it("should return amount error for negative amount", () => {
      const errors = validateFixedCost("월세", -1000);
      expect(errors.amount).toBeDefined();
    });

    it("should return name error for empty string", () => {
      const errors = validateFixedCost("", 1000);
      expect(errors.name).toBeDefined();
    });

    it("should trim and validate name correctly", () => {
      // "   a   " trimmed → "a" → 1 char (valid)
      const errors = validateFixedCost("   a   ", 1000);
      expect(errors.name).toBeUndefined();
    });
  });

  describe("Integration: validateSetup with various fixed cost scenarios", () => {
    it("should validate empty fixed costs list", () => {
      const draft: PlanDraft = {
        salary: 3000000,
        payday: 15,
        fixedCosts: [],
      };
      const errors = validateSetup(draft);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it("should validate multiple valid fixed costs", () => {
      const draft: PlanDraft = {
        salary: 5000000,
        payday: 15,
        fixedCosts: [
          { id: "1", name: "월세", amount: 1500000 },
          { id: "2", name: "식비", amount: 1000000 },
          { id: "3", name: "보험", amount: 500000 },
        ],
      };
      const errors = validateSetup(draft);
      expect(errors.salary).toBeUndefined();
      expect(errors.payday).toBeUndefined();
      expect(errors.fixedTotal).toBeUndefined();
    });

    it("should accumulate fixedTotal correctly for validation", () => {
      const draft: PlanDraft = {
        salary: 2000000,
        payday: 15,
        fixedCosts: [
          { id: "1", name: "월세", amount: 1000000 },
          { id: "2", name: "식비", amount: 1000001 },
        ],
      };
      const errors = validateSetup(draft);
      expect(errors.fixedTotal).toBeDefined();
    });
  });

  describe("Error message format (해요체)", () => {
    it("salary error message should use 해요체", () => {
      const draft: PlanDraft = {
        salary: 99999,
        payday: 15,
        fixedCosts: [],
      };
      const errors = validateSetup(draft);
      // Examples: "~해요", "~해야 해요", "~할 수 없어요"
      expect(errors.salary).toMatch(/해[요.]/);
    });

    it("payday error message should use 해요체", () => {
      const draft: PlanDraft = {
        salary: 3000000,
        payday: 0,
        fixedCosts: [],
      };
      const errors = validateSetup(draft);
      expect(errors.payday).toMatch(/해[요.]/);
    });

    it("fixedTotal error message should use 해요체", () => {
      const draft: PlanDraft = {
        salary: 1000000,
        payday: 15,
        fixedCosts: [{ id: "1", name: "월세", amount: 1000000 }],
      };
      const errors = validateSetup(draft);
      expect(errors.fixedTotal).toMatch(/해[요.]/);
    });

    it("validateFixedCost error messages should use 해요체", () => {
      const errors = validateFixedCost("  ", 1000);
      expect(errors.name).toMatch(/해[요.]/);
    });
  });
});
