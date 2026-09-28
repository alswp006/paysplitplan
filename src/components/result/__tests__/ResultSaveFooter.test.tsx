import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockRouter } from "@/__tests__/__helpers__/mocks";
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
