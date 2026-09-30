import { describe, it, expect } from "vitest";
import { allocationSplit, checklistSplit, legendKinds, ratioSplit } from "@/lib/split";

describe("split 모델", () => {
  it("결과 히어로(시드 A) — 고정비 + 통장 4개, 합은 월급, 금액은 aria-label에만", () => {
    const m = allocationSplit(3_000_000, [{ amount: 600_000 }], [50, 30, 10, 10]);
    expect(m.segments.map((s) => [s.key, s.value])).toEqual([
      ["fixed", 600_000],
      ["living", 1_200_000],
      ["saving", 720_000],
      ["emergency", 240_000],
      ["leisure", 240_000],
    ]);
    expect(m.segments.reduce((a, s) => a + s.value, 0)).toBe(3_000_000);
    expect(m.ariaLabel).toBe(
      "월급 3,000,000원 중 고정비 600,000원, 생활비 1,200,000원, 저축 720,000원, 비상금 240,000원, 여가 240,000원",
    );
  });

  it("비율 미리보기 — 접근성 이름은 비율", () => {
    expect(ratioSplit([50, 30, 10, 10]).ariaLabel).toBe("생활비 50%, 저축 30%, 비상금 10%, 여가 10%");
  });

  it("홈 조각 — 옮긴 통장만 채운다", () => {
    const m = checklistSplit([
      { key: "living", amount: 1_200_000, checked: false },
      { key: "saving", amount: 720_000, checked: true },
      { key: "emergency", amount: 240_000, checked: true },
      { key: "leisure", amount: 240_000, checked: false },
    ]);
    expect(m.segments.filter((s) => s.filled).map((s) => s.key)).toEqual(["saving", "emergency"]);
    expect(m.ariaLabel).toBe("이번 달 이체: 생활비 남음, 저축 옮김, 비상금 옮김, 여가 남음");
  });

  it("범례는 0인 조각을 뺀다", () => {
    const m = allocationSplit(3_000_000, [], [60, 30, 10, 0]);
    expect(legendKinds(m.segments)).toEqual(["living", "saving", "emergency"]);
  });
});
