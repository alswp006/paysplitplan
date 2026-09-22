import { describe, it, expect } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";

import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { validateSetup } from "@/lib/validation";

mockAll();

import Setup from "@/pages/Setup";

function renderSetup() {
  return renderWithRouter(React.createElement(Setup));
}

/** Setup 화면의 고정비 목록에 항목 하나를 추가한다(FixedCostSheet를 열고 채우고 제출). */
function addFixedCost(name: string, amount: string) {
  fireEvent.click(screen.getByRole("button", { name: /고정비 추가/ }));
  const textboxes = screen.getAllByRole("textbox");
  const sheetNameInput = textboxes[textboxes.length - 2];
  const sheetAmountInput = textboxes[textboxes.length - 1];
  fireEvent.change(sheetNameInput, { target: { value: name } });
  fireEvent.change(sheetAmountInput, { target: { value: amount } });
  fireEvent.click(screen.getByRole("button", { name: "추가" }));
}

describe("Setup 화면 (/setup) 월급·고정비 입력", () => {
  describe("AC-1[P0]: 유효한 입력 후 '다음' 탭 — /ratio로 draft와 함께 이동", () => {
    it("AC-1a: should navigate to /ratio with the entered salary, payday, and 3 fixed costs", () => {
      renderSetup();

      const [salaryInput, paydayInput] = screen.getAllByRole("textbox");
      fireEvent.change(salaryInput, { target: { value: "3000000" } });
      fireEvent.change(paydayInput, { target: { value: "25" } });

      addFixedCost("월세", "500000");
      addFixedCost("통신비", "50000");
      addFixedCost("보험", "150000");

      fireEvent.click(screen.getByRole("button", { name: "다음" }));

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      const [path, options] = mockNavigate.mock.calls[0];
      expect(path).toBe("/ratio");

      const draft = options.state.draft;
      expect(draft.salary).toBe(3000000);
      expect(draft.payday).toBe(25);
      expect(draft.fixedCosts).toHaveLength(3);
    });

    it("AC-1b: should include the exact fixed cost names and amounts in the draft", () => {
      renderSetup();

      const [salaryInput, paydayInput] = screen.getAllByRole("textbox");
      fireEvent.change(salaryInput, { target: { value: "3000000" } });
      fireEvent.change(paydayInput, { target: { value: "25" } });

      addFixedCost("월세", "500000");
      addFixedCost("통신비", "50000");
      addFixedCost("보험", "150000");

      fireEvent.click(screen.getByRole("button", { name: "다음" }));

      const draft = mockNavigate.mock.calls[0][1].state.draft;
      expect(draft.fixedCosts[0]).toMatchObject({ name: "월세", amount: 500000 });
      expect(draft.fixedCosts[1]).toMatchObject({ name: "통신비", amount: 50000 });
      expect(draft.fixedCosts[2]).toMatchObject({ name: "보험", amount: 150000 });
    });
  });

  describe("AC-2: 월급·고정비 입력 시 '쪼갤 수 있는 돈'이 실시간으로 표시된다", () => {
    it("AC-2a: should show 쪼갤 수 있는 돈 2,300,000원 for salary 3,000,000 and fixed costs totaling 700,000", () => {
      renderSetup();

      const [salaryInput] = screen.getAllByRole("textbox");
      fireEvent.change(salaryInput, { target: { value: "3000000" } });

      addFixedCost("월세", "500000");
      addFixedCost("통신비", "50000");
      addFixedCost("보험", "150000");

      const preview = screen.getByTestId("remaining-preview");
      expect(preview).toHaveTextContent("쪼갤 수 있는 돈");
      expect(preview).toHaveTextContent("2,300,000");
    });
  });

  describe("AC-3[P0]: 월급이 너무 작으면 '다음'이 막히고 에러가 보인다", () => {
    it("AC-3a: should not navigate and should show the salary field error for salary 50,000", () => {
      renderSetup();

      const [salaryInput] = screen.getAllByRole("textbox");
      fireEvent.change(salaryInput, { target: { value: "50000" } });

      fireEvent.click(screen.getByRole("button", { name: "다음" }));

      expect(mockNavigate).not.toHaveBeenCalled();

      const expectedError = validateSetup({ salary: 50000, payday: 25, fixedCosts: [] }).salary;
      expect(screen.getByRole("alert")).toHaveTextContent(expectedError as string);
    });

    it("AC-3b: should show the fixed-empty placeholder when there are 0 fixed costs", () => {
      renderSetup();

      expect(screen.getByTestId("fixed-empty")).toBeInTheDocument();
    });
  });
});
