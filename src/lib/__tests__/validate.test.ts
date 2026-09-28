import { describe, it, expect } from "vitest";
import { isValidDraft, isValidPlan, isValidRecord, normalizeLegacyPlan, normalizeLegacyRecord } from "@/lib/validate";

const TS = "2026-09-01T00:00:00.000Z";

const planA = {
  version: 1,
  id: "plan_a",
  salary: 3000000,
  fixedCosts: [
    { id: "fc_rent", name: "월세", amount: 500000, createdAt: TS, updatedAt: TS },
    { id: "fc_phone", name: "통신비", amount: 100000, createdAt: TS, updatedAt: TS },
  ],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
  createdAt: TS,
  updatedAt: TS,
};

const recordA = {
  id: "rec_1",
  planId: "plan_a",
  month: "2026-09",
  checked: { living: true, saving: false, emergency: false, leisure: false },
  eligible: ["living", "saving", "emergency", "leisure"],
  rate: 25,
  completedAt: null,
  snapshot: { salary: 3000000, available: 2400000, ratios: [50, 30, 10, 10] },
  createdAt: TS,
  updatedAt: TS,
};

const { version: _v, id: _i, createdAt: _c, updatedAt: _u, ...draftA } = planA;

describe("isValidPlan / isValidDraft", () => {
  it("예시 A는 유효하다", () => {
    expect(isValidPlan(planA)).toBe(true);
    expect(isValidDraft(draftA)).toBe(true);
  });

  it("AC-1: 깨진 값은 정규화해도 무효다", () => {
    const broken = [
      { ...planA, salary: "3000000" },
      { ...planA, ratios: [50, 30, 5, 5] },
      { ...planA, payday: 0 },
      { ...planA, version: 2 },
      { ...planA, fixedCosts: planA.fixedCosts.map((c) => ({ ...c, id: "fc_rent" })) },
      { ...planA, createdAt: "not-a-date" },
    ];
    for (const x of broken) expect(isValidPlan(normalizeLegacyPlan(x))).toBe(false);
  });

  it("AC-2: 초안의 무효 입력", () => {
    const [rent, phone] = planA.fixedCosts;
    const { createdAt: _drop, ...rentNoCreated } = rent;
    const broken: unknown[] = [
      null,
      undefined,
      "plan",
      [],
      { ...draftA, ratios: [50, 30, 5, 5] },
      { ...draftA, salary: "3000000" },
      { ...draftA, payday: 32 },
      { ...draftA, fixedCosts: [rentNoCreated, phone] },
      { ...draftA, fixedCosts: [rent, { ...phone, id: "fc_rent" }] },
      { ...draftA, fixedCosts: [{ ...rent, amount: 3000000 }] },
      { ...draftA, presetId: "p000" },
      { ...draftA, salary: 3000000.5 },
    ];
    for (const x of broken) expect(isValidDraft(x)).toBe(false);
  });

  it("고정비는 최대 10개다", () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `fc_${i}`, name: "항목", amount: 1000, createdAt: TS, updatedAt: TS }));
    expect(isValidDraft({ ...draftA, fixedCosts: many(10) })).toBe(true);
    expect(isValidDraft({ ...draftA, fixedCosts: many(11) })).toBe(false);
  });
});

describe("normalizeLegacyPlan", () => {
  const legacy = {
    version: 1,
    salary: 3000000,
    fixedCosts: [{ id: "fc_rent", name: "월세", amount: 500000 }],
    presetId: "p532",
    ratios: [50, 30, 10, 10],
    payday: 25,
    updatedAt: TS,
  };

  it("AC-3: 결정적 id와 타임스탬프를 채우고 입력을 바꾸지 않는다", () => {
    const before = structuredClone(legacy);
    const a = normalizeLegacyPlan(legacy);
    const b = normalizeLegacyPlan(legacy);
    expect((a as typeof planA).id).toBe("legacy-" + Date.parse(TS).toString(36));
    expect(a).toEqual(b);
    expect((a as typeof planA).createdAt).toBe(TS);
    expect((a as typeof planA).fixedCosts[0].createdAt).toBe(TS);
    expect((a as typeof planA).fixedCosts[0].updatedAt).toBe(TS);
    expect(legacy).toEqual(before);
    expect(isValidPlan(a)).toBe(true);
  });

  it("타입이 틀린 값은 채우지 않고, 조건 밖 입력은 그대로 돌려준다", () => {
    const wrongType = { ...legacy, id: 42 };
    expect((normalizeLegacyPlan(wrongType) as { id: unknown }).id).toBe(42);
    const v2 = { ...legacy, version: 2 };
    expect(normalizeLegacyPlan(v2)).toBe(v2);
    expect(normalizeLegacyPlan(null)).toBeNull();
  });
});

describe("normalizeLegacyRecord / isValidRecord", () => {
  it("AC-4: id·planId·createdAt을 채운다", () => {
    const { id: _i, planId: _p, createdAt: _c, ...rest } = { ...recordA, month: "2026-08", updatedAt: "2026-09-02T00:00:00.000Z" };
    const before = structuredClone(rest);
    const out = normalizeLegacyRecord("2026-08", rest) as Record<string, unknown>;
    expect(out.id).toBe("legacy-2026-08");
    expect(out.planId).toBeNull();
    expect(out.createdAt).toBe("2026-09-02T00:00:00.000Z");
    expect(rest).toEqual(before);
    expect(isValidRecord("2026-08", out)).toBe(true);
  });

  it("updatedAt이 ISO가 아니면 createdAt을 채우지 않는다", () => {
    const out = normalizeLegacyRecord("2026-08", { month: "2026-08", updatedAt: "yesterday" }) as Record<string, unknown>;
    expect(out.createdAt).toBeUndefined();
  });

  it("AC-5: 무효 레코드", () => {
    expect(isValidRecord("2026-09", recordA)).toBe(true);
    expect(isValidRecord("2026-09", { ...recordA, planId: null })).toBe(true);
    const broken: unknown[] = [
      { ...recordA, id: 42 },
      { ...recordA, createdAt: "yesterday" },
      { ...recordA, planId: "" },
      { ...recordA, rate: "50" },
      { ...recordA, month: "2026-08" },
      { ...recordA, completedAt: "later" },
      { ...recordA, eligible: ["rent"] },
      { ...recordA, checked: { living: true } },
      null,
    ];
    for (const x of broken) expect(isValidRecord("2026-09", x)).toBe(false);
    expect(isValidRecord("2026-13", { ...recordA, month: "2026-13" })).toBe(false);
  });
});

describe("validatePlan", () => {
  it("유효한 계획은 valid true, errors 빈 배열", async () => {
    const { validatePlan } = await import("@/lib/validate");
    expect(validatePlan(planA)).toEqual({ valid: true, errors: [] });
  });

  it("깨진 계획은 사유를 담고 isValidPlan과 결과가 같다", async () => {
    const { validatePlan } = await import("@/lib/validate");
    const broken: unknown[] = [
      null,
      "plan",
      [],
      { ...planA, salary: "3000000" },
      { ...planA, ratios: [50, 30, 5, 5] },
      { ...planA, payday: 0 },
      { ...planA, version: 2 },
      { ...planA, fixedCosts: planA.fixedCosts.map((c) => ({ ...c, id: "fc_rent" })) },
      { ...planA, fixedCosts: [{ ...planA.fixedCosts[0], amount: 3000000 }] },
      { ...planA, createdAt: "not-a-date" },
    ];
    for (const x of broken) {
      const r = validatePlan(x);
      expect(r.valid).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);
      expect(r.valid).toBe(isValidPlan(x));
    }
  });
});
