import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, act } from "@testing-library/react";
import { PlanStoreProvider, usePlanStore } from "@/hooks/usePlanStore";
import type { Plan, MonthRecordMap } from "@/lib/types";
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
    ratios: { ...PRESETS.basic_5311 },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const wrapper = ({ children }: { children: ReactNode }) => <PlanStoreProvider>{children}</PlanStoreProvider>;
const monthKey = () => toMonthKey(new Date().getFullYear(), new Date().getMonth());
const throwQuota = (): never => {
  throw new DOMException("Quota exceeded", "QuotaExceededError");
};

describe("usePlanStore", () => {
  it("AC-1: savePlan은 plan을 갱신하고 psp.plan.v1에 저장한 뒤 ok:true를 반환한다", () => {
    const { result } = renderHook(() => usePlanStore(), { wrapper });
    const p = makePlan({ salary: 4_200_000 });
    let res;
    act(() => {
      res = result.current.savePlan(p);
    });
    expect(res).toEqual({ ok: true });
    expect(result.current.plan).toEqual(p);
    expect(JSON.parse(localStorage.getItem("psp.plan.v1")!)).toEqual(p);
  });

  it("AC-2: toggleBucket('saving')은 checked에 추가하고 rate를 다시 계산해 저장한다", () => {
    localStorage.setItem("psp.plan.v1", JSON.stringify(makePlan()));
    const { result } = renderHook(() => usePlanStore(), { wrapper });
    act(() => {
      result.current.toggleBucket("saving");
    });
    expect(result.current.currentRecord?.checked).toEqual(["saving"]);
    expect(result.current.currentRecord?.rate).toBe(25);
    const stored = JSON.parse(localStorage.getItem("psp.records.v1")!) as MonthRecordMap;
    expect(stored[monthKey()].checked).toEqual(["saving"]);
  });

  it("AC-3: 저장 공간이 차면 {ok:false, reason:'quota'}를 반환하고 checked를 되돌린다", () => {
    localStorage.setItem("psp.plan.v1", JSON.stringify(makePlan()));
    const { result } = renderHook(() => usePlanStore(), { wrapper });
    act(() => {
      result.current.toggleBucket("living");
    });
    const before = result.current.currentRecord?.checked;

    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(throwQuota);
    let res;
    act(() => {
      res = result.current.toggleBucket("saving");
    });
    spy.mockRestore();

    expect(res).toEqual({ ok: false, reason: "quota" });
    expect(result.current.currentRecord?.checked).toEqual(before);
  });

  it("마운트 시 빈 달을 채웠으면 psp.records.v1에 저장한다", () => {
    localStorage.setItem("psp.plan.v1", JSON.stringify(makePlan()));
    renderHook(() => usePlanStore(), { wrapper });
    const stored = JSON.parse(localStorage.getItem("psp.records.v1")!) as MonthRecordMap;
    expect(stored[monthKey()].total).toBe(4);
  });

  it("plan이 없으면 allocation은 null이다", () => {
    const { result } = renderHook(() => usePlanStore(), { wrapper });
    expect(result.current.plan).toBeNull();
    expect(result.current.allocation).toBeNull();
    expect(result.current.currentRecord).toBeNull();
  });

  it("깨진 계획이 저장돼 있으면 corrupted가 true다", () => {
    localStorage.setItem("psp.plan.v1", "{not json");
    const { result } = renderHook(() => usePlanStore(), { wrapper });
    expect(result.current.corrupted).toBe(true);
    expect(result.current.plan).toBeNull();
  });

  it("직접 조정 비율은 plan.ratios로 배분한다", () => {
    const p = makePlan({ presetId: "custom", ratios: { living: 45, saving: 35, emergency: 10, leisure: 10 } });
    localStorage.setItem("psp.plan.v1", JSON.stringify(p));
    const { result } = renderHook(() => usePlanStore(), { wrapper });
    expect(result.current.allocation?.buckets.saving).toBe(1_050_000);
    expect(result.current.allocation?.buckets.living).toBe(1_350_000);
  });

  it("Provider 밖에서 호출하면 Error를 던진다", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => usePlanStore())).toThrow(/PlanStoreProvider/);
    err.mockRestore();
  });
});
