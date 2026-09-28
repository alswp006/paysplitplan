import { describe, it, expect } from "vitest";
import { calculateDistribution } from "@/lib/plan";

const R532 = [
  { categoryId: "living", percent: 50 },
  { categoryId: "saving", percent: 30 },
  { categoryId: "emergency", percent: 10 },
  { categoryId: "leisure", percent: 10 },
];

describe("calculateDistribution", () => {
  it("월급에서 고정비를 뺀 금액을 비율대로 나눈다", () => {
    expect(calculateDistribution(3000000, 600000, R532)).toEqual([
      { categoryId: "living", allocated: 1200000 },
      { categoryId: "saving", allocated: 720000 },
      { categoryId: "emergency", allocated: 240000 },
      { categoryId: "leisure", allocated: 240000 },
    ]);
  });

  it("내림하고 남은 잔액은 생활비가 흡수해 합계가 가용 금액과 같다", () => {
    const result = calculateDistribution(1234567, 0, R532);
    expect(result.map((r) => r.allocated)).toEqual([617285, 370370, 123456, 123456]);
    expect(result.reduce((s, r) => s + r.allocated, 0)).toBe(1234567);
  });

  it("가용 금액이 0 이하이면 모두 0이다", () => {
    for (const [income, fixed] of [[500000, 500000], [500000, 900000]]) {
      expect(calculateDistribution(income, fixed, R532).every((r) => r.allocated === 0)).toBe(true);
    }
  });

  it("living이 없으면 첫 항목이 잔액을 흡수하고, 비율 합이 100이 아니면 내림만 한다", () => {
    const two = calculateDistribution(101, 0, [
      { categoryId: "a", percent: 50 },
      { categoryId: "b", percent: 50 },
    ]);
    expect(two).toEqual([
      { categoryId: "a", allocated: 51 },
      { categoryId: "b", allocated: 50 },
    ]);
    const over = calculateDistribution(1000, 0, [
      { categoryId: "a", percent: 60 },
      { categoryId: "b", percent: 50 },
    ]);
    expect(over.map((r) => r.allocated)).toEqual([600, 500]);
  });

  it("빈 비율 목록이나 NaN 입력에도 던지지 않는다", () => {
    expect(calculateDistribution(1000, 0, [])).toEqual([]);
    expect(calculateDistribution(NaN, 0, R532).every((r) => r.allocated === 0)).toBe(true);
  });
});
