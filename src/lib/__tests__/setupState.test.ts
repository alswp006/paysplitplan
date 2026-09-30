import { describe, it, expect, vi } from "vitest";
import { setupSignature } from "@/lib/setup";
import { SETUP_KEY, loadSetupState, markSetupCopied, setupNudge } from "@/lib/setupState";
import type { SalaryPlan } from "@/lib/types";

const TS = "2026-09-01T00:00:00.000Z";
const PLAN_A: SalaryPlan = {
  version: 1,
  id: "plan_a",
  salary: 3_000_000,
  fixedCosts: [{ id: "fc_rent", name: "월세", amount: 600_000, createdAt: TS, updatedAt: TS }],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
  createdAt: TS,
  updatedAt: TS,
};

describe("세팅표 복사 기록과 홈 넛지", () => {
  it("복사 전에는 notYet", () => {
    expect(loadSetupState()).toBeNull();
    expect(setupNudge(PLAN_A, loadSetupState())).toBe("notYet");
  });

  it("한 통장만 복사하면 notYet, 나머지까지 복사하면(합집합) none", () => {
    const sig = setupSignature(PLAN_A);
    expect(markSetupCopied(sig, ["saving"])).toBe(true);
    expect(setupNudge(PLAN_A, loadSetupState())).toBe("notYet");
    markSetupCopied(sig, ["living", "emergency", "leisure"]);
    const state = loadSetupState();
    expect(state?.copiedKeys).toEqual(["living", "saving", "emergency", "leisure"]);
    expect(setupNudge(PLAN_A, state)).toBe("none");
  });

  it("전체 복사 뒤 계획 금액이 바뀌면 changed — 새 금액으로 다시 복사하면 이전 keys는 버리고 새로 시작한다", () => {
    markSetupCopied(setupSignature(PLAN_A), ["living", "saving", "emergency", "leisure"]);
    const changed: SalaryPlan = { ...PLAN_A, ratios: [60, 20, 10, 10], presetId: "p622" };
    expect(setupNudge(changed, loadSetupState())).toBe("changed");

    markSetupCopied(setupSignature(changed), ["saving"]);
    expect(loadSetupState()?.copiedKeys).toEqual(["saving"]);
    expect(setupNudge(changed, loadSetupState())).toBe("notYet");
  });

  it("무효 원문이면 null이고 읽기는 원문을 지우지 않는다", () => {
    localStorage.setItem(SETUP_KEY, "{bad");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    expect(loadSetupState()).toBeNull();
    expect(localStorage.getItem(SETUP_KEY)).toBe("{bad");
    expect(removeItem).toHaveBeenCalledTimes(0);
    removeItem.mockRestore();

    localStorage.setItem(SETUP_KEY, JSON.stringify({ version: 1, signature: "x", copiedKeys: ["rent"], copiedAt: TS }));
    expect(loadSetupState()).toBeNull();
  });

  it("쓰기가 실패해도 던지지 않고 false", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(markSetupCopied("sig", ["saving"])).toBe(false);
    setItem.mockRestore();
  });
});
