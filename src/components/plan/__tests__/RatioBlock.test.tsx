import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { RatioBlock } from "@/components/plan/RatioBlock";
import { getRatioRowText, stepRatio, sumRatios } from "@/lib/ratioForm";

mockAll();

describe("ratioForm", () => {
  it("sumRatios / stepRatio: 합계와 0–100 클램프", () => {
    expect(sumRatios([50, 30, 10, 10])).toBe(100);
    expect(stepRatio(98, 5)).toBe(100);
    expect(stepRatio(3, -5)).toBe(0);
    expect(stepRatio(30, 5)).toBe(35);
  });

  it("getRatioRowText: 합과 무관하게 각자 floor(잔액 흡수 없음), 잔액 없으면 '-원'", () => {
    expect(getRatioRowText("living", [50, 30, 10, 10], 1000001)).toBe("생활비 50% · 500,000원");
    expect(getRatioRowText("saving", [50, 35, 10, 10], 2400000)).toBe("저축 35% · 840,000원");
    expect(getRatioRowText("living", [100, 30, 10, 10], 2400000)).toBe("생활비 100% · 2,400,000원");
    expect(getRatioRowText("saving", [50, 30, 10, 10], null)).toBe("저축 30% · -원");
    expect(getRatioRowText("saving", [50, 30, 10, 10], 0)).toBe("저축 30% · -원");
  });
});

describe("RatioBlock 햅틱", () => {
  it("칩과 −/+ 탭에 tickWeak 햅틱이 울린다", () => {
    const onChange = vi.fn();
    render(<RatioBlock ratios={[50, 30, 10, 10]} presetId="p532" available={2400000} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "저축 집중 4:4:1:1" }));
    expect(generateHapticFeedback).toHaveBeenLastCalledWith({ type: "tickWeak" });

    fireEvent.click(screen.getByRole("button", { name: "저축 5% 늘리기" }));
    expect(generateHapticFeedback).toHaveBeenCalledTimes(2);
    expect(generateHapticFeedback).toHaveBeenLastCalledWith({ type: "tickWeak" });
  });
});
