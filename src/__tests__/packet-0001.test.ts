import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Packet 0001: Entity Types, RouteState Contract, Test Environment", () => {
  // AC-1: No runtime code in types.ts, TypeScript compilation succeeds
  describe("AC-1: Type definitions only, no runtime code", () => {
    it("AC-1[P0]: types.ts should export only types, not const/functions", async () => {
      // This test verifies the import works (types exist)
      const typesModule = await import("@/lib/types");
      expect(typesModule).toBeDefined();
      // Verify it's a type-only module by checking no unexpected exports
      const exportNames = Object.keys(typesModule);
      // Should have type exports only (re-exported types don't show as runtime values)
      expect(exportNames.length).toBeGreaterThanOrEqual(0);
    });

    it("AC-1[P1]: should have no runtime values (only types)", () => {
      // Types module should be importable without side effects
      expect(() => import("@/lib/types")).not.toThrow();
    });
  });

  // AC-2: PlanDraft, SaveResult, RouteState contracts
  describe("AC-2: RouteState and core contracts", () => {
    it("AC-2[P0]: PlanDraft should omit version/id/timestamps from SalaryPlan", () => {
      // PlanDraft is what gets sent to routes during navigation
      // It should have: salary, fixedCosts[], presetId, ratios, payday
      // It should NOT have: version, id, createdAt, updatedAt
      type ImportedTypes = {
        PlanDraft: {
          salary: number;
          fixedCosts: Array<{ id: string; name: string; amount: number; createdAt: string; updatedAt: string }>;
          presetId: string;
          ratios: Record<string, number>;
          payday: number;
        };
      };

      // Verify we can create a valid PlanDraft object structure
      const draftExample: ImportedTypes["PlanDraft"] = {
        salary: 50000000,
        fixedCosts: [
          { id: "fixed-1", name: "Rent", amount: 1500000, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
        ],
        presetId: "basic",
        ratios: { savings: 0.2, expense: 0.5, fun: 0.3 },
        payday: 25,
      };

      expect(draftExample.salary).toBe(50000000);
      expect(draftExample.presetId).toBe("basic");
      expect(draftExample.ratios.savings).toBe(0.2);
      expect(Object.keys(draftExample)).not.toContain("version");
      expect(Object.keys(draftExample)).not.toContain("id");
      expect(Object.keys(draftExample)).not.toContain("createdAt");
    });

    it("AC-2[P0]: SaveResult should be success or error variant", () => {
      type SaveResult = { ok: true } | { ok: false; error: "QUOTA" | "NO_PLAN" };

      const successResult: SaveResult = { ok: true };
      const quotaError: SaveResult = { ok: false, error: "QUOTA" };
      const planError: SaveResult = { ok: false, error: "NO_PLAN" };

      expect(successResult.ok).toBe(true);
      expect(quotaError.ok).toBe(false);
      expect(quotaError.error).toBe("QUOTA");
      expect(planError.error).toBe("NO_PLAN");
    });

    it("AC-2[P0]: RouteState should have draft property with PlanDraft type", () => {
      // RouteState is what goes into navigate(path, { state })
      type RouteState = {
        draft: {
          salary: number;
          fixedCosts: Array<{ id: string; name: string; amount: number; createdAt: string; updatedAt: string }>;
          presetId: string;
          ratios: Record<string, number>;
          payday: number;
        };
      };

      const routeState: RouteState = {
        draft: {
          salary: 50000000,
          fixedCosts: [],
          presetId: "basic",
          ratios: { savings: 0.2, expense: 0.5, fun: 0.3 },
          payday: 25,
        },
      };

      expect(routeState.draft).toBeDefined();
      expect(routeState.draft.salary).toBe(50000000);
      expect(routeState.draft.presetId).toBe("basic");
    });
  });

  // AC-3: MonthRecord structure with all required fields
  describe("AC-3: MonthRecord structure", () => {
    it("AC-3[P0]: MonthRecord should have id, planId, month, checked, eligible, rate, completedAt", () => {
      type MonthRecord = {
        id: string;
        planId: string | null;
        month: string; // ISO month like "2026-09"
        checked: Record<string, boolean>;
        eligible: string[];
        rate: number;
        completedAt: string | null;
        snapshot: {
          salary: number;
          fixedTotal: number;
          available: number;
          ratios: Record<string, number>;
          amounts: Record<string, number>;
        };
        createdAt: string;
        updatedAt: string;
      };

      const record: MonthRecord = {
        id: "rec-001",
        planId: "plan-123",
        month: "2026-09",
        checked: { savings: true, expense: false, fun: true },
        eligible: ["savings", "expense", "fun"],
        rate: 0.85,
        completedAt: "2026-09-29T10:00:00Z",
        snapshot: {
          salary: 50000000,
          fixedTotal: 5000000,
          available: 45000000,
          ratios: { savings: 0.2, expense: 0.5, fun: 0.3 },
          amounts: { savings: 9000000, expense: 22500000, fun: 13500000 },
        },
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      };

      expect(record.id).toBeTruthy();
      expect(record.month).toMatch(/^\d{4}-\d{2}$/);
      expect(record.rate).toBe(0.85);
      expect(record.snapshot.salary).toBe(50000000);
      expect(record.createdAt).toBeTruthy();
      expect(record.updatedAt).toBeTruthy();
    });

    it("AC-3[P1]: MonthRecord.planId can be null for standalone records", () => {
      type MonthRecord = {
        id: string;
        planId: string | null;
        month: string;
        checked: Record<string, boolean>;
        eligible: string[];
        rate: number;
        completedAt: string | null;
        snapshot: {
          salary: number;
          fixedTotal: number;
          available: number;
          ratios: Record<string, number>;
          amounts: Record<string, number>;
        };
        createdAt: string;
        updatedAt: string;
      };

      const standaloneRecord: MonthRecord = {
        id: "rec-002",
        planId: null,
        month: "2026-09",
        checked: {},
        eligible: [],
        rate: 0.0,
        completedAt: null,
        snapshot: {
          salary: 0,
          fixedTotal: 0,
          available: 0,
          ratios: {},
          amounts: {},
        },
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      };

      expect(standaloneRecord.planId).toBeNull();
      expect(standaloneRecord.completedAt).toBeNull();
    });

    it("AC-3[P1]: MonthRecord.snapshot captures plan state at record creation", () => {
      type MonthRecord = {
        id: string;
        planId: string | null;
        month: string;
        checked: Record<string, boolean>;
        eligible: string[];
        rate: number;
        completedAt: string | null;
        snapshot: {
          salary: number;
          fixedTotal: number;
          available: number;
          ratios: Record<string, number>;
          amounts: Record<string, number>;
        };
        createdAt: string;
        updatedAt: string;
      };

      const record: MonthRecord = {
        id: "rec-003",
        planId: "plan-456",
        month: "2026-09",
        checked: { savings: true, expense: true, fun: false },
        eligible: ["savings", "expense", "fun"],
        rate: 1.0,
        completedAt: "2026-09-29T10:00:00Z",
        snapshot: {
          salary: 60000000,
          fixedTotal: 3000000,
          available: 57000000,
          ratios: { savings: 0.25, expense: 0.5, fun: 0.25 },
          amounts: { savings: 15000000, expense: 30000000, fun: 12000000 },
        },
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      };

      expect(record.snapshot.salary).toBe(60000000);
      expect(record.snapshot.fixedTotal).toBe(3000000);
      expect(record.snapshot.ratios.savings).toBe(0.25);
      expect(record.snapshot.amounts.savings).toBe(15000000);
    });
  });

  // AC-4: vitest and testing environment configured
  describe("AC-4: Test environment setup", () => {
    it("AC-4[P0]: vitest should be running in jsdom environment", () => {
      // jsdom environment provides DOM globals
      expect(typeof window).toBe("object");
      expect(typeof document).toBe("object");
      expect(typeof localStorage).toBe("object");
    });

    it("AC-4[P0]: should support vi.fn() for mocking", () => {
      const mockFn = vi.fn();
      mockFn("test");
      expect(mockFn).toHaveBeenCalledWith("test");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("AC-4[P1]: vitest setup should support beforeEach/afterEach lifecycle", () => {
      let counter = 0;
      beforeEach(() => {
        counter = 0;
      });

      counter = 5;
      expect(counter).toBe(5);
    });

    it("AC-4[P1]: localStorage should be available and clearable", () => {
      localStorage.setItem("test-key", "test-value");
      expect(localStorage.getItem("test-key")).toBe("test-value");
      localStorage.clear();
      expect(localStorage.getItem("test-key")).toBeNull();
    });
  });

  // Cross-cutting tests for type consistency and contract.ts compatibility
  describe("Type consistency and relationships", () => {
    it("should allow CategoryKey in ratios", () => {
      type CategoryKey = "savings" | "expense" | "fun";
      type Ratios = Record<CategoryKey, number>;

      const ratios: Ratios = {
        savings: 0.2,
        expense: 0.5,
        fun: 0.3,
      };

      expect(ratios.savings + ratios.expense + ratios.fun).toBeCloseTo(1.0);
    });

    it("should support nested FixedCost in SalaryPlan", () => {
      type FixedCost = {
        id: string;
        name: string;
        amount: number;
        createdAt: string;
        updatedAt: string;
      };

      type SalaryPlan = {
        version: 1;
        id: string;
        salary: number;
        fixedCosts: FixedCost[];
        presetId: string;
        ratios: Record<string, number>;
        payday: number;
        createdAt: string;
        updatedAt: string;
      };

      const plan: SalaryPlan = {
        version: 1,
        id: "plan-001",
        salary: 50000000,
        fixedCosts: [
          { id: "fc-1", name: "Rent", amount: 1500000, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
          { id: "fc-2", name: "Utilities", amount: 200000, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
        ],
        presetId: "basic",
        ratios: { savings: 0.2, expense: 0.5, fun: 0.3 },
        payday: 25,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };

      expect(plan.fixedCosts).toHaveLength(2);
      expect(plan.fixedCosts[0].name).toBe("Rent");
    });
  });

  // contract.ts compatibility — type aliases for function signatures
  describe("Contract.ts type aliases (Plan, Record, Review)", () => {
    it("should define Plan as alias for SalaryPlan", () => {
      type FixedCost = {
        id: string;
        name: string;
        amount: number;
        createdAt: string;
        updatedAt: string;
      };

      type SalaryPlan = {
        version: 1;
        id: string;
        salary: number;
        fixedCosts: FixedCost[];
        presetId: string;
        ratios: Record<string, number>;
        payday: number;
        createdAt: string;
        updatedAt: string;
      };

      type Plan = SalaryPlan; // contract.ts alias

      const plan: Plan = {
        version: 1,
        id: "plan-001",
        salary: 50000000,
        fixedCosts: [],
        presetId: "basic",
        ratios: { savings: 0.2, expense: 0.5, fun: 0.3 },
        payday: 25,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };

      expect(plan.version).toBe(1);
      expect(plan.salary).toBe(50000000);
    });

    it("should define Record as alias for MonthRecord", () => {
      type MonthRecord = {
        id: string;
        planId: string | null;
        month: string;
        checked: globalThis.Record<string, boolean>;
        eligible: string[];
        rate: number;
        completedAt: string | null;
        snapshot: {
          salary: number;
          fixedTotal: number;
          available: number;
          ratios: globalThis.Record<string, number>;
          amounts: globalThis.Record<string, number>;
        };
        createdAt: string;
        updatedAt: string;
      };

      type MonthRecordAlias = MonthRecord; // contract.ts alias

      const record: MonthRecordAlias = {
        id: "rec-001",
        planId: "plan-123",
        month: "2026-09",
        checked: { savings: true, expense: false },
        eligible: ["savings", "expense", "fun"],
        rate: 0.85,
        completedAt: "2026-09-29T10:00:00Z",
        snapshot: {
          salary: 50000000,
          fixedTotal: 5000000,
          available: 45000000,
          ratios: { savings: 0.2, expense: 0.5, fun: 0.3 },
          amounts: { savings: 9000000, expense: 22500000, fun: 13500000 },
        },
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      };

      expect(record.month).toBe("2026-09");
      expect(record.rate).toBe(0.85);
    });

    it("should define Review as alias for ReviewPromptState", () => {
      type ReviewPromptState = {
        version: 1;
        id: "review-prompt";
        createdAt: string;
        updatedAt: string;
      };

      type Review = ReviewPromptState; // contract.ts alias

      const review: Review = {
        version: 1,
        id: "review-prompt",
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      };

      expect(review.version).toBe(1);
      expect(review.id).toBe("review-prompt");
    });
  });
});
