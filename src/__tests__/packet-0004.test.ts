import { describe, it, expect } from "vitest";
import {
  calculateAllocation,
  resolvePresetId,
  isSamePlan,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  PRESETS,
} from "@/lib/plan";
import type { SalaryPlan, PlanDraft } from "@/lib/types";

describe("plan.ts — 도메인 상수 + 배분 계산", () => {
  describe("Constants", () => {
    it("should export CATEGORY_LABEL with all 4 categories", () => {
      expect(CATEGORY_LABEL).toBeDefined();
      expect(CATEGORY_LABEL).toHaveProperty("living");
      expect(CATEGORY_LABEL).toHaveProperty("saving");
      expect(CATEGORY_LABEL).toHaveProperty("emergency");
      expect(CATEGORY_LABEL).toHaveProperty("leisure");
    });

    it("should export CATEGORY_ORDER as array of 4 keys", () => {
      expect(CATEGORY_ORDER).toBeDefined();
      expect(Array.isArray(CATEGORY_ORDER)).toBe(true);
      expect(CATEGORY_ORDER).toHaveLength(4);
      expect(CATEGORY_ORDER).toEqual([
        "living",
        "saving",
        "emergency",
        "leisure",
      ]);
    });

    it("should export PRESETS with correct preset definitions", () => {
      expect(PRESETS).toBeDefined();
      expect(PRESETS).toHaveProperty("p532");
      expect(PRESETS).toHaveProperty("p442");
      expect(PRESETS).toHaveProperty("p622");

      expect(PRESETS.p532.ratios).toEqual([50, 30, 10, 10]);
      expect(PRESETS.p532.name).toContain("기본");

      expect(PRESETS.p442.ratios).toEqual([40, 40, 10, 10]);
      expect(PRESETS.p442.name).toContain("저축");

      expect(PRESETS.p622.ratios).toEqual([60, 20, 10, 10]);
      expect(PRESETS.p622.name).toContain("여유");
    });
  });

  describe("calculateAllocation", () => {
    it("AC-1: should calculate allocation with fixed costs subtracted", () => {
      const fixedCosts = [
        {
          id: "fc1",
          name: "rent",
          amount: 500000,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
        {
          id: "fc2",
          name: "utility",
          amount: 100000,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ];

      const result = calculateAllocation(3000000, fixedCosts, [50, 30, 10, 10]);

      expect(result.fixedTotal).toBe(600000);
      expect(result.available).toBe(2400000);
      expect(result.amounts.living).toBe(1200000);
      expect(result.amounts.saving).toBe(720000);
      expect(result.amounts.emergency).toBe(240000);
      expect(result.amounts.leisure).toBe(240000);

      // Verify total allocation equals available
      const allocationSum =
        result.amounts.living +
        result.amounts.saving +
        result.amounts.emergency +
        result.amounts.leisure;
      expect(allocationSum).toBe(2400000);
    });

    it("AC-2: should distribute available amount correctly with Math.floor and add remainder to living", () => {
      // For available = 1234567, with no actual fixed costs
      const fixedCosts = [
        {
          id: "fc1",
          name: "rent",
          amount: 600000,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ];

      const result = calculateAllocation(1834567, fixedCosts, [50, 30, 10, 10]);

      expect(result.available).toBe(1234567);
      expect(result.amounts.saving).toBe(370370); // floor(1234567 * 0.3)
      expect(result.amounts.emergency).toBe(123456); // floor(1234567 * 0.1)
      expect(result.amounts.leisure).toBe(123456); // floor(1234567 * 0.1)
      expect(result.amounts.living).toBe(617285); // remainder

      // Verify total allocation equals available (remainder added to living)
      const allocationSum =
        result.amounts.living +
        result.amounts.saving +
        result.amounts.emergency +
        result.amounts.leisure;
      expect(allocationSum).toBe(1234567);
    });

    it("AC-3: should handle zero ratio and floor remainders correctly", () => {
      // salary = 1234567, no fixed costs, ratios = 0:50:30:20
      // living has 0% ratio, so it gets remainder only
      const result = calculateAllocation(1234567, [], [0, 50, 30, 20]);

      expect(result.available).toBe(1234567);
      expect(result.amounts.living).toBe(1); // remainder after flooring others
      expect(result.amounts.saving).toBe(617283); // floor(1234567 * 0.5)
      expect(result.amounts.emergency).toBe(370370); // floor(1234567 * 0.3)
      expect(result.amounts.leisure).toBe(246913); // floor(1234567 * 0.2)

      const allocationSum =
        result.amounts.living +
        result.amounts.saving +
        result.amounts.emergency +
        result.amounts.leisure;
      expect(allocationSum).toBe(1234567);
    });

    it("should return zero amounts when available is zero", () => {
      const fixedCosts = [
        {
          id: "fc1",
          name: "rent",
          amount: 3000000,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ];

      const result = calculateAllocation(3000000, fixedCosts, [50, 30, 10, 10]);

      expect(result.available).toBe(0);
      expect(result.amounts.living).toBe(0);
      expect(result.amounts.saving).toBe(0);
      expect(result.amounts.emergency).toBe(0);
      expect(result.amounts.leisure).toBe(0);
    });

    it("should return zero amounts when available is negative", () => {
      const fixedCosts = [
        {
          id: "fc1",
          name: "rent",
          amount: 5000000,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ];

      const result = calculateAllocation(3000000, fixedCosts, [50, 30, 10, 10]);

      expect(result.available).toBeLessThan(0);
      expect(result.amounts.living).toBe(0);
      expect(result.amounts.saving).toBe(0);
      expect(result.amounts.emergency).toBe(0);
      expect(result.amounts.leisure).toBe(0);
    });

    it("should handle empty fixed costs array", () => {
      const result = calculateAllocation(1000000, [], [50, 30, 10, 10]);

      expect(result.fixedTotal).toBe(0);
      expect(result.available).toBe(1000000);
      expect(result.amounts.living).toBe(500000);
      expect(result.amounts.saving).toBe(300000);
      expect(result.amounts.emergency).toBe(100000);
      expect(result.amounts.leisure).toBe(100000);
    });
  });

  describe("resolvePresetId", () => {
    it("AC-4: should return 'p532' for [50, 30, 10, 10] ratios", () => {
      expect(resolvePresetId([50, 30, 10, 10])).toBe("p532");
    });

    it("AC-4: should return 'p442' for [40, 40, 10, 10] ratios", () => {
      expect(resolvePresetId([40, 40, 10, 10])).toBe("p442");
    });

    it("AC-4: should return 'p622' for [60, 20, 10, 10] ratios", () => {
      expect(resolvePresetId([60, 20, 10, 10])).toBe("p622");
    });

    it("AC-4: should return 'custom' for non-matching ratios", () => {
      expect(resolvePresetId([50, 35, 10, 5])).toBe("custom");
      expect(resolvePresetId([30, 30, 20, 20])).toBe("custom");
      expect(resolvePresetId([0, 100, 0, 0])).toBe("custom");
    });
  });

  describe("isSamePlan", () => {
    const basePlan: PlanDraft = {
      salary: 3000000,
      payday: 25,
      fixedCosts: [
        {
          id: "fc1",
          name: "rent",
          amount: 500000,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
      ratios: [50, 30, 10, 10],
      presetId: "p532",
    };

    it("AC-5: should ignore id, createdAt (fixedCost), and presetId when comparing", () => {
      const plan1: PlanDraft = {
        ...basePlan,
        fixedCosts: [
          {
            ...basePlan.fixedCosts[0],
            id: "fc1",
            createdAt: "2026-01-01",
          },
        ],
        presetId: "p532",
      };

      const plan2: PlanDraft = {
        ...basePlan,
        fixedCosts: [
          {
            ...basePlan.fixedCosts[0],
            id: "fc_different_id",
            createdAt: "2026-12-31",
          },
        ],
        presetId: "custom",
      };

      expect(isSamePlan(plan1, plan2)).toBe(true);
    });

    it("AC-5: should return false when salary differs", () => {
      const plan1: PlanDraft = {
        ...basePlan,
        salary: 3000000,
      };

      const plan2: PlanDraft = {
        ...basePlan,
        salary: 3500000,
      };

      expect(isSamePlan(plan1, plan2)).toBe(false);
    });

    it("should return false when payday differs", () => {
      const plan1: PlanDraft = {
        ...basePlan,
        payday: 25,
      };

      const plan2: PlanDraft = {
        ...basePlan,
        payday: 20,
      };

      expect(isSamePlan(plan1, plan2)).toBe(false);
    });

    it("should return false when ratios differ", () => {
      const plan1: PlanDraft = {
        ...basePlan,
        ratios: [50, 30, 10, 10],
      };

      const plan2: PlanDraft = {
        ...basePlan,
        ratios: [40, 40, 10, 10],
      };

      expect(isSamePlan(plan1, plan2)).toBe(false);
    });

    it("should return false when fixed cost name differs", () => {
      const plan1: PlanDraft = {
        ...basePlan,
        fixedCosts: [
          {
            id: "fc1",
            name: "rent",
            amount: 500000,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ],
      };

      const plan2: PlanDraft = {
        ...basePlan,
        fixedCosts: [
          {
            id: "fc1",
            name: "insurance",
            amount: 500000,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ],
      };

      expect(isSamePlan(plan1, plan2)).toBe(false);
    });

    it("should return false when fixed cost amount differs", () => {
      const plan1: PlanDraft = {
        ...basePlan,
        fixedCosts: [
          {
            id: "fc1",
            name: "rent",
            amount: 500000,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ],
      };

      const plan2: PlanDraft = {
        ...basePlan,
        fixedCosts: [
          {
            id: "fc1",
            name: "rent",
            amount: 600000,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ],
      };

      expect(isSamePlan(plan1, plan2)).toBe(false);
    });

    it("should return false when fixed costs count differs", () => {
      const plan1: PlanDraft = {
        ...basePlan,
        fixedCosts: [
          {
            id: "fc1",
            name: "rent",
            amount: 500000,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
          {
            id: "fc2",
            name: "utility",
            amount: 100000,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ],
      };

      const plan2: PlanDraft = {
        ...basePlan,
        fixedCosts: [
          {
            id: "fc1",
            name: "rent",
            amount: 500000,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ],
      };

      expect(isSamePlan(plan1, plan2)).toBe(false);
    });

    it("should return true for plans differing only in fixed cost order", () => {
      const plan1: PlanDraft = {
        ...basePlan,
        fixedCosts: [
          {
            id: "fc1",
            name: "rent",
            amount: 500000,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
          {
            id: "fc2",
            name: "utility",
            amount: 100000,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ],
      };

      // Same fixed costs but different order
      const plan2: PlanDraft = {
        ...basePlan,
        fixedCosts: [
          {
            id: "fc1",
            name: "rent",
            amount: 500000,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
          {
            id: "fc2",
            name: "utility",
            amount: 100000,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ],
      };

      expect(isSamePlan(plan1, plan2)).toBe(true);
    });
  });
});
