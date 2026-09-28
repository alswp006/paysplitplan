import { describe, it, expect, vi, beforeEach } from "vitest";
import { listPlans, loadPlan, loadRecords, loadReview, saveRecord, savePlan, saveReview, PLAN_KEY, RECORDS_KEY, REVIEW_KEY } from "@/lib/storage";
import type { MonthRecord, PlanDraft, SalaryPlan } from "@/lib/types";

const TS = "2026-09-01T00:00:00.000Z";

const draft: PlanDraft = {
  salary: 3_500_000,
  fixedCosts: [{ id: "fc_rent", name: "월세", amount: 1_000_000, createdAt: TS, updatedAt: TS }],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
};

const planA: SalaryPlan = { version: 1, id: "plan_a", ...draft, salary: 3_000_000, createdAt: TS, updatedAt: TS };

const record = {
  id: "rec1",
  planId: "plan_a",
  month: "2026-09",
  checked: { living: true, saving: false, emergency: false, leisure: false },
  eligible: ["living"],
  rate: 100,
  completedAt: null,
  snapshot: {
    salary: 3_500_000,
    fixedTotal: 1_000_000,
    available: 2_500_000,
    ratios: [50, 30, 10, 10],
    amounts: { living: 1_250_000, saving: 750_000, emergency: 250_000, leisure: 250_000 },
  },
  createdAt: TS,
  updatedAt: TS,
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T01:00:00.000Z"));
});

describe("savePlan", () => {
  it("AC-1: 새 계획은 version 1 · 새 id · createdAt = updatedAt, 고정비는 초안 그대로", () => {
    expect(savePlan(draft)).toEqual({ ok: true });
    const saved = JSON.parse(localStorage.getItem(PLAN_KEY)!);
    expect(saved.version).toBe(1);
    expect(saved.id).not.toBe("");
    expect(saved.createdAt).toBe("2026-09-29T01:00:00.000Z");
    expect(saved.updatedAt).toBe("2026-09-29T01:00:00.000Z");
    expect(saved.fixedCosts[0]).toEqual(draft.fixedCosts[0]);
  });

  it("AC-2: 기존 계획의 id·createdAt을 유지하고 updatedAt만 갱신한다", () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(planA));
    vi.setSystemTime(new Date("2026-09-29T02:00:00.000Z"));
    expect(savePlan({ ...draft, fixedCosts: [], salary: 3_500_000 })).toEqual({ ok: true });
    const saved = JSON.parse(localStorage.getItem(PLAN_KEY)!);
    expect(saved).toMatchObject({ id: "plan_a", createdAt: TS, updatedAt: "2026-09-29T02:00:00.000Z", salary: 3_500_000 });
  });

  it("시계가 createdAt보다 과거면 updatedAt은 createdAt이다", () => {
    const future = { ...planA, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" };
    localStorage.setItem(PLAN_KEY, JSON.stringify(future));
    savePlan({ ...draft, fixedCosts: [] });
    expect(JSON.parse(localStorage.getItem(PLAN_KEY)!).updatedAt).toBe("2026-10-01T00:00:00.000Z");
  });

  it("AC-2: setItem이 던지면 QUOTA이고 저장 문자열은 그대로다", () => {
    const before = JSON.stringify(planA);
    localStorage.setItem(PLAN_KEY, before);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(savePlan({ ...draft, fixedCosts: [] })).toEqual({ ok: false, error: "QUOTA" });
    spy.mockRestore();
    expect(localStorage.getItem(PLAN_KEY)).toBe(before);
  });
});

describe("loadPlan", () => {
  it("저장한 계획을 그대로 읽는다", () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(planA));
    expect(loadPlan()).toEqual(planA);
  });

  it("AC-3: 깨진 JSON·타입 오류는 null + 키 삭제 + console.error 0회", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const bad of ["{broken", JSON.stringify({ ...planA, salary: "3000000" })]) {
      localStorage.setItem(PLAN_KEY, bad);
      expect(loadPlan()).toBeNull();
      expect(localStorage.getItem(PLAN_KEY)).toBeNull();
    }
    expect(err).not.toHaveBeenCalled();
  });

  it("AC-3: 레거시 계획은 두 번 읽어도 같은 id이고 저장 문자열은 그대로다", () => {
    const { id: _id, createdAt: _c, ...legacy } = planA;
    const raw = JSON.stringify(legacy);
    localStorage.setItem(PLAN_KEY, raw);
    const a = loadPlan();
    const b = loadPlan();
    expect(a?.id).toBeTruthy();
    expect(a?.id).toBe(b?.id);
    expect(localStorage.getItem(PLAN_KEY)).toBe(raw);
  });
});

describe("loadRecords", () => {
  const empty = { version: 1, records: {} };

  it("AC-4: 키 없음·null·깨짐·version 2·배열 records는 빈 스토어이고 쓰기 호출이 없다", () => {
    const set = vi.spyOn(Storage.prototype, "setItem");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    expect(loadRecords()).toEqual(empty);
    for (const raw of ["null", "{broken", JSON.stringify({ version: 2, records: {} }), JSON.stringify({ version: 1, records: [] })]) {
      localStorage.clear();
      set.mockClear();
      localStorage.setItem(RECORDS_KEY, raw);
      set.mockClear();
      expect(loadRecords()).toEqual(empty);
      expect(set).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    }
  });

  it("AC-4: 잘못된 레코드만 빼고, 레거시 레코드는 id·planId를 채워 포함한다", () => {
    const { id: _id, planId: _p, createdAt: _c, ...legacy } = { ...record, month: "2026-08" };
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({
        version: 1,
        records: { "2026-09": record, "2026-08": legacy, "2026-07": "x", "2026-06": { id: "only" } },
      }),
    );
    const { records } = loadRecords();
    expect(Object.keys(records).sort()).toEqual(["2026-08", "2026-09"]);
    expect(records["2026-08"]).toMatchObject({ id: "legacy-2026-08", planId: null });
  });
});

describe("saveRecord", () => {
  it("기록을 저장하고 loadRecords로 읽는다", () => {
    saveRecord(record as MonthRecord);
    expect(loadRecords().records["2026-09"]).toEqual(record);
  });

  it("같은 달은 덮어쓰고 24개월을 넘으면 가장 오래된 달을 지운다", () => {
    for (let i = 0; i < 25; i++) {
      const month = `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
      saveRecord({ ...record, id: `r${i}`, month } as MonthRecord);
    }
    const months = Object.keys(loadRecords().records);
    expect(months).toHaveLength(24);
    expect(months).not.toContain("2024-01");
    expect(months).toContain("2026-01");
    saveRecord({ ...record, month: "2026-01", rate: 50 } as MonthRecord);
    expect(loadRecords().records["2026-01"].rate).toBe(50);
  });

  it("잘못된 기록은 저장하지 않고, setItem이 던져도 던지지 않는다", () => {
    saveRecord({ ...record, month: "2026-13" } as MonthRecord);
    expect(localStorage.getItem(RECORDS_KEY)).toBeNull();
    saveRecord(record as MonthRecord);
    const before = localStorage.getItem(RECORDS_KEY);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => saveRecord({ ...record, rate: 10 } as MonthRecord)).not.toThrow();
    vi.restoreAllMocks();
    expect(localStorage.getItem(RECORDS_KEY)).toBe(before);
  });
});

describe("loadReview / saveReview", () => {
  const review = { version: 1, id: "review-prompt", createdAt: TS, updatedAt: TS } as const;

  it("저장한 리뷰 기록을 읽는다", () => {
    expect(loadReview("plan_a")).toBeNull();
    saveReview(review);
    expect(loadReview("plan_a")).toEqual(review);
  });

  it("레거시 '1'·깨진 값은 null이고 키는 그대로 둔다", () => {
    localStorage.setItem(REVIEW_KEY, "1");
    expect(loadReview("plan_a")).toBeNull();
    expect(localStorage.getItem(REVIEW_KEY)).toBe("1");
    localStorage.setItem(REVIEW_KEY, "{broken");
    expect(loadReview("plan_a")).toBeNull();
    expect(localStorage.getItem(REVIEW_KEY)).toBe("{broken");
  });

  it("모양이 틀린 기록은 저장하지 않는다", () => {
    saveReview({ ...review, id: "x" } as never);
    expect(localStorage.getItem(REVIEW_KEY)).toBeNull();
  });
});

describe("listPlans", () => {
  it("계획이 없으면 빈 배열, 있으면 하나를 돌려준다", () => {
    expect(listPlans()).toEqual([]);
    localStorage.setItem(PLAN_KEY, JSON.stringify(planA));
    expect(listPlans()).toEqual([{ id: "plan_a", name: "월급 300만 원", createdAt: TS }]);
  });
});
