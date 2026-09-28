import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { FixedCostSheet } from "@/components/plan/FixedCostSheet";
import { validateFixedCostInput } from "@/lib/fixedCostForm";

mockAll();

function setup(open = true) {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  const utils = render(<FixedCostSheet open={open} onClose={onClose} onAdd={onAdd} />);
  return { onAdd, onClose, ...utils };
}

function fill(name: string, amount: string) {
  fireEvent.change(screen.getByLabelText(/이름/), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/금액/), { target: { value: amount } });
}

describe("validateFixedCostInput", () => {
  it("이름은 trim 후 1–20자, 금액은 결과별 문구", () => {
    expect(validateFixedCostInput("", "50000").nameError).toBe("항목 이름을 입력해주세요");
    expect(validateFixedCostInput("가".repeat(21), "50000").nameError).toBe("항목 이름은 20자 이내로 입력해주세요");
    expect(validateFixedCostInput("가".repeat(20), "50000").valid).toBe(true);
    expect(validateFixedCostInput("보험", "").amountError).toBe("금액을 입력해주세요");
    expect(validateFixedCostInput("보험", "1.5").amountError).toBe("원 단위로 입력해주세요");
    expect(validateFixedCostInput(" 월세 ", "500,000")).toMatchObject({ name: "월세", amount: 500000, valid: true });
  });
});

describe("FixedCostSheet", () => {
  it("유효하지 않으면 필드 에러만 보이고 onAdd·onClose는 부르지 않으며 햅틱도 없다", () => {
    const { onAdd, onClose } = setup();
    fill("", "50000");
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByText("항목 이름을 입력해주세요")).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(generateHapticFeedback).not.toHaveBeenCalled();
  });

  it("추가 확정 시 success 햅틱과 함께 onAdd 1회", () => {
    const { onAdd } = setup();
    fill(" 월세 ", "500,000");
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ name: "월세", amount: 500000 });
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
  });

  it("시트가 닫히면 입력을 초기화한다", () => {
    const { rerender } = setup();
    fill("월세", "500000");
    rerender(<FixedCostSheet open={false} onClose={vi.fn()} onAdd={vi.fn()} />);
    rerender(<FixedCostSheet open onClose={vi.fn()} onAdd={vi.fn()} />);
    expect((screen.getByLabelText(/이름/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/금액/) as HTMLInputElement).value).toBe("");
  });
});
