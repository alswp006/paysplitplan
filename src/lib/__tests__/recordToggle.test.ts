import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resyncCurrentMonth, toggleRecordItem } from "@/lib/recordToggle";
import { loadRecords, PLAN_KEY, RECORDS_KEY } from "@/lib/storage";
import type { MonthRecord, SalaryPlan } from "@/lib/types";

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

describe("toggleRecordItem — 다른 달 원문 보존", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T01:00:00.000Z"));
  });

  it("검증을 통과하지 못하는 달의 원문은 토글 뒤에도 문자 그대로 남는다", () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan("plan_a")));
    const invalidAug = { month: "2026-08", rate: "50", checked: "x" };
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, records: { "2026-08": invalidAug } }));

    expect(toggleRecordItem("saving", true)).toEqual({ ok: true });

    const raw = JSON.parse(localStorage.getItem(RECORDS_KEY)!);
    expect(raw.records["2026-08"]).toEqual(invalidAug);
    expect(loadRecords().records["2026-09"].checked.saving).toBe(true);
  });
});

describe("resyncCurrentMonth — 계획을 바꿔 저장한 뒤 이번 달 기록 맞추기", () => {
  const TS = "2026-09-01T00:00:00.000Z";
  const planA: SalaryPlan = {
    version: 1,
    id: "plan_new",
    salary: 3_000_000,
    fixedCosts: [{ id: "fc_rent", name: "월세", amount: 600_000, createdAt: TS, updatedAt: TS }],
    presetId: "p532",
    ratios: [50, 30, 10, 10],
    payday: 25,
    createdAt: TS,
    updatedAt: TS,
  };
  // 60/30/10/0 기준 3/3 완료(rate 100, eligible 3)
  const sept: MonthRecord = {
    id: "rec_sept",
    planId: "plan_old",
    month: "2026-09",
    checked: { living: true, saving: true, emergency: true, leisure: false },
    eligible: ["living", "saving", "emergency"],
    rate: 100,
    completedAt: "2026-09-10T00:00:00.000Z",
    snapshot: {
      salary: 3_000_000,
      fixedTotal: 600_000,
      available: 2_400_000,
      ratios: [60, 30, 10, 0],
      amounts: { living: 1_440_000, saving: 720_000, emergency: 240_000, leisure: 0 },
    },
    createdAt: TS,
    updatedAt: TS,
  };
  const today = new Date(2026, 8, 29, 9);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(today);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("체크는 그대로 두고 eligible 4 · rate 75 · completedAt null · 새 금액 스냅샷으로 다시 센다", () => {
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, records: { "2026-09": sept } }));

    expect(resyncCurrentMonth(planA, today)).toEqual({ ok: true });

    const rec = loadRecords().records["2026-09"];
    expect(rec.eligible).toEqual(["living", "saving", "emergency", "leisure"]);
    expect(rec.rate).toBe(75);
    expect(rec.completedAt).toBeNull();
    expect(rec.checked).toEqual({ living: true, saving: true, emergency: true, leisure: false });
    expect(rec.planId).toBe("plan_new");
    expect(rec.snapshot.amounts).toEqual({ living: 1_200_000, saving: 720_000, emergency: 240_000, leisure: 240_000 });
    expect(rec.snapshot.ratios).toEqual([50, 30, 10, 10]);
    expect(rec.id).toBe("rec_sept");
    expect(rec.createdAt).toBe(TS);
  });

  it("다시 세어도 100%면 기존 completedAt을 유지한다", () => {
    const allChecked = { ...sept, checked: { living: true, saving: true, emergency: true, leisure: true } };
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, records: { "2026-09": allChecked } }));
    resyncCurrentMonth(planA, today);
    const rec = loadRecords().records["2026-09"];
    expect(rec.rate).toBe(100);
    expect(rec.completedAt).toBe("2026-09-10T00:00:00.000Z");
  });

  it("이번 달 기록이 없으면 아무것도 쓰지 않는다(setItem 0회)", () => {
    const aug = { ...sept, id: "rec_aug", month: "2026-08" };
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, records: { "2026-08": aug } }));
    const set = vi.spyOn(Storage.prototype, "setItem");
    expect(resyncCurrentMonth(planA, today)).toEqual({ ok: true });
    expect(set).not.toHaveBeenCalled();
  });
});
