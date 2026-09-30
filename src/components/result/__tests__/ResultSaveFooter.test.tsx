import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockRouter, mockDialog } from "@/__tests__/__helpers__/mocks";
import { PLAN_KEY, RECORDS_KEY, loadRecords } from "@/lib/storage";
import { ResultSaveFooter } from "@/components/result/ResultSaveFooter";
import type { PlanDraft } from "@/lib/types";

mockTds();
mockAppsInToss();
mockRouter();

const draft: PlanDraft = {
  salary: 3_000_000,
  fixedCosts: [],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
};

function renderFooter(initiallySaved: boolean) {
  return render(
    <MemoryRouter>
      <ResultSaveFooter draft={draft} initiallySaved={initiallySaved} />
    </MemoryRouter>,
  );
}

describe("ResultSaveFooter 레이아웃", () => {
  it("Layout: 1차 CTA 버튼이 하나이고 버튼이 중첩되지 않는다", () => {
    const { container } = renderFooter(false);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(container.querySelector("button button")).toBeNull();
  });

  it("저장 전 라벨은 '이 계획 저장하기', 저장돼 있으면 '홈에서 이체 체크하기'다", () => {
    const { unmount } = renderFooter(false);
    expect(screen.getByRole("button", { name: "이 계획 저장하기" })).toBeTruthy();
    unmount();
    renderFooter(true);
    expect(screen.getByRole("button", { name: "홈에서 이체 체크하기" })).toBeTruthy();
  });
});

describe("덮어쓰기 안내 — 금액이 바뀌어 풀리는 체크를 저장 전에 말한다 (review 0930 MAJOR 1)", () => {
  it("풀리는 통장이 없으면 기본 문장, 있으면 통장 이름과 다음 행동을 덧붙인다", async () => {
    const { overwriteDescription } = await import("@/components/result/ResultSaveFooter");
    expect(overwriteDescription([])).toBe("지난 기록은 그대로 두고, 이번 달 체크는 새 금액 기준으로 다시 계산해요.");
    expect(overwriteDescription(["saving", "emergency"])).toBe(
      "지난 기록은 그대로 두고, 이번 달 체크는 새 금액 기준으로 다시 계산해요. 저축·비상금 통장은 금액이 바뀌어 체크가 풀려요. 새 금액을 옮긴 뒤 다시 체크해 주세요.",
    );
  });
});

describe("덮어쓰기 흐름 — 월급을 올려 저장하면 다이얼로그가 미리 알리고, 저장 뒤 비상금 체크가 풀린다", () => {
  it("9월 비상금 체크(240,000원) 뒤 월급 5,000,000원으로 바꿔 저장", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 29, 9));
    const TS = "2026-09-01T00:00:00.000Z";
    localStorage.setItem(
      PLAN_KEY,
      JSON.stringify({
        version: 1, id: "plan_a", salary: 3_000_000,
        fixedCosts: [{ id: "fc_rent", name: "월세", amount: 600_000, createdAt: TS, updatedAt: TS }],
        presetId: "p532", ratios: [50, 30, 10, 10], payday: 25, createdAt: TS, updatedAt: TS,
      }),
    );
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({
        version: 1,
        records: {
          "2026-09": {
            id: "rec_sept", planId: "plan_a", month: "2026-09",
            checked: { living: false, saving: false, emergency: true, leisure: false },
            eligible: ["living", "saving", "emergency", "leisure"], rate: 25, completedAt: null,
            snapshot: {
              salary: 3_000_000, fixedTotal: 600_000, available: 2_400_000, ratios: [50, 30, 10, 10],
              amounts: { living: 1_200_000, saving: 720_000, emergency: 240_000, leisure: 240_000 },
            },
            createdAt: TS, updatedAt: TS,
          },
        },
      }),
    );
    const raised: PlanDraft = {
      salary: 5_000_000,
      fixedCosts: [{ id: "fc_rent", name: "월세", amount: 600_000, createdAt: TS, updatedAt: TS }],
      presetId: "p532",
      ratios: [50, 30, 10, 10],
      payday: 25,
    };
    render(
      <MemoryRouter>
        <ResultSaveFooter draft={raised} initiallySaved={false} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "이 계획 저장하기" }));
    await waitFor(() => expect(mockDialog.openConfirm).toHaveBeenCalled());
    const confirmArg = mockDialog.openConfirm.mock.calls[0][0] as { description?: string };
    expect(confirmArg.description).toContain("비상금 통장은 금액이 바뀌어 체크가 풀려요");
    await waitFor(() => expect(loadRecords().records["2026-09"].checked.emergency).toBe(false));
    expect(loadRecords().records["2026-09"].snapshot.amounts.emergency).toBe(440_000);
  });
});
