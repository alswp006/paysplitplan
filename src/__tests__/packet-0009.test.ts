import { describe, it, expect, vi } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";

import { mockTds } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { validateFixedCost } from "@/lib/validation";

mockTds();

import FixedCostSheet from "@/components/FixedCostSheet";

function renderSheet(overrides: Partial<{ open: boolean }> = {}) {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  renderWithRouter(
    React.createElement(FixedCostSheet, {
      open: true,
      onClose,
      onAdd,
      ...overrides,
    }),
  );
  return { onAdd, onClose };
}

describe("Packet 0009: 고정비 추가 BottomSheet 컴포넌트", () => {
  describe("AC-1[P0]: 이름·금액 입력 후 추가 탭 — onAdd 호출", () => {
    it("AC-1a: should call onAdd once with {name:'월세', amount:500000, id: string}", () => {
      const { onAdd } = renderSheet();

      const [nameInput, amountInput] = screen.getAllByRole("textbox");
      fireEvent.change(nameInput, { target: { value: "월세" } });
      fireEvent.change(amountInput, { target: { value: "500,000" } });

      fireEvent.click(screen.getByRole("button", { name: /추가/ }));

      expect(onAdd).toHaveBeenCalledTimes(1);
      const arg = onAdd.mock.calls[0][0];
      expect(arg.name).toBe("월세");
      expect(arg.amount).toBe(500000);
      expect(typeof arg.id).toBe("string");
      expect(arg.id.length).toBeGreaterThan(0);
    });

    it("AC-1b: should close the sheet after a successful add", () => {
      const { onClose } = renderSheet();

      const [nameInput, amountInput] = screen.getAllByRole("textbox");
      fireEvent.change(nameInput, { target: { value: "식비" } });
      fireEvent.change(amountInput, { target: { value: "300000" } });
      fireEvent.click(screen.getByRole("button", { name: /추가/ }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("AC-2[P0]: 이름을 비우고 추가 탭 — onAdd 미호출 + 에러 표시", () => {
    it("AC-2a: should not call onAdd and should show name field error", () => {
      const { onAdd } = renderSheet();

      const [, amountInput] = screen.getAllByRole("textbox");
      fireEvent.change(amountInput, { target: { value: "500000" } });
      fireEvent.click(screen.getByRole("button", { name: /추가/ }));

      expect(onAdd).not.toHaveBeenCalled();

      const expectedError = validateFixedCost("", 500000).name;
      expect(screen.getByRole("alert")).toHaveTextContent(expectedError as string);
    });

    it("AC-2b: should not close the sheet when validation fails", () => {
      const { onClose, onAdd } = renderSheet();

      const [, amountInput] = screen.getAllByRole("textbox");
      fireEvent.change(amountInput, { target: { value: "500000" } });
      fireEvent.click(screen.getByRole("button", { name: /추가/ }));

      expect(onAdd).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("AC-3[P0]: 금액 필드에서 Enter — 추가 탭과 동일 동작", () => {
    it("AC-3a: should call onAdd with the same result as clicking 추가", () => {
      const { onAdd } = renderSheet();

      const [nameInput, amountInput] = screen.getAllByRole("textbox");
      fireEvent.change(nameInput, { target: { value: "보험료" } });
      fireEvent.change(amountInput, { target: { value: "120000" } });

      fireEvent.keyDown(amountInput, { key: "Enter", code: "Enter" });

      expect(onAdd).toHaveBeenCalledTimes(1);
      const arg = onAdd.mock.calls[0][0];
      expect(arg.name).toBe("보험료");
      expect(arg.amount).toBe(120000);
    });

    it("AC-3b: should not call onAdd for non-Enter keys", () => {
      const { onAdd } = renderSheet();

      const [nameInput, amountInput] = screen.getAllByRole("textbox");
      fireEvent.change(nameInput, { target: { value: "보험료" } });
      fireEvent.change(amountInput, { target: { value: "120000" } });

      fireEvent.keyDown(amountInput, { key: "a", code: "KeyA" });

      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  describe("렌더링", () => {
    it("should render nothing meaningful (no crash) when open is false", () => {
      expect(() => renderSheet({ open: false })).not.toThrow();
      expect(screen.queryByRole("button", { name: /추가/ })).not.toBeInTheDocument();
    });
  });
});
