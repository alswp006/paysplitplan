import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import * as fixedCostForm from "@/lib/fixedCostForm";
import { FixedCostSheet } from "@/components/plan/FixedCostSheet";
import type { FixedCost } from "@/lib/types";

mockAll();

// FixedCostSheet 계약:
//   <FixedCostSheet open={boolean} onClose={() => void} onAdd={(fc: FixedCost) => void} />
// - 이름 TextField(라벨에 "이름")와 금액 TextField(라벨에 "금액")가 있고, 하단 Button "추가"가 있다.
// - 검증 실패 시 에러 문구는 해당 필드(TextField help)에만 보이고, onAdd는 부르지 않으며 시트는 열려 있다.
// - 유효하면 createId()/nowIso()로 만든 FixedCost로 onAdd를 1회 호출한다.
const FIXED_NOW = "2026-09-29T01:00:00.000Z";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(FIXED_NOW));
});

function renderSheet() {
  const onAdd = vi.fn<(fc: FixedCost) => void>();
  const onClose = vi.fn();
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(FixedCostSheet, { open: true, onClose, onAdd }),
    ),
  );
  return { onAdd, onClose };
}

const nameInput = () => screen.getByLabelText(/이름/) as HTMLInputElement;
const amountInput = () => screen.getByLabelText(/금액/) as HTMLInputElement;

function fill(name: string, amount: string) {
  fireEvent.change(nameInput(), { target: { value: name } });
  fireEvent.change(amountInput(), { target: { value: amount } });
}

function tapAdd() {
  fireEvent.click(screen.getByRole("button", { name: "추가" }));
}

/** 에러 문구가 해당 입력 칸의 컨테이너 안에 있고, 다른 칸에는 없어야 한다 */
function expectFieldError(field: "name" | "amount", message: string) {
  const own = field === "name" ? nameInput() : amountInput();
  const other = field === "name" ? amountInput() : nameInput();
  expect(within(own.parentElement as HTMLElement).getByText(message)).toBeTruthy();
  expect(within(other.parentElement as HTMLElement).queryByText(message)).toBeNull();
}

describe("고정비 추가 BottomSheet (FixedCostSheet)", () => {
  it("validateFixedCostInput이 src/lib/fixedCostForm.ts에서 함수로 export된다", () => {
    expect(typeof fixedCostForm.validateFixedCostInput).toBe("function");
    expect(Object.keys(fixedCostForm)).toContain("validateFixedCostInput");
  });

  it("AC-1[P0]: 이름이 비어 있으면 이름 필드에 '항목 이름을 입력해주세요', onAdd 0회, 시트는 열려 있다", () => {
    const { onAdd, onClose } = renderSheet();

    fill("", "50000");
    tapAdd();

    expectFieldError("name", "항목 이름을 입력해주세요");
    expect(onAdd).toHaveBeenCalledTimes(0);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("AC-1[P0]: 이름이 21자면 '항목 이름은 20자 이내로 입력해주세요', 20자면 통과한다", () => {
    const { onAdd } = renderSheet();

    fill("가".repeat(21), "50000");
    tapAdd();
    expectFieldError("name", "항목 이름은 20자 이내로 입력해주세요");
    expect(onAdd).toHaveBeenCalledTimes(0);

    // 경계: 20자는 유효
    fill("가".repeat(20), "50000");
    tapAdd();
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].name).toBe("가".repeat(20));
  });

  it("AC-2[P0]: 금액 '0'·'100000001'·'abc'·'-50000'마다 금액 필드에 정해진 문구가 보이고 onAdd는 0회다", () => {
    const { onAdd } = renderSheet();
    const cases: Array<[string, string]> = [
      ["0", "금액을 입력해주세요"],
      ["100000001", "1억 원 이하로 입력해주세요"],
      ["abc", "숫자만 입력해주세요"],
      ["-50000", "0보다 큰 금액을 입력해주세요"],
    ];

    for (const [raw, message] of cases) {
      fill("보험", raw);
      tapAdd();
      expectFieldError("amount", message);
      expect(within(nameInput().parentElement as HTMLElement).queryByRole("alert")).toBeNull();
    }
    expect(onAdd).toHaveBeenCalledTimes(0);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("AC-2[P1]: 금액 상한 경계 — 100,000,000은 유효하다", () => {
    const { onAdd } = renderSheet();

    fill("보증금 이자", "100,000,000");
    tapAdd();

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].amount).toBe(100000000);
    expect(onAdd.mock.calls[0][0].name).toBe("보증금 이자");
  });

  it("AC-3[P0]: 이름 ' 월세 ', 금액 '500,000'으로 '추가'를 탭하면 onAdd가 1회, name '월세'·amount 500000·id 비어 있지 않음·createdAt===updatedAt", () => {
    const { onAdd } = renderSheet();

    fill(" 월세 ", "500,000");
    tapAdd();

    expect(onAdd).toHaveBeenCalledTimes(1);
    const fc = onAdd.mock.calls[0][0];
    expect(fc.name).toBe("월세");
    expect(fc.amount).toBe(500000);
    expect(typeof fc.id).toBe("string");
    expect(fc.id).not.toBe("");
    expect(fc.createdAt).toBe(FIXED_NOW);
    expect(fc.updatedAt).toBe(fc.createdAt);
    expect(Object.keys(fc).sort()).toEqual(["amount", "createdAt", "id", "name", "updatedAt"]);
  });

  it("AC-3[P0]: 같은 값을 두 번 추가하면 id가 서로 다르다(시계가 고정돼도)", () => {
    const { onAdd } = renderSheet();

    fill("월세", "500000");
    tapAdd();
    fill("월세", "500000");
    tapAdd();

    expect(onAdd).toHaveBeenCalledTimes(2);
    const [first, second] = [onAdd.mock.calls[0][0], onAdd.mock.calls[1][0]];
    expect(first.id).not.toBe("");
    expect(second.id).not.toBe("");
    expect(first.id).not.toBe(second.id);
  });
});
