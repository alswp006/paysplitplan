import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";

import { PlanStoreProvider, usePlanStore } from "@/hooks/usePlanStore";
import type { Plan, MonthRecordMap, SaveResult } from "@/lib/types";
import { toMonthKey } from "@/lib/date";
import { PRESETS } from "@/lib/constants";

function makePlan(overrides: Partial<Plan> = {}): Plan {
  const now = new Date().toISOString();
  return {
    version: 1,
    salary: 3_000_000,
    fixedCosts: [],
    payday: 25,
    presetId: "basic_5311",
    ratios: PRESETS.basic_5311,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(PlanStoreProvider, null, children);
}

function currentMonthKey(): string {
  const today = new Date();
  return toMonthKey(today.getFullYear(), today.getMonth());
}

function throwQuota(): never {
  throw new DOMException("Quota exceeded", "QuotaExceededError");
}

describe("Packet 0008: PlanStore Context (상태 관리 훅)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("AC-1: savePlan 호출 시 상태·저장소 갱신", () => {
    it("AC-1a: should update plan state, persist to localStorage.psp.plan.v1, and return ok:true", () => {
      const { result } = renderHook(() => usePlanStore(), { wrapper });
      const newPlan = makePlan({ salary: 4_000_000 });

      let saveResult: SaveResult | undefined;
      act(() => {
        saveResult = result.current.savePlan(newPlan);
      });

      expect(saveResult?.ok).toBe(true);
      expect(result.current.plan?.salary).toBe(4_000_000);

      const stored = JSON.parse(localStorage.getItem("psp.plan.v1")!);
      expect(stored).toEqual(newPlan);
    });

    it("AC-1b: should roll back to the previous plan when persisting fails (quota exceeded)", () => {
      const initialPlan = makePlan({ salary: 3_000_000 });
      localStorage.setItem("psp.plan.v1", JSON.stringify(initialPlan));

      const { result } = renderHook(() => usePlanStore(), { wrapper });
      expect(result.current.plan?.salary).toBe(3_000_000);

      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(throwQuota);

      let saveResult: SaveResult | undefined;
      act(() => {
        saveResult = result.current.savePlan(makePlan({ salary: 9_000_000 }));
      });

      setItemSpy.mockRestore();

      expect(saveResult).toEqual({ ok: false, reason: "quota" });
      expect(result.current.plan?.salary).toBe(3_000_000);
    });
  });

  describe("AC-2: toggleBucket 호출 시 currentRecord·저장소 갱신", () => {
    it("AC-2a: should add a bucket to currentRecord.checked, recompute rate (25%), and persist to psp.records.v1", () => {
      const plan = makePlan();
      localStorage.setItem("psp.plan.v1", JSON.stringify(plan));

      const { result } = renderHook(() => usePlanStore(), { wrapper });

      let toggleResult: SaveResult | undefined;
      act(() => {
        toggleResult = result.current.toggleBucket("saving");
      });

      expect(toggleResult?.ok).toBe(true);
      expect(result.current.currentRecord?.checked).toEqual(["saving"]);
      expect(result.current.currentRecord?.rate).toBe(25);

      const storedRecords = JSON.parse(
        localStorage.getItem("psp.records.v1")!,
      ) as MonthRecordMap;
      expect(storedRecords[currentMonthKey()].checked).toEqual(["saving"]);
      expect(storedRecords[currentMonthKey()].rate).toBe(25);
    });

    it("AC-2b: should remove the bucket again when toggled a second time", () => {
      const plan = makePlan();
      localStorage.setItem("psp.plan.v1", JSON.stringify(plan));

      const { result } = renderHook(() => usePlanStore(), { wrapper });

      act(() => {
        result.current.toggleBucket("saving");
      });
      act(() => {
        result.current.toggleBucket("saving");
      });

      expect(result.current.currentRecord?.checked).toEqual([]);
      expect(result.current.currentRecord?.rate).toBe(0);
    });
  });

  describe("AC-3: 저장 실패(quota) 시 toggleBucket 롤백", () => {
    it("AC-3a: should return {ok:false, reason:'quota'} and keep currentRecord.checked unchanged when setItem throws", () => {
      const plan = makePlan();
      localStorage.setItem("psp.plan.v1", JSON.stringify(plan));

      const { result } = renderHook(() => usePlanStore(), { wrapper });
      const before = result.current.currentRecord?.checked ?? [];
      expect(before).toEqual([]);

      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(throwQuota);

      let toggleResult: SaveResult | undefined;
      act(() => {
        toggleResult = result.current.toggleBucket("saving");
      });

      setItemSpy.mockRestore();

      expect(toggleResult).toEqual({ ok: false, reason: "quota" });
      expect(result.current.currentRecord?.checked).toEqual(before);
    });
  });

  describe("초기 마운트 (smoke)", () => {
    it("should expose plan/corrupted/allocation/records loaded from storage on mount", () => {
      const plan = makePlan({ salary: 3_000_000, fixedCosts: [] });
      localStorage.setItem("psp.plan.v1", JSON.stringify(plan));

      const { result } = renderHook(() => usePlanStore(), { wrapper });

      expect(result.current.corrupted).toBe(false);
      expect(result.current.allocation?.buckets.saving).toBe(900_000);
      expect(result.current.records[currentMonthKey()].total).toBe(4);
    });
  });
});
