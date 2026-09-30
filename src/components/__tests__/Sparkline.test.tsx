import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sparkline } from "@/components/Sparkline";

const ys = () => screen.getAllByTestId("s-point").map((c) => Number(c.getAttribute("cy")));

describe("Sparkline domain (review 0930 D-3)", () => {
  it("domain [0,100]이면 전부 100%인 달은 맨 위에, 기록 없는 달만 바닥에 그린다", () => {
    render(<Sparkline testId="s" data={[null, 100, 100, 100]} height={64} domain={[0, 100]} />);
    expect(ys()).toEqual([64, 0, 0, 0]);
  });

  it("domain [0,100]이면 25%는 바닥(0%)이 아니라 3/4 높이 아래에 선다", () => {
    render(<Sparkline testId="s" data={[25, 100]} height={64} domain={[0, 100]} />);
    expect(ys()).toEqual([48, 0]);
  });

  it("domain이 없으면 템플릿 기본(자기 최솟값~최댓값)을 그대로 쓴다", () => {
    render(<Sparkline testId="s" data={[25, 100]} height={64} />);
    expect(ys()).toEqual([64, 0]);
  });
});
