import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toggleRecordItem } from "@/lib/recordToggle";
import { loadRecords, loadPlan, PLAN_KEY, RECORDS_KEY } from "@/lib/storage";
import type { SalaryPlan } from "@/lib/types";

describe("기록 토글 (toggleRecordItem)", () => {
  beforeEach(() => {
    // 시계 고정: 2026-09-29 01:00:00 UTC
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T01:00:00.000Z"));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  // Helper: 테스트용 계획 생성
  function createPlan(
    id: string,
    salary = 10000000,
    ratios = [60, 25, 10, 5] as [number, number, number, number]
  ): SalaryPlan {
    return {
      version: 1,
      id,
      salary,
      fixedCosts: [],
      presetId: "default",
      ratios,
      payday: 25,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
  }

  // ── AC-1: 새 기록 생성, 시간 업데이트 ──

  it("AC-1[P0]: creates new record with 25% rate and sets planId when saving toggled on", () => {
    const plan = createPlan("plan_a");
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));

    const result = toggleRecordItem("saving", true);

    expect(result).toEqual({ ok: true });

    const records = loadRecords();
    const record = records.records["2026-09"];

    expect(record).toBeDefined();
    expect(record!.checked.saving).toBe(true);
    expect(record!.checked.living).toBe(false);
    expect(record!.checked.emergency).toBe(false);
    expect(record!.checked.leisure).toBe(false);
    expect(record!.eligible).toEqual(["living", "saving", "emergency", "leisure"]);
    expect(record!.rate).toBe(25);
    expect(record!.completedAt).toBeNull();
    expect(record!.planId).toBe("plan_a");
    expect(record!.createdAt).toBe(record!.updatedAt);
  });

  it("AC-1[P0]: preserves id and createdAt, updates updatedAt when toggling later", () => {
    const plan = createPlan("plan_a");
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));

    toggleRecordItem("saving", true);

    let records = loadRecords();
    const firstRecord = records.records["2026-09"]!;
    const firstId = firstRecord.id;
    const firstCreatedAt = firstRecord.createdAt;

    // Advance time 2 hours
    vi.setSystemTime(new Date("2026-09-29T03:00:00.000Z"));

    toggleRecordItem("living", true);

    records = loadRecords();
    const updatedRecord = records.records["2026-09"]!;

    expect(updatedRecord.id).toBe(firstId);
    expect(updatedRecord.createdAt).toBe(firstCreatedAt);
    expect(updatedRecord.updatedAt).toBe("2026-09-29T03:00:00.000Z");
    expect(updatedRecord.updatedAt).not.toBe(firstRecord.updatedAt);
    expect(updatedRecord.checked.saving).toBe(true);
    expect(updatedRecord.checked.living).toBe(true);
    expect(updatedRecord.rate).toBe(50);
  });

  // ── AC-2: 완료 상태, 멱등성 ──

  it("AC-2[P0]: reaches 100% rate and sets completedAt when all eligible checked", () => {
    const plan = createPlan("plan_a");
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));

    toggleRecordItem("living", true);
    toggleRecordItem("saving", true);
    toggleRecordItem("emergency", true);
    toggleRecordItem("leisure", true);

    const records = loadRecords();
    const record = records.records["2026-09"]!;

    expect(record.rate).toBe(100);
    expect(record.completedAt).toBe("2026-09-29T01:00:00.000Z");
  });

  it("AC-2[P0]: clears completedAt when unchecking from 100%", () => {
    const plan = createPlan("plan_a");
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));

    toggleRecordItem("living", true);
    toggleRecordItem("saving", true);
    toggleRecordItem("emergency", true);
    toggleRecordItem("leisure", true);

    toggleRecordItem("leisure", false);

    const records = loadRecords();
    const record = records.records["2026-09"]!;

    expect(record.rate).toBe(75);
    expect(record.completedAt).toBeNull();
  });

  it("AC-2[P0]: is idempotent (no write when already set to same value)", () => {
    const plan = createPlan("plan_a");
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));

    // Setup: toggle all to 100%
    toggleRecordItem("living", true);
    toggleRecordItem("saving", true);
    toggleRecordItem("emergency", true);
    toggleRecordItem("leisure", true);

    const recordsBefore = localStorage.getItem(RECORDS_KEY);

    // Spy on setItem
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    // Toggle already-set item
    const result = toggleRecordItem("saving", true);

    expect(result).toEqual({ ok: true });
    expect(setItemSpy).not.toHaveBeenCalledWith(RECORDS_KEY, expect.anything());
    expect(localStorage.getItem(RECORDS_KEY)).toBe(recordsBefore);
  });

  // ── AC-3: NO_PLAN, QUOTA 에러 ──

  it("AC-3[P0]: returns NO_PLAN error when no plan exists", () => {
    const result = toggleRecordItem("saving", true);

    expect(result).toEqual({ ok: false, error: "NO_PLAN" });
    expect(localStorage.getItem(RECORDS_KEY)).toBeNull();
  });

  it("AC-3[P0]: returns QUOTA error when storage quota exceeded", () => {
    const plan = createPlan("plan_a");
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    setItemSpy.mockImplementation((key, value) => {
      if (key === RECORDS_KEY) {
        const error = new Error("QuotaExceededError");
        error.name = "QuotaExceededError";
        throw error;
      }
      localStorage[key as any] = value;
    });

    const result = toggleRecordItem("saving", true);

    expect(result).toEqual({ ok: false, error: "QUOTA" });
    setItemSpy.mockRestore();
  });

  // ── AC-4: 24개월 초과 삭제 ──

  it("AC-4[P0]: removes oldest record when exceeding 24 months", () => {
    const plan = createPlan("plan_a");
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));

    const recordIds: Record<string, string> = {};

    // Create records from 2024-10 to 2026-09 (24 months)
    let currentDate = new Date("2024-10-01T00:00:00.000Z");
    for (let i = 0; i < 24; i++) {
      vi.setSystemTime(currentDate);
      const year = currentDate.getUTCFullYear();
      const month = String(currentDate.getUTCMonth() + 1).padStart(2, "0");
      const monthKey = `${year}-${month}`;

      toggleRecordItem("living", true);

      const records = loadRecords();
      recordIds[monthKey] = records.records[monthKey]?.id || "";

      currentDate = new Date(currentDate);
      currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
    }

    // Advance to 2026-10 and toggle (triggers cleanup)
    vi.setSystemTime(new Date("2026-10-05T00:00:00.000Z"));
    toggleRecordItem("saving", true);

    const records = loadRecords();
    const months = Object.keys(records.records).sort();

    expect(months).toHaveLength(24);
    expect(months[0]).toBe("2024-11"); // 2024-10 deleted
    expect(months[months.length - 1]).toBe("2026-10"); // 2026-10 added

    // Verify remaining records preserve id/createdAt
    for (let i = 0; i < 23; i++) {
      expect(records.records[months[i]].id).toBe(recordIds[months[i]]);
    }
  });

  // ── AC-5: planId 변경, eligible 재계산 ──

  it("AC-5[P0]: updates planId when plan changes, preserves id and createdAt", () => {
    const oldPlan = createPlan("plan_old");
    localStorage.setItem(PLAN_KEY, JSON.stringify(oldPlan));

    toggleRecordItem("living", true);

    let records = loadRecords();
    const oldRecord = records.records["2026-09"]!;
    const recordId = oldRecord.id;
    const createdAt = oldRecord.createdAt;

    // Switch to new plan
    const newPlan = createPlan("plan_a");
    localStorage.setItem(PLAN_KEY, JSON.stringify(newPlan));

    // Toggle to trigger update
    toggleRecordItem("living", false);
    toggleRecordItem("living", true);

    records = loadRecords();
    const updatedRecord = records.records["2026-09"]!;

    expect(updatedRecord.planId).toBe("plan_a");
    expect(updatedRecord.id).toBe(recordId);
    expect(updatedRecord.createdAt).toBe(createdAt);
  });

  it("AC-5[P0]: recalculates eligible categories when plan ratios change", () => {
    const plan1 = createPlan("plan_1", 10000000, [60, 25, 10, 5]);
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan1));

    toggleRecordItem("living", true);

    // Change plan to only 3 eligible (leisure ratio = 0)
    const plan2 = createPlan("plan_2", 10000000, [60, 30, 10, 0]);
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan2));

    toggleRecordItem("saving", true);
    toggleRecordItem("emergency", true);

    const records = loadRecords();
    const record = records.records["2026-09"]!;

    expect(record.eligible).toEqual(["living", "saving", "emergency"]);
    expect(record.rate).toBe(100); // 3/3 = 100%
  });
});
