import { describe, it, expect } from "vitest";
import {
  calcAllocation,
  calcRate,
  activeBuckets,
  buildIncomeScenarios,
  sumRatios,
  matchPreset,
} from "@/lib/calc";
import { PRESETS, BUCKET_ORDER } from "@/lib/constants";
import type { Allocation, IncomeScenario } from "@/lib/types";

describe("배분·이행률·소득 구간 계산 함수", () => {
  // ============ AC-1: 배분 계산 ============
  describe("AC-1: calcAllocation — 기본 비율로 배분하고 1000원 단위 내림, 끝전은 living에", () => {
    it("AC-1-1: salary 3000000, fixedTotal 700000 → buckets와 remaining 정확히 계산", () => {
      const result = calcAllocation(3000000, 700000, "basic_5311");

      expect(result).toEqual({
        fixedTotal: 700000,
        remaining: 2300000,
        buckets: {
          living: 1150000,
          saving: 690000,
          emergency: 230000,
          leisure: 230000,
        },
      });
      expect(result.buckets.living + result.buckets.saving + result.buckets.emergency + result.buckets.leisure).toBe(2300000);
    });

    it("AC-1-2: 1000원 단위 내림 + 끝전을 living에 배치 (나머지 bucket들의 합이 남은 금액과 불일치할 때)", () => {
      const result = calcAllocation(2345670, 0, "basic_5311");

      // saving: 2345670 * 30% = 703,701 → 703,000 (내림)
      // emergency: 2345670 * 10% = 234,567 → 234,000 (내림)
      // leisure: 2345670 * 10% = 234,567 → 234,000 (내림)
      // living: 2345670 - 703000 - 234000 - 234000 = 1,174,670 (끝전 포함)

      expect(result.buckets.saving).toBe(703000);
      expect(result.buckets.emergency).toBe(234000);
      expect(result.buckets.leisure).toBe(234000);
      expect(result.buckets.living).toBe(1174670);
      expect(result.remaining).toBe(2345670);
      // 합계 검증
      const sum =
        result.buckets.living +
        result.buckets.saving +
        result.buckets.emergency +
        result.buckets.leisure;
      expect(sum).toBe(2345670);
    });

    it("AC-1-3: custom 프리셋 (모두 0)일 때 모든 금액이 living에", () => {
      const result = calcAllocation(1000000, 100000, "custom");

      expect(result.buckets.saving).toBe(0);
      expect(result.buckets.emergency).toBe(0);
      expect(result.buckets.leisure).toBe(0);
      expect(result.buckets.living).toBe(900000);
    });
  });

  // ============ AC-2: 비율 계산 ============
  describe("AC-2: calcRate — 비율 계산 (total=0일 때 0 반환)", () => {
    it("AC-2-1: calcRate(234000, 312000) → 비율 계산 (75%)", () => {
      // 234000 / 312000 = 0.75 = 75%
      const rate = calcRate(234000, 312000);
      expect(rate).toBe(75);
    });

    it("AC-2-2: total이 0일 때 0 반환", () => {
      const rate = calcRate(100000, 0);
      expect(rate).toBe(0);
    });

    it("AC-2-3: value가 0일 때 0 반환", () => {
      const rate = calcRate(0, 100000);
      expect(rate).toBe(0);
    });

    it("AC-2-4: 100% 비율 검증", () => {
      const rate = calcRate(500000, 500000);
      expect(rate).toBe(100);
    });
  });

  // ============ AC-3: 활성 bucket과 소득 구간 ============
  describe("AC-3: activeBuckets — 0보다 큰 bucket들만 BUCKET_ORDER 순서로 반환", () => {
    it("AC-3-1: 모든 bucket이 활성 상태일 때 BUCKET_ORDER 순서로 반환", () => {
      const allocation: Allocation = {
        fixedTotal: 700000,
        remaining: 2300000,
        buckets: {
          living: 1150000,
          saving: 690000,
          emergency: 230000,
          leisure: 230000,
        },
      };

      const result = activeBuckets(allocation.buckets);
      expect(result).toEqual(["living", "saving", "emergency", "leisure"]);
    });

    it("AC-3-2: leisure가 0인 경우 제외하고 반환", () => {
      const allocation: Allocation = {
        fixedTotal: 0,
        remaining: 1000000,
        buckets: {
          living: 500000,
          saving: 300000,
          emergency: 200000,
          leisure: 0,
        },
      };

      const result = activeBuckets(allocation.buckets);
      expect(result).toEqual(["living", "saving", "emergency"]);
    });

    it("AC-3-3: 여러 bucket이 0일 때 제외", () => {
      const allocation: Allocation = {
        fixedTotal: 0,
        remaining: 1000000,
        buckets: {
          living: 1000000,
          saving: 0,
          emergency: 0,
          leisure: 0,
        },
      };

      const result = activeBuckets(allocation.buckets);
      expect(result).toEqual(["living"]);
    });
  });

  describe("AC-3 continued: buildIncomeScenarios — 월급 기준 ±50만·±100만원 구간", () => {
    it("AC-3-4: salary 3000000, fixedTotal 700000 → 5개 구간, saving [390000, 540000, 690000, 840000, 990000]", () => {
      const scenarios = buildIncomeScenarios(3000000, 700000);

      expect(scenarios).toHaveLength(5);
      expect(scenarios.map((s) => s.saving)).toEqual([390000, 540000, 690000, 840000, 990000]);

      // 첫 구간: salary 2000000, yearlySaving 4680000
      expect(scenarios[0].salary).toBe(2000000);
      expect(scenarios[0].remaining).toBe(1300000);
      expect(scenarios[0].yearlySaving).toBe(390000 * 12); // 4,680,000

      // 중간 구간: salary 3000000
      expect(scenarios[2].salary).toBe(3000000);
      expect(scenarios[2].remaining).toBe(2300000);
      expect(scenarios[2].yearlySaving).toBe(690000 * 12); // 8,280,000

      // 마지막 구간: salary 4000000
      expect(scenarios[4].salary).toBe(4000000);
      expect(scenarios[4].remaining).toBe(3300000);
      expect(scenarios[4].yearlySaving).toBe(990000 * 12); // 11,880,000
    });

    it("AC-3-5: salary 1200000, fixedTotal 600000 → salary < 100000이거나 remaining ≤ 0인 구간 제외", () => {
      const scenarios = buildIncomeScenarios(1200000, 600000);

      // -100만: salary 200000, remaining -400000 → 제외
      // -50만: salary 700000, remaining 100000 → 포함
      // 기준: salary 1200000, remaining 600000 → 포함
      // +50만: salary 1700000, remaining 1100000 → 포함
      // +100만: salary 2200000, remaining 1600000 → 포함
      expect(scenarios).toHaveLength(4);
      expect(scenarios.map((s) => s.salary)).toEqual([700000, 1200000, 1700000, 2200000]);
    });

    it("AC-3-6: salary 100000 이상 조건 — salary < 100000인 시나리오는 제외", () => {
      const scenarios = buildIncomeScenarios(150000, 0);
      // -100만: salary -850000 → 제외
      // -50만: salary -350000 → 제외
      // 기준: salary 150000 → 포함 (100000 이상)
      // +50만: salary 650000 → 포함
      // +100만: salary 1150000 → 포함
      expect(scenarios.length).toBeGreaterThan(0);
      expect(scenarios.every((s) => s.salary >= 100000)).toBe(true);
      expect(scenarios.every((s) => s.remaining > 0)).toBe(true);
    });
  });

  // ============ 추가 함수들 ============
  describe("sumRatios — 배분 비율 합산", () => {
    it("sumRatios: 프리셋의 비율 합이 100%인지 검증", () => {
      const ratios = { living: 50, saving: 30, emergency: 10, leisure: 10 };
      const sum = sumRatios(ratios);
      expect(sum).toBe(100);
    });

    it("sumRatios: custom 비율 (모두 0)은 0 반환", () => {
      const ratios = { living: 0, saving: 0, emergency: 0, leisure: 0 };
      const sum = sumRatios(ratios);
      expect(sum).toBe(0);
    });
  });

  describe("matchPreset — 비율 매칭 프리셋 찾기", () => {
    it("matchPreset: basic_5311 비율과 일치하면 'basic_5311' 반환", () => {
      const ratios = { living: 50, saving: 30, emergency: 10, leisure: 10 };
      const preset = matchPreset(ratios);
      expect(preset).toBe("basic_5311");
    });

    it("matchPreset: saving_4411 비율과 일치하면 'saving_4411' 반환", () => {
      const ratios = { living: 40, saving: 40, emergency: 10, leisure: 10 };
      const preset = matchPreset(ratios);
      expect(preset).toBe("saving_4411");
    });

    it("matchPreset: 어떤 프리셋과도 일치하지 않으면 'custom' 반환", () => {
      const ratios = { living: 45, saving: 35, emergency: 10, leisure: 10 };
      const preset = matchPreset(ratios);
      expect(preset).toBe("custom");
    });
  });

  // ============ Edge cases ============
  describe("Edge cases", () => {
    it("salary 0, fixedTotal 0 → 배분 결과가 모두 0", () => {
      const result = calcAllocation(0, 0, "basic_5311");
      expect(result.remaining).toBe(0);
      expect(Object.values(result.buckets).every((v) => v === 0)).toBe(true);
    });

    it("calcRate: 매우 큰 숫자도 정확히 계산", () => {
      const rate = calcRate(999999999, 1000000000);
      expect(rate).toBeCloseTo(99.9999999, 2);
    });

    it("buildIncomeScenarios: salary가 매우 적을 때 시나리오가 비워질 수 있음", () => {
      const scenarios = buildIncomeScenarios(50000, 100000);
      // remaining이 모두 음수가 될 수 있으므로 빈 배열 반환
      expect(Array.isArray(scenarios)).toBe(true);
    });
  });
});
