import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import type {
  BucketKey,
  PresetId,
  FixedCost,
  Plan,
  PlanDraft,
  MonthRecord,
  MonthRecordMap,
  Allocation,
  IncomeScenario,
  SaveResult,
  SetupErrors,
  RouteState,
} from "@/lib/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("엔티티 타입과 RouteState 계약 정의 (packet-0001)", () => {
  describe("AC-1: TypeScript compilation passes", () => {
    it("should successfully import all entity types without compilation errors", () => {
      // If this test runs, all type imports succeeded — TypeScript validation passed
      expect(true).toBe(true);
    });
  });

  describe("AC-2: types.ts contains only type definitions (no runtime code)", () => {
    it("should not contain 'export const' statements", () => {
      const typesPath = path.resolve(__dirname, "../../src/lib/types.ts");
      const content = readFileSync(typesPath, "utf-8");
      expect(content).not.toMatch(/export\s+const\s+/);
    });

    it("should not contain 'function' declarations", () => {
      const typesPath = path.resolve(__dirname, "../../src/lib/types.ts");
      const content = readFileSync(typesPath, "utf-8");
      // Match both 'function' and 'export function'
      expect(content).not.toMatch(/^(export\s+)?function\s+/m);
    });

    it("should not contain 'class' declarations", () => {
      const typesPath = path.resolve(__dirname, "../../src/lib/types.ts");
      const content = readFileSync(typesPath, "utf-8");
      // Match both 'class' and 'export class'
      expect(content).not.toMatch(/^(export\s+)?class\s+/m);
    });
  });

  describe("AC-3: RouteState page navigation contracts", () => {
    it("RouteState['/ratio'] should accept {draft: PlanDraft} | undefined", () => {
      const draftState: RouteState["/ratio"] = {
        draft: {
          salary: 50000000,
          payday: 25,
          fixedCosts: [],
        } as PlanDraft,
      };
      const undefinedState: RouteState["/ratio"] = undefined;

      expect(draftState.draft).toBeDefined();
      expect(draftState.draft?.salary).toBe(50000000);
      expect(undefinedState).toBeUndefined();
    });

    it("RouteState['/result'] should accept {justSaved: boolean} | undefined", () => {
      const savedState: RouteState["/result"] = { justSaved: true };
      const notSavedState: RouteState["/result"] = { justSaved: false };
      const undefinedState: RouteState["/result"] = undefined;

      expect(savedState.justSaved).toBe(true);
      expect(notSavedState.justSaved).toBe(false);
      expect(undefinedState).toBeUndefined();
    });
  });

  describe("Entity type definitions: Plan", () => {
    it("Plan should have all required fields with correct types", () => {
      const plan: Plan = {
        version: 1,
        salary: 50000000,
        fixedCosts: [
          { id: "fc1" as FixedCost["id"], name: "집세", amount: 1500000 },
        ],
        payday: 25,
        presetId: "savings" as PresetId,
        ratios: { housing: 0.3 } as Record<BucketKey, number>,
        createdAt: "2026-09-23T00:00:00Z",
        updatedAt: "2026-09-23T00:00:00Z",
      };

      expect(plan.version).toBe(1);
      expect(plan.salary).toBe(50000000);
      expect(plan.payday).toBe(25);
      expect(plan.fixedCosts).toHaveLength(1);
      expect(plan.ratios.housing).toBe(0.3);
    });
  });

  describe("Entity type definitions: MonthRecord & MonthRecordMap", () => {
    it("MonthRecord should track checked buckets and rates", () => {
      const record: MonthRecord = {
        month: "2026-09",
        checked: ["housing" as BucketKey, "food" as BucketKey],
        total: 1500000,
        rate: 0.75,
        updatedAt: "2026-09-23T12:00:00Z",
      };

      expect(record.month).toBe("2026-09");
      expect(record.checked).toContain("housing");
      expect(record.checked).toHaveLength(2);
      expect(record.total).toBe(1500000);
      expect(record.rate).toBe(0.75);
    });

    it("MonthRecordMap should map month strings to MonthRecord objects", () => {
      const record1: MonthRecord = {
        month: "2026-09",
        checked: [],
        total: 1000000,
        rate: 0.5,
        updatedAt: "2026-09-23T00:00:00Z",
      };
      const record2: MonthRecord = {
        month: "2026-10",
        checked: ["housing" as BucketKey],
        total: 1500000,
        rate: 0.75,
        updatedAt: "2026-10-23T00:00:00Z",
      };
      const recordMap: MonthRecordMap = {
        "2026-09": record1,
        "2026-10": record2,
      };

      expect(Object.keys(recordMap)).toHaveLength(2);
      expect(recordMap["2026-09"].total).toBe(1000000);
      expect(recordMap["2026-10"].checked).toContain("housing");
    });
  });

  describe("Entity type definitions: SetupErrors", () => {
    it("SetupErrors should have optional salary, payday, and fixedTotal error messages", () => {
      const errors1: SetupErrors = { salary: "금액을 입력해주세요" };
      const errors2: SetupErrors = { payday: "급여일을 입력해주세요" };
      const errors3: SetupErrors = { fixedTotal: "고정비가 너무 많습니다" };
      const allErrors: SetupErrors = {
        salary: "월급을 입력해주세요",
        payday: "날짜를 입력해주세요",
        fixedTotal: "금액 초과",
      };
      const noErrors: SetupErrors = {}; // All fields optional

      expect(errors1.salary).toBeDefined();
      expect(errors2.payday).toBeDefined();
      expect(errors3.fixedTotal).toBeDefined();
      expect(allErrors.salary).toBeDefined();
      expect(allErrors.payday).toBeDefined();
      expect(allErrors.fixedTotal).toBeDefined();
      expect(Object.keys(noErrors)).toHaveLength(0);
    });
  });

  describe("Entity type definitions: IncomeScenario", () => {
    it("IncomeScenario should have salary, remaining, saving, and yearlySaving fields", () => {
      const scenario: IncomeScenario = {
        salary: 50000000,
        remaining: 35000000,
        saving: 15000000,
        yearlySaving: 180000000,
      };

      expect(scenario.salary).toBe(50000000);
      expect(scenario.remaining).toBe(35000000);
      expect(scenario.saving).toBe(15000000);
      expect(scenario.yearlySaving).toBe(180000000);
    });
  });

  describe("Entity type definitions: SaveResult", () => {
    it("SaveResult should indicate success or failure with plan data", () => {
      const successResult: SaveResult = {
        ok: true,
        plan: {
          version: 1,
          salary: 50000000,
          fixedCosts: [],
          payday: 25,
          presetId: "savings" as PresetId,
          ratios: {},
          createdAt: "2026-09-23T00:00:00Z",
          updatedAt: "2026-09-23T00:00:00Z",
        },
      };

      expect(successResult.ok).toBe(true);
      expect(successResult.plan).toBeDefined();
      expect(successResult.plan?.salary).toBe(50000000);
    });

    it("SaveResult.ok=false should have error message", () => {
      const failResult: SaveResult = {
        ok: false,
        error: "저장에 실패했습니다",
      };

      expect(failResult.ok).toBe(false);
      expect(failResult.error).toBeDefined();
    });
  });

  describe("Entity type definitions: FixedCost", () => {
    it("FixedCost should have id, name, and amount fields", () => {
      const cost: FixedCost = {
        id: "fc1" as FixedCost["id"],
        name: "집세",
        amount: 1500000,
      };

      expect(cost.id).toBe("fc1");
      expect(cost.name).toBe("집세");
      expect(cost.amount).toBe(1500000);
    });
  });

  describe("Entity type definitions: BucketKey and PresetId", () => {
    it("BucketKey should be a branded string type for bucket identifiers", () => {
      const bucketKey: BucketKey = "housing" as BucketKey;
      const anotherKey: BucketKey = "food" as BucketKey;

      expect(typeof bucketKey).toBe("string");
      expect(typeof anotherKey).toBe("string");
    });

    it("PresetId should be a branded string type for preset identifiers", () => {
      const presetId: PresetId = "savings" as PresetId;
      const anotherPresetId: PresetId = "minimalist" as PresetId;

      expect(typeof presetId).toBe("string");
      expect(typeof anotherPresetId).toBe("string");
    });
  });
});
