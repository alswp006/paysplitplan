import { describe, it, expect, vi } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();

// ── 계약 (Coder가 이 시그니처대로 만든다) ──
// src/pages/NotFound.tsx  (default export NotFound, props 없음 — 독립 화면)
//   - data-testid="not-found" 영역 안에: 아이콘(번들 lucide SearchX — 2026-09-30 static.toss.im 의존 Asset.ContentIcon에서 교체),
//     제목 '페이지를 찾을 수 없어요',
//     보조 문구 '주소가 바뀌었거나 없는 화면이에요', '홈으로 가기' 버튼.
//   - 마운트 시 logImpression('not_found') 1회.
//   - 버튼 onClick: navigate('/', { replace: true }) — 히스토리를 쌓지 않는다.
//   - 저장소·상태 훅(storage / recordToggle / loadPlan)은 import하지 않는다.

const { logImpression, navigateSpy } = vi.hoisted(() => ({
  logImpression: vi.fn(),
  navigateSpy: vi.fn(),
}));

// 부분 목 금지 — PageShell이 쓰는 useScreenLog가 사라지지 않도록 원본을 펼친다.
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  logImpression,
}));

// navigate 호출 인자를 기록하되 실제 이동은 그대로 수행한다(history 동작을 검증해야 하므로).
// ⚠️ vi.mock이 아니라 vi.doMock + 동적 import다: mocks.ts는 import되는 순간 react-router-dom 목
// (useNavigate → mockNavigate)을 호이스팅으로 등록해, 이 파일의 vi.mock을 덮어써 버린다.
vi.doMock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => {
      const real = actual.useNavigate();
      return ((...args: unknown[]) => {
        navigateSpy(...args);
        return (real as (...a: unknown[]) => unknown)(...args);
      }) as ReturnType<typeof actual.useNavigate>;
    },
  };
});

const { MemoryRouter, Routes, Route, useLocation, useNavigate, useNavigationType } = await import(
  "react-router-dom"
);
const { default: NotFound } = await import("@/pages/NotFound");

const h = React.createElement;

/** 현재 경로·이동 방식을 노출하고, history를 한 칸 되감는 버튼을 둔다. */
function RouteProbe() {
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  return h(
    "div",
    null,
    h("span", { "data-testid": "probe-path" }, location.pathname),
    h("span", { "data-testid": "probe-type" }, navType),
    h("button", { type: "button", onClick: () => navigate(-1) }, "probe-back"),
  );
}

function renderAt(initialEntries: string[], initialIndex?: number) {
  return render(
    h(
      MemoryRouter,
      { initialEntries, initialIndex },
      h(
        Routes,
        null,
        h(Route, { path: "/", element: h("div", { "data-testid": "home-probe" }, "홈 화면") }),
        h(Route, { path: "*", element: h(NotFound) }),
      ),
      h(RouteProbe),
    ),
  );
}

describe("404 화면 (*)", () => {
  it("AC-1: /unknown을 렌더하면 not-found 영역에 제목·보조 문구·아이콘·홈 버튼이 있다", () => {
    renderAt(["/unknown"]);

    const area = screen.getByTestId("not-found");
    expect(within(area).getByText("페이지를 찾을 수 없어요")).toBeInTheDocument();
    expect(within(area).getByText("주소가 바뀌었거나 없는 화면이에요")).toBeInTheDocument();
    // 아이콘은 네트워크(static.toss.im) 없이 그려지는 번들 SVG다(샌드박스·차단 환경에서 깨진 이미지 방지).
    expect(area.querySelector("svg")).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "홈으로 가기" })).toHaveLength(1);
    expect(screen.queryByTestId("home-probe")).toBeNull();
  });

  it("AC-1: logImpression('not_found')는 마운트할 때 1회만 호출되고 리렌더로 늘지 않는다", () => {
    const { rerender } = renderAt(["/unknown"]);

    expect(logImpression).toHaveBeenCalledTimes(1);
    expect(logImpression).toHaveBeenCalledWith("not_found");

    rerender(
      h(
        MemoryRouter,
        { initialEntries: ["/unknown"] },
        h(Routes, null, h(Route, { path: "*", element: h(NotFound) })),
      ),
    );
    expect(logImpression).toHaveBeenCalledTimes(1);
  });

  it("AC-1: 알려진 화면 '/'에서는 404 영역이 렌더되지 않는다", () => {
    renderAt(["/"]);

    expect(screen.queryByTestId("not-found")).toBeNull();
    expect(screen.getByTestId("home-probe")).toBeInTheDocument();
    expect(logImpression).not.toHaveBeenCalledWith("not_found");
  });

  it("AC-2: '홈으로 가기'는 navigate('/', { replace: true })를 호출해 '/'로 이동한다", () => {
    renderAt(["/", "/unknown"], 1);
    expect(screen.getByTestId("probe-path")).toHaveTextContent("/unknown");

    fireEvent.click(screen.getByRole("button", { name: "홈으로 가기" }));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith("/", { replace: true });
    expect(screen.getByTestId("probe-path")).toHaveTextContent("/");
    expect(screen.getByTestId("probe-type")).toHaveTextContent("REPLACE");
    expect(screen.getByTestId("home-probe")).toBeInTheDocument();
    expect(screen.queryByTestId("not-found")).toBeNull();
  });

  it("AC-2: replace라 history가 늘지 않아 navigate(-1)을 해도 not-found로 돌아가지 않는다", () => {
    renderAt(["/", "/unknown"], 1);

    fireEvent.click(screen.getByRole("button", { name: "홈으로 가기" }));
    // history = ['/', '/'] (길이 2 그대로) → 한 칸 되감아도 '/'
    fireEvent.click(screen.getByRole("button", { name: "probe-back" }));

    expect(screen.getByTestId("probe-path")).toHaveTextContent("/");
    expect(screen.queryByTestId("not-found")).toBeNull();
    expect(screen.queryByText("페이지를 찾을 수 없어요")).toBeNull();
    expect(screen.getByTestId("home-probe")).toBeInTheDocument();
  });

  it("AC-3: NotFound.tsx는 storage·recordToggle·loadPlan을 참조하지 않는다", () => {
    const source = readFileSync(resolve(__dirname, "../pages/NotFound.tsx"), "utf8");
    const hits = source.split("\n").filter((line) => /storage|recordToggle|loadPlan/.test(line));

    expect(hits).toEqual([]);
    expect(source).not.toMatch(/@ai-factory:placeholder/);
  });
});
