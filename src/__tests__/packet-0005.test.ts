import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isValidPlan,
  isValidDraft,
  isValidRecord,
  normalizeLegacyPlan,
  normalizeLegacyRecord,
} from "@/lib/validate";

describe("검증 + 레거시 정규화 (validate.ts)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T12:00:00+09:00"));
  });

  // AC-1: 예시 A를 여러 방식으로 바꾸면 isValidPlan(normalizeLegacyPlan(x))가 모두 false다
  describe("AC-1: Invalid plans after normalization", () => {
    const validExampleA = {
      id: "plan-abc",
      version: 1,
      salary: 3000000,
      payday: 15,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      fixedCosts: [
        {
          id: "fc_rent",
          name: "렌트",
          amount: 500000,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      ratios: [50, 30, 10, 10],
      presetId: "p532",
    };

    it("AC-1[P0]: should reject plan when salary is string", () => {
      const invalid = {
        ...validExampleA,
        salary: "3000000", // should be number
      };
      const normalized = normalizeLegacyPlan(invalid as any);
      expect(isValidPlan(normalized)).toBe(false);
    });

    it("AC-1[P0]: should reject plan when ratios sum is not 100", () => {
      const invalid = {
        ...validExampleA,
        ratios: [50, 30, 5, 5], // sum = 90, not 100
      };
      const normalized = normalizeLegacyPlan(invalid);
      expect(isValidPlan(normalized)).toBe(false);
    });

    it("AC-1[P0]: should reject plan when payday is 0", () => {
      const invalid = {
        ...validExampleA,
        payday: 0, // should be 1-31
      };
      const normalized = normalizeLegacyPlan(invalid);
      expect(isValidPlan(normalized)).toBe(false);
    });

    it("AC-1[P0]: should reject plan when version is 2", () => {
      const invalid = {
        ...validExampleA,
        version: 2, // should be 1
      };
      const normalized = normalizeLegacyPlan(invalid);
      expect(isValidPlan(normalized)).toBe(false);
    });

    it("AC-1[P0]: should reject plan when fixedCosts have duplicate ids", () => {
      const invalid = {
        ...validExampleA,
        fixedCosts: [
          {
            id: "fc_rent",
            name: "렌트",
            amount: 500000,
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
          {
            id: "fc_rent", // duplicate
            name: "유틸리티",
            amount: 100000,
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
        ],
      };
      const normalized = normalizeLegacyPlan(invalid);
      expect(isValidPlan(normalized)).toBe(false);
    });

    it("AC-1[P0]: should reject plan when createdAt is not a valid ISO date", () => {
      const invalid = {
        ...validExampleA,
        createdAt: "not-a-date",
      };
      const normalized = normalizeLegacyPlan(invalid as any);
      expect(isValidPlan(normalized)).toBe(false);
    });
  });

  // AC-2: isValidDraft는 null, 합 90, salary 문자열, payday 32, createdAt 누락, 고정비 id 중복에 대해 모두 false다. 예시 A 초안에는 true다
  describe("AC-2: Draft validation", () => {
    const validExampleDraft = {
      salary: 3000000,
      payday: 15,
      fixedCosts: [
        {
          id: "fc_rent",
          name: "렌트",
          amount: 500000,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      ratios: [50, 30, 10, 10],
      presetId: "p532",
    };

    it("AC-2[P0]: should reject draft when input is null", () => {
      expect(isValidDraft(null)).toBe(false);
    });

    it("AC-2[P0]: should reject draft when ratios sum is not 100", () => {
      const invalid = {
        ...validExampleDraft,
        ratios: [50, 30, 5, 5],
      };
      expect(isValidDraft(invalid as any)).toBe(false);
    });

    it("AC-2[P0]: should reject draft when salary is string", () => {
      const invalid = {
        ...validExampleDraft,
        salary: "3000000",
      };
      expect(isValidDraft(invalid as any)).toBe(false);
    });

    it("AC-2[P0]: should reject draft when payday is 32", () => {
      const invalid = {
        ...validExampleDraft,
        payday: 32,
      };
      expect(isValidDraft(invalid as any)).toBe(false);
    });

    it("AC-2[P0]: should reject draft when fixedCost has no createdAt", () => {
      const invalid = {
        ...validExampleDraft,
        fixedCosts: [
          {
            id: "fc_rent",
            name: "렌트",
            amount: 500000,
            updatedAt: "2026-09-01T00:00:00.000Z",
            // createdAt missing
          },
        ],
      };
      expect(isValidDraft(invalid as any)).toBe(false);
    });

    it("AC-2[P0]: should reject draft when fixedCosts have duplicate ids", () => {
      const invalid = {
        ...validExampleDraft,
        fixedCosts: [
          {
            id: "fc_rent",
            name: "렌트",
            amount: 500000,
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
          {
            id: "fc_rent",
            name: "유틸리티",
            amount: 100000,
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
        ],
      };
      expect(isValidDraft(invalid as any)).toBe(false);
    });

    it("AC-2[P0]: should accept valid example A draft", () => {
      expect(isValidDraft(validExampleDraft as any)).toBe(true);
    });
  });

  // AC-3: updatedAt만 있는 레거시 계획을 normalizeLegacyPlan하면 id는 결정적이고, createdAt과 고정비 타임스탬프가 채워진다
  describe("AC-3: Legacy plan normalization with deterministic id and timestamp preservation", () => {
    it("AC-3[P0]: should generate deterministic id from updatedAt", () => {
      const updatedAtStr = "2026-09-01T00:00:00.000Z";
      const legacy = {
        version: 1,
        salary: 3000000,
        payday: 15,
        fixedCosts: [
          {
            id: "fc_rent",
            name: "렌트",
            amount: 500000,
            // createdAt will be added
          },
        ],
        ratios: [50, 30, 10, 10],
        presetId: "p532",
        updatedAt: updatedAtStr,
        // createdAt missing
      };

      const normalized1 = normalizeLegacyPlan(legacy as any);
      const normalized2 = normalizeLegacyPlan(legacy as any);

      // id should be deterministic
      expect(normalized1.id).toBeDefined();
      expect(normalized1.id).toMatch(/^legacy-/);
      expect(normalized1.id).toBe(normalized2.id);

      // Verify id format: 'legacy-' + Date.parse(updatedAt).toString(36)
      const expectedId =
        "legacy-" + Date.parse(updatedAtStr).toString(36);
      expect(normalized1.id).toBe(expectedId);
    });

    it("AC-3[P0]: should fill createdAt and fixedCost timestamps from updatedAt", () => {
      const updatedAtStr = "2026-09-01T00:00:00.000Z";
      const legacy = {
        version: 1,
        salary: 3000000,
        payday: 15,
        fixedCosts: [
          {
            id: "fc_rent",
            name: "렌트",
            amount: 500000,
          },
        ],
        ratios: [50, 30, 10, 10],
        presetId: "p532",
        updatedAt: updatedAtStr,
      };

      const normalized = normalizeLegacyPlan(legacy as any);

      expect(normalized.createdAt).toBe(updatedAtStr);
      expect(normalized.fixedCosts[0].createdAt).toBe(updatedAtStr);
    });

    it("AC-3[P0]: should not mutate input object", () => {
      const updatedAtStr = "2026-09-01T00:00:00.000Z";
      const legacy = {
        version: 1,
        salary: 3000000,
        payday: 15,
        fixedCosts: [
          {
            id: "fc_rent",
            name: "렌트",
            amount: 500000,
          },
        ],
        ratios: [50, 30, 10, 10],
        presetId: "p532",
        updatedAt: updatedAtStr,
      };

      const originalJSON = JSON.stringify(legacy);
      normalizeLegacyPlan(legacy as any);
      const afterJSON = JSON.stringify(legacy);

      expect(originalJSON).toBe(afterJSON);
    });
  });

  // AC-4: normalizeLegacyRecord('2026-08', 레코드)의 결과는 id 'legacy-2026-08', planId null, createdAt = updatedAt이다
  describe("AC-4: Legacy record normalization", () => {
    it("AC-4[P0]: should generate legacy id from month, set planId to null, createdAt from updatedAt", () => {
      const month = "2026-08";
      const legacyRecord = {
        month: "2026-08",
        amount: 1000000,
        note: "test record",
        updatedAt: "2026-09-01T10:00:00.000Z",
        // id, planId, createdAt missing
      };

      const normalized = normalizeLegacyRecord(
        month,
        legacyRecord as any
      );

      expect(normalized.id).toBe("legacy-2026-08");
      expect(normalized.planId).toBeNull();
      expect(normalized.createdAt).toBe("2026-09-01T10:00:00.000Z");
      expect(normalized.month).toBe("2026-08");
    });

    it("AC-4[P0]: should not mutate input record", () => {
      const month = "2026-08";
      const legacyRecord = {
        month: "2026-08",
        amount: 1000000,
        updatedAt: "2026-09-01T10:00:00.000Z",
      };

      const originalJSON = JSON.stringify(legacyRecord);
      normalizeLegacyRecord(month, legacyRecord as any);
      const afterJSON = JSON.stringify(legacyRecord);

      expect(originalJSON).toBe(afterJSON);
    });
  });

  // AC-5: isValidRecord는 id 42, createdAt 'yesterday', planId '', rate '50', 키/month 불일치에 대해 모두 false다
  describe("AC-5: Record validation", () => {
    const validRecord = {
      id: "rec-123",
      month: "2026-09",
      amount: 1000000,
      rate: 50,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      planId: "plan-abc",
      completedAt: null,
      checked: { living: true, saving: false, emergency: false, leisure: false },
      eligible: ["living", "saving", "emergency", "leisure"],
      snapshot: {
        salary: 3000000,
        fixedTotal: 500000,
        available: 2500000,
        ratios: [50, 30, 10, 10],
        amounts: { living: 1250000, saving: 750000, emergency: 250000, leisure: 250000 },
      },
    };

    it("AC-5[P0]: should reject record when id is not string", () => {
      const invalid = {
        ...validRecord,
        id: 42,
      };
      expect(isValidRecord("2026-09", invalid as any)).toBe(false);
    });

    it("AC-5[P0]: should reject record when createdAt is not valid ISO date", () => {
      const invalid = {
        ...validRecord,
        createdAt: "yesterday",
      };
      expect(isValidRecord("2026-09", invalid as any)).toBe(false);
    });

    it("AC-5[P0]: should reject record when planId is empty string", () => {
      const invalid = {
        ...validRecord,
        planId: "",
      };
      expect(isValidRecord("2026-09", invalid as any)).toBe(false);
    });

    it("AC-5[P0]: should reject record when rate is not a number", () => {
      const invalid = {
        ...validRecord,
        rate: "50",
      };
      expect(isValidRecord("2026-09", invalid as any)).toBe(false);
    });

    it("AC-5[P0]: should reject record when month key doesn't match record.month", () => {
      const invalid = {
        ...validRecord,
        month: "2026-08", // key is '2026-09' but month is '2026-08'
      };
      expect(isValidRecord("2026-09", invalid as any)).toBe(false);
    });

    it("AC-5[P0]: should accept valid record", () => {
      expect(isValidRecord("2026-09", validRecord)).toBe(true);
    });

    it("AC-5[P0]: should accept record with planId as null", () => {
      const recordWithNullPlanId = {
        ...validRecord,
        planId: null,
      };
      expect(isValidRecord("2026-09", recordWithNullPlanId as any)).toBe(
        true
      );
    });
  });

  // Integration: normalizeLegacyPlan result should pass isValidPlan
  describe("Integration: normalized legacy plan passes validation", () => {
    it("should produce valid plan from minimal legacy input", () => {
      const minimal = {
        version: 1,
        salary: 5000000,
        payday: 20,
        fixedCosts: [],
        ratios: [60, 20, 10, 10],
        presetId: "p622",
        updatedAt: "2026-09-15T08:30:00.000Z",
      };

      const normalized = normalizeLegacyPlan(minimal as any);
      expect(isValidPlan(normalized)).toBe(true);
      expect(normalized.id).toBeDefined();
      expect(normalized.createdAt).toBe(minimal.updatedAt);
      expect(normalized.version).toBe(1);
    });
  });
});
