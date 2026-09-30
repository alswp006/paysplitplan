import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { mockAll, mockLogClick, mockOpenToast } from "@/__tests__/__helpers__/mocks";
import type { PlanDraft } from "@/lib/types";

// TDS·SDK·analytics 목. analytics는 doMock이라 컴포넌트를 목 등록 **뒤에** 불러온다.
mockAll();

const { setClipboardText } = await import("@apps-in-toss/web-framework");
const { SetupSheetSection } = await import("@/components/result/SetupSheetSection");
const { loadSetupState } = await import("@/lib/setupState");

const sdkCopy = vi.mocked(setClipboardText);
const TS = "2026-09-01T00:00:00.000Z";

// 시드 A — 1,200,000 / 720,000 / 240,000 / 240,000, 월급날 25 → 매달 26일
const SEED_A: PlanDraft = {
  salary: 3_000_000,
  fixedCosts: [{ id: "fc_rent", name: "월세", amount: 600_000, createdAt: TS, updatedAt: TS }],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
};

function renderSheet(draft: PlanDraft = SEED_A) {
  return render(React.createElement(SetupSheetSection, { draft }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 29, 9));
});

describe("은행 세팅표 (결과 화면 무료 층)", () => {
  it("시드 A: 통장 행 4개가 생활비·저축·비상금·여가 순이고, 행마다 금액과 '…금액 복사' 버튼이 있다", () => {
    renderSheet();
    const sheet = screen.getByTestId("setup-sheet");
    expect(sheet.textContent).toContain("은행 앱에 옮길 세팅표");
    expect(sheet.textContent).toContain("이체는 매달 26일");

    const rows = within(sheet).getAllByTestId("allocation-card");
    const expected: Array<[string, string]> = [
      ["생활비 통장", "1,200,000원"],
      ["저축 통장", "720,000원"],
      ["비상금 통장", "240,000원"],
      ["여가 통장", "240,000원"],
    ];
    expect(rows).toHaveLength(4);
    expected.forEach(([label, amount], i) => {
      expect(rows[i].textContent).toContain(label);
      expect(within(rows[i]).getByText(amount)).toBeInTheDocument();
      expect(within(rows[i]).getByRole("button", { name: `${label} 금액 복사` })).toBeInTheDocument();
    });
    expect(rows[1].textContent).toContain("나눌 돈의 30%");
    // 이체일은 행마다 반복하지 않고 캡션 한 곳에만 있다
    expect(within(sheet).getAllByText(/매달 26일/)).toHaveLength(1);
    // 금액 텍스트는 세팅표 안에서 한 번씩만(무료 층 유일성 — 결과 화면 테스트가 잰다)
    expect(within(sheet).getAllByText("240,000원")).toHaveLength(2);
    expect(within(sheet).getAllByText("1,200,000원")).toHaveLength(1);
  });

  it("저축 복사를 누르면 setClipboardText('720000') · 토스트 '저축 통장 720,000원을 복사했어요' · setup_copy_row 로그", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "저축 통장 금액 복사" }));

    await waitFor(() =>
      expect(mockOpenToast).toHaveBeenCalledWith("저축 통장 720,000원을 복사했어요", { higherThanCTA: true }),
    );
    expect(sdkCopy).toHaveBeenCalledWith("720000");
    expect(mockLogClick).toHaveBeenCalledWith("setup_copy_row");
    expect(loadSetupState()?.copiedKeys).toEqual(["saving"]);
  });

  it("'세팅표 전체 복사'는 5줄 문자열을 복사하고 모든 통장을 복사한 것으로 기록한다", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "세팅표 전체 복사" }));

    await waitFor(() => expect(mockOpenToast).toHaveBeenCalledWith("세팅표를 복사했어요", { higherThanCTA: true }));
    expect(sdkCopy).toHaveBeenCalledWith(
      "월급쪼개기 세팅표 · 매달 26일 이체\n생활비 통장 1,200,000원\n저축 통장 720,000원\n비상금 통장 240,000원\n여가 통장 240,000원",
    );
    expect(mockLogClick).toHaveBeenCalledWith("setup_copy_all");
    expect(loadSetupState()?.copiedKeys).toEqual(["living", "saving", "emergency", "leisure"]);
  });

  it("권한이 거부되면 원인과 다음 행동을 말하는 토스트를 띄우고 복사 기록을 남기지 않는다", async () => {
    const denied = new Error("클립보드 쓰기 권한이 거부되었어요.");
    denied.name = "setClipboardText permission error";
    sdkCopy.mockRejectedValueOnce(denied);
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "비상금 통장 금액 복사" }));

    await waitFor(() =>
      expect(mockOpenToast).toHaveBeenCalledWith(
        "클립보드 권한이 없어 복사하지 못했어요. 금액을 길게 눌러 복사해 주세요",
        { higherThanCTA: true },
      ),
    );
    expect(loadSetupState()).toBeNull();
  });

  it("복사할 수단이 전혀 없으면 실패 토스트 — 던지지 않는다", async () => {
    sdkCopy.mockRejectedValueOnce(new Error("no bridge"));
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "여가 통장 금액 복사" }));
    await waitFor(() =>
      expect(mockOpenToast).toHaveBeenCalledWith("복사하지 못했어요. 금액을 길게 눌러 복사해 주세요", { higherThanCTA: true }),
    );
  });

  it("여가 0%면 여가 행이 없다(금액이 0원인 통장은 세팅할 것이 없다)", () => {
    renderSheet({ ...SEED_A, ratios: [60, 30, 10, 0] });
    const rows = screen.getAllByTestId("allocation-card");
    expect(rows).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "여가 통장 금액 복사" })).toBeNull();
  });
});
