import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();

// 라우트 → 화면 매핑만 본다. 화면 본문은 각자의 패킷 테스트가 검증한다.
vi.mock("@/pages/Home", () => ({ default: () => <div data-testid="page-home" /> }));
vi.mock("@/pages/Plan", () => ({ default: () => <div data-testid="page-plan" /> }));
vi.mock("@/pages/Result", () => ({ default: () => <div data-testid="page-result" /> }));
vi.mock("@/pages/History", () => ({ default: () => <div data-testid="page-history" /> }));

// mocks.ts가 등록한 react-router-dom 목을 원본으로 되돌린다(실제 매칭을 검증해야 한다).
vi.doMock("react-router-dom", async () => await vi.importActual("react-router-dom"));

const { MemoryRouter } = await import("react-router-dom");
const { default: App } = await import("@/App");

const PAGE_IDS = ["page-home", "page-plan", "page-result", "page-history", "not-found"];

function renderAt(entry: string | { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
    </MemoryRouter>,
  );
}

/** 지정한 화면 하나만 그려졌는지 확인한다. */
function expectOnly(testId: string) {
  expect(screen.getAllByTestId(testId)).toHaveLength(1);
  for (const id of PAGE_IDS.filter((x) => x !== testId)) {
    expect(screen.queryByTestId(id)).toBeNull();
  }
}

describe("App routes", () => {
  it.each([
    ["/", "page-home"],
    ["/plan", "page-plan"],
    ["/result", "page-result"],
    ["/history", "page-history"],
  ])("%s는 해당 화면 하나만 렌더한다", (path, testId) => {
    renderAt(path);
    expectOnly(testId);
  });

  it("/result는 navigate state가 있어도 Result를 렌더한다", () => {
    renderAt({
      pathname: "/result",
      state: {
        draft: { salary: 3200000, fixedCosts: [], presetId: "basic", ratios: [50, 30, 10, 10], payday: 25 },
      },
    });
    expectOnly("page-result");
  });

  it.each(["/result/1", "/home", "/plans"])("%s는 없는 경로라 not-found를 렌더한다", (path) => {
    renderAt(path);
    expectOnly("not-found");
    expect(screen.getByRole("button", { name: "홈으로 가기" })).toBeInTheDocument();
  });
});
