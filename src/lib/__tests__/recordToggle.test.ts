import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toggleRecordItem } from "@/lib/recordToggle";
import { loadRecords, PLAN_KEY, RECORDS_KEY } from "@/lib/storage";
import type { SalaryPlan } from "@/lib/types";

function plan(id: string, ratios: SalaryPlan["ratios"] = [60, 25, 10, 5]): SalaryPlan {
  return {
    version: 1,
    id,
    salary: 3200000,
    fixedCosts: [],
    presetId: "custom",
    ratios,
    payday: 25,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("toggleRecordItem", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T01:00:00.000Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("계획이 없으면 NO_PLAN이고 기록 키가 생기지 않는다", () => {
    expect(toggleRecordItem("saving", true)).toEqual({ ok: false, error: "NO_PLAN" });
    expect(localStorage.getItem(RECORDS_KEY)).toBeNull();
  });

  it("이미 같은 값이면 쓰지 않고 ok를 반환한다", () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan("plan_a")));
    (["living", "saving", "emergency", "leisure"] as const).forEach((k) => toggleRecordItem(k, true));
    const before = localStorage.getItem(RECORDS_KEY);
    const spy = vi.spyOn(Storage.prototype, "setItem");

    expect(toggleRecordItem("saving", true)).toEqual({ ok: true });
    expect(spy).not.toHaveBeenCalled();
    expect(localStorage.getItem(RECORDS_KEY)).toBe(before);
  });

  it("용량 초과면 QUOTA를 반환하고 저장 문자열은 그대로다", () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan("plan_a")));
    toggleRecordItem("living", true);
    const before = localStorage.getItem(RECORDS_KEY);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(toggleRecordItem("saving", true)).toEqual({ ok: false, error: "QUOTA" });
    expect(localStorage.getItem(RECORDS_KEY)).toBe(before);
  });

  it("비율 0인 카테고리는 eligible에서 빠지고 rate 100이면 completedAt이 들어간다", () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan("plan_a", [60, 30, 10, 0])));
    toggleRecordItem("living", true);
    toggleRecordItem("saving", true);
    toggleRecordItem("emergency", true);

    const rec = loadRecords().records["2026-09"];
    expect(rec.eligible).toEqual(["living", "saving", "emergency"]);
    expect(rec.rate).toBe(100);
    expect(rec.completedAt).toBe("2026-09-29T01:00:00.000Z");
    expect(rec.snapshot.amounts.leisure).toBe(0);
  });

  it("25개월째 기록을 만들면 가장 오래된 달을 지운다", () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan("plan_a")));
    for (let i = 0; i < 25; i++) {
      vi.setSystemTime(new Date(Date.UTC(2024, 9 + i, 5)));
      toggleRecordItem("living", true);
    }
    const months = Object.keys(loadRecords().records).sort();
    expect(months).toHaveLength(24);
    expect(months[0]).toBe("2024-11");
    expect(months[23]).toBe("2026-10");
  });
});
