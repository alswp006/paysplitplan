import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { mockTds } from "@/__tests__/__helpers__/mocks";
import { CategoryBadge } from "@/components/CategoryBadge";
import { SplitBar, SplitLegend } from "@/components/SplitBar";
import { CATEGORY_COLOR } from "@/lib/theme";

mockTds();

const SEGMENTS = [
  { key: "fixed" as const, value: 600_000 },
  { key: "living" as const, value: 1_200_000 },
  { key: "saving" as const, value: 720_000, filled: true },
  { key: "emergency" as const, value: 240_000, filled: false },
  { key: "leisure" as const, value: 0 },
];

function segs() {
  return screen.getAllByTestId("split-segment");
}

describe("SplitBar", () => {
  it("0인 조각은 그리지 않는다", () => {
    render(<SplitBar segments={SEGMENTS} ariaLabel="막대" />);
    expect(segs().map((s) => s.dataset.key)).toEqual(["fixed", "living", "saving", "emergency"]);
  });

  it("flexGrow가 값과 같고 basis는 0이다", () => {
    render(<SplitBar segments={SEGMENTS} ariaLabel="막대" />);
    expect(segs().map((s) => Number(s.style.flexGrow))).toEqual([600_000, 1_200_000, 720_000, 240_000]);
    for (const s of segs()) expect(s.style.flexBasis).toMatch(/^0/);
  });

  it("filled가 data-filled와 투명도에 반영된다(기본은 채움)", () => {
    render(<SplitBar segments={SEGMENTS} ariaLabel="막대" />);
    expect(segs().map((s) => s.dataset.filled)).toEqual(["true", "true", "true", "false"]);
    expect(segs()[3].style.opacity).toBe("0.28");
    expect(segs()[0].style.opacity).toBe("1");
  });

  it("조각 배경은 통장 색 토큰이다", () => {
    render(<SplitBar segments={SEGMENTS} ariaLabel="막대" />);
    expect(segs().map((s) => s.style.backgroundColor)).toEqual([
      CATEGORY_COLOR.fixed,
      CATEGORY_COLOR.living,
      CATEGORY_COLOR.saving,
      CATEGORY_COLOR.emergency,
    ]);
  });

  it("role=img와 aria-label이 있고, 금액을 화면 텍스트로 내지 않는다", () => {
    render(<SplitBar testId="bar" segments={SEGMENTS} ariaLabel="월급 3,000,000원 중 고정비 600,000원" />);
    const bar = screen.getByRole("img", { name: "월급 3,000,000원 중 고정비 600,000원" });
    expect(bar).toBe(screen.getByTestId("bar"));
    expect(bar.textContent).toBe("");
  });

  it("jsdom(matchMedia 없음)에서는 animate여도 처음부터 최종 상태다", () => {
    render(<SplitBar animate segments={SEGMENTS} ariaLabel="막대" />);
    expect(segs().map((s) => Number(s.style.flexGrow))).toEqual([600_000, 1_200_000, 720_000, 240_000]);
    expect(segs().map((s) => s.style.backgroundColor)).toEqual([
      CATEGORY_COLOR.fixed,
      CATEGORY_COLOR.living,
      CATEGORY_COLOR.saving,
      CATEGORY_COLOR.emergency,
    ]);
  });

  it("첫 조각은 왼쪽, 마지막 조각은 오른쪽 모서리만 둥글다", () => {
    render(<SplitBar height={20} segments={SEGMENTS} ariaLabel="막대" />);
    const [first, , , last] = segs();
    expect(first.style.borderTopLeftRadius).toBe("10px");
    expect(first.style.borderTopRightRadius).toMatch(/^0(px)?$/);
    expect(last.style.borderBottomRightRadius).toBe("10px");
    expect(last.style.borderBottomLeftRadius).toMatch(/^0(px)?$/);
  });
});

describe("SplitLegend · CategoryBadge", () => {
  it("범례는 라벨만 싣는다(금액 없음)", () => {
    render(<SplitLegend testId="legend" kinds={["fixed", "living", "saving"]} />);
    const legend = screen.getByTestId("legend");
    expect(within(legend).getByText("고정비")).toBeTruthy();
    expect(within(legend).getByText("저축")).toBeTruthy();
    expect(legend.textContent).not.toMatch(/원/);
  });

  it("통장 배지는 장식(aria-hidden)이고 통장 색 틴트를 쓴다", () => {
    render(<CategoryBadge kind="saving" />);
    const badge = screen.getByTestId("category-badge");
    expect(badge.getAttribute("aria-hidden")).toBe("true");
    expect(badge.dataset.kind).toBe("saving");
    expect(badge.style.color).toBe(CATEGORY_COLOR.saving);
    expect(badge.querySelector("svg")).not.toBeNull();
  });
});
