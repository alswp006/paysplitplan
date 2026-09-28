import { describe, it, expect, vi } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { sumRatios } from "@/lib/ratioForm";
import { RatioBlock } from "@/components/plan/RatioBlock";
import type { Ratios } from "@/lib/types";

mockAll();

// RatioBlock 계약(제어 컴포넌트, 상태는 props로만):
//   <RatioBlock ratios={Ratios} presetId={string} available={number | null}
//               onChange={(ratios: Ratios, presetId: string) => void} />
// - ratios는 [생활비, 저축, 비상금, 여가] 순서의 튜플이다(types.ts Ratios).
// - 카테고리 행은 DOM 순서가 생활비 → 저축 → 비상금 → 여가다.
// - 행마다 −/+ Button이 있고, 버튼 글자(또는 aria-label)가 "+" / "-"(또는 "−")다.
// - 행 텍스트는 "{라벨} {n}% · {금액}원" — 라벨과 나머지가 한 요소에 있든 이웃 요소에 있든 상관없다.
const LABELS = ["생활비", "저축", "비상금", "여가"];
const MINUS_SIGNS = ["-", "−", "–", "－"];
const AVAILABLE = 2400000; // 월급 3,000,000 − 고정비 600,000

function renderBlock(props: {
  ratios: Ratios;
  presetId: string;
  available: number | null;
  onChange?: (ratios: Ratios, presetId: string) => void;
}) {
  const onChange = props.onChange ?? vi.fn();
  const ui = (p: typeof props) =>
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(RatioBlock, {
        ratios: p.ratios,
        presetId: p.presetId,
        available: p.available,
        onChange: p.onChange ?? onChange,
      }),
    );
  const utils = render(ui(props));
  return {
    onChange,
    rerender: (next: typeof props) => utils.rerender(ui({ onChange, ...next })),
  };
}

const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** 행 텍스트 요소 4개("50% · 1,200,000원" 꼴)를 DOM 순서대로 */
function rowElements(): HTMLElement[] {
  const rows = screen.getAllByText(/%\s*·\s*/);
  expect(rows).toHaveLength(4);
  return rows;
}

/** i번째 행의 "n% · 금액" 문구 — 앞에 라벨이 같은 요소에 붙어 있으면 라벨은 떼고 비교한다 */
function rowBody(i: number): string {
  const text = norm(rowElements()[i].textContent);
  return text.startsWith(LABELS[i]) ? text.slice(LABELS[i].length).trim() : text;
}

/** i번째 행 요소에서 위로 올라가며(다른 행을 만나기 전까지) 라벨이 나오는지 */
function rowHasLabel(i: number): boolean {
  const rows = rowElements();
  let node: HTMLElement | null = rows[i];
  for (let depth = 0; depth < 5 && node; depth++, node = node.parentElement) {
    if (rows.filter((r) => node!.contains(r)).length > 1) return false;
    if (norm(node.textContent).includes(LABELS[i])) return true;
  }
  return false;
}

function expectRow(i: number, percent: number, amountText: string) {
  expect(rowBody(i)).toBe(`${percent}% · ${amountText}`);
  expect(rowHasLabel(i)).toBe(true);
}

function stepButtons(kind: "plus" | "minus"): HTMLButtonElement[] {
  const label = (b: HTMLElement) => norm(b.textContent) || (b.getAttribute("aria-label") ?? "");
  const found = (screen.getAllByRole("button") as HTMLButtonElement[]).filter((b) =>
    kind === "plus" ? ["+", "＋"].includes(label(b)) : MINUS_SIGNS.includes(label(b)),
  );
  expect(found).toHaveLength(4); // 카테고리마다 하나씩, 생활비 → 여가 순서
  return found;
}

const CATEGORY = { living: 0, saving: 1, emergency: 2, leisure: 3 } as const;

describe("비율 블록 컴포넌트 (RatioBlock)", () => {
  it("sumRatios: 네 비율의 합을 돌려준다", () => {
    expect(sumRatios([50, 30, 10, 10])).toBe(100);
    expect(sumRatios([100, 30, 10, 10])).toBe(150);
    expect(sumRatios([50, 30, 10, 0])).toBe(90);
  });

  it("AC-1[P0]: '4:4:2 저축 집중' 칩 탭 → onChange([40,40,10,10], 'p442') 1회", () => {
    const { onChange } = renderBlock({ ratios: [50, 30, 10, 10], presetId: "p532", available: AVAILABLE });

    // 프리셋 3개 + 직접 조정, 칩 4개
    for (const name of ["5:3:2 기본", "4:4:2 저축 집중", "6:2:2 여유", "직접 조정"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }

    fireEvent.click(screen.getByRole("button", { name: "4:4:2 저축 집중" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([40, 40, 10, 10], "p442");
  });

  it("AC-1[P0]: p442 값과 available 2,400,000으로 렌더하면 '저축 40% · 960,000원'이 보인다", () => {
    renderBlock({ ratios: [40, 40, 10, 10], presetId: "p442", available: AVAILABLE });

    expectRow(CATEGORY.living, 40, "960,000원");
    expectRow(CATEGORY.saving, 40, "960,000원");
    expectRow(CATEGORY.emergency, 10, "240,000원");
    expectRow(CATEGORY.leisure, 10, "240,000원");
    expect(screen.getByRole("button", { name: "4:4:2 저축 집중" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("ratio-sum").textContent).toContain("합계 100%");
  });

  it("AC-2[P0]: p532에서 저축 '+' → onChange 저축 35, 'custom' (다른 값은 그대로)", () => {
    const { onChange } = renderBlock({ ratios: [50, 30, 10, 10], presetId: "p532", available: AVAILABLE });

    fireEvent.click(stepButtons("plus")[CATEGORY.saving]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([50, 35, 10, 10], "custom");

    // 반대 방향도 5%p — 생활비 '−'
    fireEvent.click(stepButtons("minus")[CATEGORY.living]);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith([45, 30, 10, 10], "custom");
  });

  it("AC-2[P0]: 저축 35 · custom으로 렌더하면 '직접 조정' 선택, 합계 105%, 행 금액은 floor(available×r/100)", () => {
    const { rerender } = renderBlock({ ratios: [50, 30, 10, 10], presetId: "p532", available: AVAILABLE });
    expect(screen.getByRole("button", { name: "5:3:2 기본" }).getAttribute("aria-pressed")).toBe("true");

    rerender({ ratios: [50, 35, 10, 10], presetId: "custom", available: AVAILABLE });

    expect(screen.getByRole("button", { name: "직접 조정" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "5:3:2 기본" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("ratio-sum").textContent).toContain("합계 105%");
    expectRow(CATEGORY.living, 50, "1,200,000원");
    expectRow(CATEGORY.saving, 35, "840,000원");
    expectRow(CATEGORY.emergency, 10, "240,000원");
    expectRow(CATEGORY.leisure, 10, "240,000원");
  });

  it("AC-3[P0]: {50,30,10,0}이면 합계 불일치 문구가 보이고 여가 '-'는 disabled, 합 100이면 문구가 없다", () => {
    const { rerender } = renderBlock({ ratios: [50, 30, 10, 0], presetId: "custom", available: AVAILABLE });

    expect(screen.getByText("비율 합계를 100%로 맞춰주세요 (현재 90%)")).toBeTruthy();
    expect(screen.getByTestId("ratio-sum").textContent).toContain("합계 90%");
    const minus = stepButtons("minus");
    expect(minus[CATEGORY.leisure].disabled).toBe(true);
    expect(minus[CATEGORY.living].disabled).toBe(false);

    // 합계가 100으로 돌아오면 에러 문구는 사라지고 여가 '+'는 누를 수 있다
    rerender({ ratios: [50, 30, 10, 10], presetId: "p532", available: AVAILABLE });
    expect(screen.queryByText(/비율 합계를 100%로 맞춰주세요/)).toBeNull();
    expect(screen.getByTestId("ratio-sum").textContent).toContain("합계 100%");
    expect(stepButtons("minus")[CATEGORY.leisure].disabled).toBe(false);
  });

  it("AC-3[P1]: 생활비 100이면 생활비 '+'는 disabled, 0과 100 밖으로 나가지 않는다", () => {
    const first = renderBlock({ ratios: [100, 0, 0, 0], presetId: "custom", available: AVAILABLE });
    const plus = stepButtons("plus");
    expect(plus[CATEGORY.living].disabled).toBe(true);
    fireEvent.click(plus[CATEGORY.living]);
    expect(first.onChange).not.toHaveBeenCalled();
    // 0인 카테고리의 '-'도 막혀 있다
    expect(stepButtons("minus")[CATEGORY.saving].disabled).toBe(true);
    fireEvent.click(stepButtons("minus")[CATEGORY.saving]);
    expect(first.onChange).not.toHaveBeenCalled();
  });

  it("AC-3[P1]: 5로 나누어떨어지지 않는 값은 0·100으로 클램프된다 (98 + → 100, 3 − → 0)", () => {
    const { onChange } = renderBlock({ ratios: [98, 3, 0, 0], presetId: "custom", available: AVAILABLE });

    fireEvent.click(stepButtons("plus")[CATEGORY.living]);
    expect(onChange).toHaveBeenLastCalledWith([100, 3, 0, 0], "custom");

    fireEvent.click(stepButtons("minus")[CATEGORY.saving]);
    expect(onChange).toHaveBeenLastCalledWith([98, 0, 0, 0], "custom");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("AC-4[P1]: {100,30,10,10}이면 행 금액은 각자 floor 계산, 합계 150%, 음수·'-숫자' 없음", () => {
    renderBlock({ ratios: [100, 30, 10, 10], presetId: "custom", available: AVAILABLE });

    expectRow(CATEGORY.living, 100, "2,400,000원"); // 합≠100이면 생활비가 잔액을 흡수하지 않는다
    expectRow(CATEGORY.saving, 30, "720,000원");
    expectRow(CATEGORY.emergency, 10, "240,000원");
    expectRow(CATEGORY.leisure, 10, "240,000원");
    expect(screen.getByTestId("ratio-sum").textContent).toContain("합계 150%");
    expect(screen.getByText("비율 합계를 100%로 맞춰주세요 (현재 150%)")).toBeTruthy();
    for (const row of rowElements()) {
      expect(row.textContent ?? "").not.toMatch(/-\d/);
    }
    expect(screen.getByTestId("ratio-sum").textContent ?? "").not.toMatch(/-\d/);
  });

  it("AC-4[P1]: available이 null이면 네 행 모두 '· -원', 0 이하여도 똑같이 '-원'", () => {
    const { rerender } = renderBlock({ ratios: [50, 30, 10, 10], presetId: "p532", available: null });

    for (let i = 0; i < 4; i++) {
      expect(rowElements()[i].textContent).toContain("· -원");
    }
    expect(rowBody(CATEGORY.saving)).toBe("30% · -원");

    for (const available of [0, -100000]) {
      rerender({ ratios: [50, 30, 10, 10], presetId: "p532", available });
      for (let i = 0; i < 4; i++) {
        expect(rowBody(i)).toMatch(/^\d+% · -원$/);
      }
    }
  });

  it("AC-5[P1]: presetId='p532'면 '5:3:2 기본' 칩만 선택 상태, 소스에 HEX 색상 하드코딩이 없다", () => {
    renderBlock({ ratios: [50, 30, 10, 10], presetId: "p532", available: AVAILABLE });

    expect(screen.getByRole("button", { name: "5:3:2 기본" }).getAttribute("aria-pressed")).toBe("true");
    for (const name of ["4:4:2 저축 집중", "6:2:2 여유", "직접 조정"]) {
      expect(screen.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("false");
    }

    const source = readFileSync(resolve(process.cwd(), "src/components/plan/RatioBlock.tsx"), "utf8");
    const hexLines = source.split("\n").filter((line) => /#[0-9a-fA-F]{3,8}\b/.test(line));
    expect(hexLines).toEqual([]);
  });
});
