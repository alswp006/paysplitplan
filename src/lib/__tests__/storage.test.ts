import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listPlans,
  loadPlan,
  loadRecords,
  loadReview,
  peekPlan,
  pruneMonths,
  saveRecord,
  savePlan,
  saveReview,
  writeMonthRecord,
  PLAN_BACKUP_KEY,
  PLAN_KEY,
  RECORDS_BACKUP_KEY,
  RECORDS_KEY,
  REVIEW_KEY,
} from "@/lib/storage";
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

describe("데이터를 잃지 않게 — 백업·읽기 전용·원문 보존", () => {
  it("loadPlan('{broken') → 키는 지우되(null) 원문을 paysplit:plan:v1:bak에 먼저 복사한다", () => {
    localStorage.setItem(PLAN_KEY, "{broken");
    expect(loadPlan()).toBeNull();
    expect(localStorage.getItem(PLAN_KEY)).toBeNull();
    expect(PLAN_BACKUP_KEY).toBe("paysplit:plan:v1:bak");
    expect(localStorage.getItem(PLAN_BACKUP_KEY)).toBe("{broken");
  });

  it("loadPlan: 백업 쓰기가 실패하면 원문을 지우지 않는다", () => {
    localStorage.setItem(PLAN_KEY, "{broken");
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(loadPlan()).toBeNull();
    set.mockRestore();
    expect(localStorage.getItem(PLAN_KEY)).toBe("{broken");
  });

  it("peekPlan은 깨진 원문을 그대로 두고 setItem·removeItem을 한 번도 부르지 않는다", () => {
    localStorage.setItem(PLAN_KEY, "{broken");
    const set = vi.spyOn(Storage.prototype, "setItem");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    expect(peekPlan()).toBeNull();
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(localStorage.getItem(PLAN_KEY)).toBe("{broken");
    set.mockRestore();
    remove.mockRestore();
    localStorage.setItem(PLAN_KEY, JSON.stringify(planA));
    expect(peekPlan()).toEqual(planA);
  });

  it("savePlan: 검증에 실패한 원문 위에 쓰기 전에 :bak에 복사한다", () => {
    localStorage.setItem(PLAN_KEY, '{"version":1,"salary":"x"}');
    expect(savePlan(draft)).toEqual({ ok: true });
    expect(localStorage.getItem(PLAN_BACKUP_KEY)).toBe('{"version":1,"salary":"x"}');
    expect(loadPlan()?.salary).toBe(3_500_000);
  });

  it("writeMonthRecord: 8월 원문이 rate:'50'(무효)이어도 9월을 쓴 뒤 8월 원문이 문자 그대로 남는다", () => {
    const aug = { ...record, id: "rec-aug", month: "2026-08", rate: "50" };
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, records: { "2026-08": aug } }));
    expect(writeMonthRecord(record as MonthRecord)).toEqual({ ok: true });
    const raw = JSON.parse(localStorage.getItem(RECORDS_KEY)!);
    expect(raw.records["2026-08"]).toEqual(aug);
    expect(raw.records["2026-09"]).toEqual(record);
    // 읽기는 여전히 무효 레코드를 걸러 낸다
    expect(Object.keys(loadRecords().records)).toEqual(["2026-09"]);
    // 대상 달이 아니니 백업은 필요 없다
    expect(localStorage.getItem(RECORDS_BACKUP_KEY)).toBeNull();
  });

  it("writeMonthRecord: 원문이 '{x'(파싱 불가)여도 쓰기는 성공하고 원문은 :bak에 남는다", () => {
    localStorage.setItem(RECORDS_KEY, "{x");
    expect(writeMonthRecord(record as MonthRecord)).toEqual({ ok: true });
    expect(RECORDS_BACKUP_KEY).toBe("paysplit:records:v1:bak");
    expect(localStorage.getItem(RECORDS_BACKUP_KEY)).toBe("{x");
    expect(loadRecords().records["2026-09"]).toEqual(record);
  });

  it("writeMonthRecord: 대상 달의 원문이 무효면 원문 전체를 :bak에 복사한 뒤 덮어쓴다", () => {
    const broken = JSON.stringify({ version: 1, records: { "2026-09": { month: "2026-09", rate: "x" } } });
    localStorage.setItem(RECORDS_KEY, broken);
    expect(writeMonthRecord(record as MonthRecord)).toEqual({ ok: true });
    expect(localStorage.getItem(RECORDS_BACKUP_KEY)).toBe(broken);
    expect(loadRecords().records["2026-09"]).toEqual(record);
  });

  it("writeMonthRecord: 백업이 필요한데 쓰기가 막히면 QUOTA이고 원문은 그대로다", () => {
    localStorage.setItem(RECORDS_KEY, "{x");
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(writeMonthRecord(record as MonthRecord)).toEqual({ ok: false, error: "QUOTA" });
    set.mockRestore();
    expect(localStorage.getItem(RECORDS_KEY)).toBe("{x");
  });

  it("달 키 26개 + 비월 키 1개면 최신 24개와 비월 키가 남는다", () => {
    const records: Record<string, unknown> = { note: "keep-me" };
    for (let i = 0; i < 26; i++) {
      const month = `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
      records[month] = { ...record, id: `r${i}`, month };
    }
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, records }));
    expect(writeMonthRecord({ ...record, month: "2026-02", id: "r25" } as MonthRecord)).toEqual({ ok: true });
    const raw = JSON.parse(localStorage.getItem(RECORDS_KEY)!);
    const months = Object.keys(raw.records).filter((k) => /^\d{4}-\d{2}$/.test(k)).sort();
    expect(months).toHaveLength(24);
    expect(months[0]).toBe("2024-03");
    expect(months[23]).toBe("2026-02");
    expect(raw.records.note).toBe("keep-me");
  });

  it("정리로 지워지는 달에 무효 원문이 있으면 원문 전체를 :bak에 먼저 복사한다(review 0930)", () => {
    const records: Record<string, unknown> = { "2024-01": { month: "2024-01", rate: "50" } };
    for (let i = 1; i < 24; i++) {
      const month = `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
      records[month] = { ...record, id: `r${i}`, month };
    }
    const before = JSON.stringify({ version: 1, records });
    localStorage.setItem(RECORDS_KEY, before);
    expect(writeMonthRecord({ ...record, month: "2026-01", id: "r24" } as MonthRecord)).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem(RECORDS_KEY)!).records["2024-01"]).toBeUndefined();
    expect(localStorage.getItem(RECORDS_BACKUP_KEY)).toBe(before);
  });

  it("pruneMonths는 지운 달을 [달, 원문]으로 돌려주고 달 형식이 아닌 키는 건드리지 않는다", () => {
    const records: Record<string, unknown> = { "2026-01": 1, "2026-02": 2, "2026-03": 3, extra: "x", "2026-13": "bad" };
    expect(pruneMonths(records, 2)).toEqual([["2026-01", 1]]);
    expect(records).toEqual({ "2026-02": 2, "2026-03": 3, extra: "x", "2026-13": "bad" });
  });
});
