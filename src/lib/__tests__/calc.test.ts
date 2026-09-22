import { describe, it, expect } from "vitest";
import {
  calcAllocation,
  calcRate,
  activeBuckets,
  buildIncomeScenarios,
  sumRatios,
  matchPreset,
} from "@/lib/calc";

describe("calcAllocation", () => {
  it("basic_5311로 배분하고 1000원 단위로 내림한다", () => {
    expect(calcAllocation(3000000, 700000, "basic_5311")).toEqual({
      fixedTotal: 700000,
      remaining: 2300000,
      buckets: { living: 1150000, saving: 690000, emergency: 230000, leisure: 230000 },
    });
  });

  it("끝전은 living에 몰아준다", () => {
    const result = calcAllocation(2345670, 0, "basic_5311");
    expect(result.buckets).toEqual({
      saving: 703000,
      emergency: 234000,
      leisure: 234000,
      living: 1174670,
    });
    const sum =
      result.buckets.living + result.buckets.saving + result.buckets.emergency + result.buckets.leisure;
    expect(sum).toBe(2345670);
  });

  it("custom 프리셋은 전액 living에 배정한다", () => {
    const result = calcAllocation(1000000, 100000, "custom");
    expect(result.buckets).toEqual({ living: 900000, saving: 0, emergency: 0, leisure: 0 });
  });
});

describe("calcRate", () => {
  it("value/total 비율을 퍼센트로 반환한다", () => {
    expect(calcRate(234000, 312000)).toBe(75);
  });

  it("total이 0이면 0을 반환한다", () => {
    expect(calcRate(100000, 0)).toBe(0);
  });
});

describe("activeBuckets", () => {
  it("배분액이 0보다 큰 칸만 BUCKET_ORDER 순서로 반환한다", () => {
    expect(
      activeBuckets({ living: 1150000, saving: 690000, emergency: 230000, leisure: 230000 })
    ).toEqual(["living", "saving", "emergency", "leisure"]);

    expect(
      activeBuckets({ living: 1000000, saving: 0, emergency: 0, leisure: 0 })
    ).toEqual(["living"]);
  });
});

describe("buildIncomeScenarios", () => {
  it("월급 ±50만·±100만원 구간을 만든다", () => {
    const scenarios = buildIncomeScenarios(3000000, 700000);
    expect(scenarios).toHaveLength(5);
    expect(scenarios.map((s) => s.saving)).toEqual([390000, 540000, 690000, 840000, 990000]);
    expect(scenarios[0].yearlySaving).toBe(4680000);
  });

  it("salary가 10만원 미만이거나 remaining이 0 이하인 구간은 제외한다", () => {
    const scenarios = buildIncomeScenarios(1200000, 600000);
    expect(scenarios.map((s) => s.salary)).toEqual([700000, 1200000, 1700000, 2200000]);
  });
});

describe("sumRatios", () => {
  it("비율 합을 반환한다", () => {
    expect(sumRatios({ living: 50, saving: 30, emergency: 10, leisure: 10 })).toBe(100);
  });
});

describe("matchPreset", () => {
  it("일치하는 프리셋 id를 반환한다", () => {
    expect(matchPreset({ living: 60, saving: 20, emergency: 10, leisure: 10 })).toBe("living_6211");
  });

  it("일치하는 프리셋이 없으면 custom을 반환한다", () => {
    expect(matchPreset({ living: 45, saving: 35, emergency: 10, leisure: 10 })).toBe("custom");
  });
});
