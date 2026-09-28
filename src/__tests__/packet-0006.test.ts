import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SalaryPlan, PlanDraft, RecordStore, ReviewPromptState } from "@/lib/types";

// ──────────────────────────────────────────────────────────────────────────
// NOTE: These tests are written before implementation (TDD red phase).
// The functions savePlan, loadPlan, loadRecords, requestReviewOnce
// do not yet exist — tests will fail until implemented.
// ──────────────────────────────────────────────────────────────────────────

describe("localStorage 저장소: 계획, 기록 읽기, 리뷰 1회", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ── AC-1: savePlan(new plan) → version 1, generated id, createdAt=updatedAt ──

  it("AC-1[P0]: savePlan(new plan) creates version 1 with generated id and equal timestamps", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T01:00:00.000Z"));

    const draft: PlanDraft = {
      salary: 3500000,
      fixedCosts: [
        {
          id: "fc_rent",
          name: "월세",
          amount: 1000000,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      presetId: "p532",
      ratios: [50, 30, 10, 10],
      payday: 25,
    };

    const { savePlan } = await import("@/lib/storage");
    const result = savePlan(draft);

    expect(result).toEqual({ ok: true });

    const stored = localStorage.getItem("paysplit:plan:v1");
    expect(stored).toBeTruthy();
    const plan = JSON.parse(stored!);

    expect(plan.version).toBe(1);
    expect(plan.id).toBeTruthy();
    expect(typeof plan.id).toBe("string");
    expect(plan.createdAt).toBe("2026-09-29T01:00:00.000Z");
    expect(plan.updatedAt).toBe("2026-09-29T01:00:00.000Z");
    expect(plan.salary).toBe(3500000);
    // Fixed cost should retain draft values including timestamps
    expect(plan.fixedCosts[0].id).toBe("fc_rent");
    expect(plan.fixedCosts[0].createdAt).toBe("2026-09-01T00:00:00.000Z");

    vi.useRealTimers();
  });

  // ── AC-2[P0]: savePlan(existing) → retain id/createdAt, update updatedAt ──

  it("AC-2[P0]: savePlan(existing plan) preserves id and createdAt, updates updatedAt", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T01:00:00.000Z"));

    const oldPlan: SalaryPlan = {
      version: 1,
      id: "plan_a",
      salary: 3000000,
      fixedCosts: [],
      presetId: "p532",
      ratios: [50, 30, 10, 10],
      payday: 25,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    localStorage.setItem("paysplit:plan:v1", JSON.stringify(oldPlan));

    // Advance time
    vi.setSystemTime(new Date("2026-09-29T02:00:00.000Z"));

    const { savePlan } = await import("@/lib/storage");
    const result = savePlan({
      salary: 3500000,
      fixedCosts: [],
      presetId: "p532",
      ratios: [50, 30, 10, 10],
      payday: 25,
    });

    expect(result).toEqual({ ok: true });

    const stored = localStorage.getItem("paysplit:plan:v1");
    const plan = JSON.parse(stored!);

    expect(plan.id).toBe("plan_a");
    expect(plan.createdAt).toBe("2026-09-01T00:00:00.000Z");
    expect(plan.updatedAt).toBe("2026-09-29T02:00:00.000Z");
    expect(plan.salary).toBe(3500000);

    vi.useRealTimers();
  });

  // ── AC-2[P0]: savePlan handles QuotaExceededError gracefully ──

  it("AC-2[P0]: savePlan with QuotaExceededError returns {ok:false,error:'QUOTA'} and preserves stored value", async () => {
    const oldData = JSON.stringify({
      version: 1,
      id: "plan_a",
      salary: 3000000,
      fixedCosts: [],
      presetId: "p532",
      ratios: [50, 30, 10, 10],
      payday: 25,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    localStorage.setItem("paysplit:plan:v1", oldData);

    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });

    const { savePlan } = await import("@/lib/storage");
    const result = savePlan({
      salary: 3500000,
      fixedCosts: [],
      presetId: "p532",
      ratios: [50, 30, 10, 10],
      payday: 25,
    });

    expect(result).toEqual({ ok: false, error: "QUOTA" });
    expect(localStorage.getItem("paysplit:plan:v1")).toBe(oldData);

    localStorage.setItem = originalSetItem;
  });

  // ── AC-3: loadPlan with invalid data → null, remove key, no console.error ──

  it("AC-3[P0]: loadPlan with invalid JSON returns null and removes key", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("paysplit:plan:v1", "{broken");

    const { loadPlan } = await import("@/lib/storage");
    const result = loadPlan();

    expect(result).toBeNull();
    expect(localStorage.getItem("paysplit:plan:v1")).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  // ── AC-3: loadPlan with missing required field → null, remove key ──

  it("AC-3[P0]: loadPlan with validation failure (missing salary) returns null and removes key", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("paysplit:plan:v1", JSON.stringify({ version: 1, id: "x" }));

    const { loadPlan } = await import("@/lib/storage");
    const result = loadPlan();

    expect(result).toBeNull();
    expect(localStorage.getItem("paysplit:plan:v1")).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  // ── AC-3: loadPlan with legacy data normalizes in memory only ──

  it("AC-3: loadPlan with legacy data normalizes in-memory without modifying storage", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T01:00:00.000Z"));

    const legacyData = {
      salary: 3500000,
      fixedCosts: [],
      presetId: "p532",
      ratios: [50, 30, 10, 10],
      payday: 25,
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    const serialized = JSON.stringify(legacyData);
    localStorage.setItem("paysplit:plan:v1", serialized);

    const { loadPlan } = await import("@/lib/storage");
    const result1 = loadPlan();
    const result2 = loadPlan();

    expect(result1).not.toBeNull();
    expect(result1?.id).toBe(result2?.id); // Same normalized id both calls
    expect(localStorage.getItem("paysplit:plan:v1")).toBe(serialized); // Storage unchanged

    vi.useRealTimers();
  });

  // ── AC-4: loadRecords with no key → {version:1, records:{}} ──

  it("AC-4: loadRecords with no stored data returns {version:1,records:{}}", async () => {
    const { loadRecords } = await import("@/lib/storage");
    const result = loadRecords();

    expect(result).toEqual({ version: 1, records: {} });
    expect(localStorage.getItem("paysplit:records:v1")).toBeNull();
  });

  // ── AC-4: loadRecords filters out invalid records ──

  it("AC-4: loadRecords filters out malformed records and returns only valid ones", async () => {
    const recordStore = {
      version: 1,
      records: {
        "2026-09": {
          id: "rec1",
          planId: "plan_a",
          month: "2026-09",
          checked: { living: true, saving: false, emergency: false, leisure: false },
          eligible: ["living"],
          rate: 100,
          completedAt: null,
          snapshot: {
            salary: 3500000,
            fixedTotal: 1000000,
            available: 2500000,
            ratios: [50, 30, 10, 10],
            amounts: { living: 1250000, saving: 750000, emergency: 250000, leisure: 250000 },
          },
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-15T00:00:00.000Z",
        },
        invalid: "not-an-object",
        missing_id: { month: "2026-10" },
      },
    };
    localStorage.setItem("paysplit:records:v1", JSON.stringify(recordStore));

    const { loadRecords } = await import("@/lib/storage");
    const result = loadRecords();

    expect(result.version).toBe(1);
    expect(result.records["2026-09"]).toBeDefined();
    expect(result.records["2026-09"].id).toBe("rec1");
    expect(result.records.invalid).toBeUndefined();
    expect(result.records.missing_id).toBeUndefined();
  });

  // ── AC-4: loadRecords includes legacy 2026-08 record ──

  it("AC-4: loadRecords includes legacy YYYY-MM records as valid MonthRecords with planId=null", async () => {
    const recordStore = {
      version: 1,
      records: {
        "2026-08": {
          id: "legacy-2026-08",
          planId: null,
          month: "2026-08",
          checked: { living: true, saving: true, emergency: false, leisure: false },
          eligible: ["living", "saving"],
          rate: 50,
          completedAt: null,
          snapshot: {
            salary: 3000000,
            fixedTotal: 500000,
            available: 2500000,
            ratios: [50, 30, 10, 10],
            amounts: { living: 1250000, saving: 750000, emergency: 250000, leisure: 250000 },
          },
          createdAt: "2026-08-15T00:00:00.000Z",
          updatedAt: "2026-08-15T00:00:00.000Z",
        },
      },
    };
    localStorage.setItem("paysplit:records:v1", JSON.stringify(recordStore));

    const { loadRecords } = await import("@/lib/storage");
    const result = loadRecords();

    expect(result.records["2026-08"]).toBeDefined();
    expect(result.records["2026-08"].id).toBe("legacy-2026-08");
    expect(result.records["2026-08"].planId).toBeNull();
  });

  // ── AC-4: loadRecords does not call setItem/removeItem ──

  it("AC-4: loadRecords never calls setItem or removeItem (read-only)", async () => {
    const recordStore = {
      version: 1,
      records: { "2026-09": { id: "rec1" } },
    };
    localStorage.setItem("paysplit:records:v1", JSON.stringify(recordStore));

    const setItemSpy = vi.spyOn(localStorage, "setItem");
    const removeItemSpy = vi.spyOn(localStorage, "removeItem");

    const { loadRecords } = await import("@/lib/storage");
    loadRecords();

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeItemSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });

  // ── AC-5: requestReviewOnce requests only once ──

  it("AC-5[P0]: requestReviewOnce requests review on first call only", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T01:00:00.000Z"));

    // Mock the review request function (SDK equivalent)
    const mockReview = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("requestReview", mockReview);

    const { requestReviewOnce } = await import("@/lib/review");
    await requestReviewOnce();
    await requestReviewOnce();
    await requestReviewOnce();

    // Only 1 call despite 3 invocations
    expect(mockReview).toHaveBeenCalledTimes(1);

    const stored = localStorage.getItem("paysplit:review:v1");
    const state: ReviewPromptState = JSON.parse(stored!);

    expect(state.version).toBe(1);
    expect(state.id).toBe("review-prompt");
    expect(state.createdAt).toBe("2026-09-29T01:00:00.000Z");
    expect(state.updatedAt).toBe("2026-09-29T01:00:00.000Z");

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // ── AC-5: requestReviewOnce treats legacy '1' as already requested ──

  it("AC-5[P0]: requestReviewOnce with legacy value '1' treats as already requested (0 calls)", async () => {
    localStorage.setItem("paysplit:review:v1", "'1'");

    const mockReview = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("requestReview", mockReview);

    const { requestReviewOnce } = await import("@/lib/review");
    await requestReviewOnce();

    expect(mockReview).not.toHaveBeenCalled();
    expect(localStorage.getItem("paysplit:review:v1")).toBe("'1'"); // Unchanged

    vi.unstubAllGlobals();
  });
});
