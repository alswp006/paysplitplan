import { describe, it, expect, vi } from "vitest";
import React from "react";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();

// ── 계약 (Coder가 이 시그니처대로 만든다) ──
// src/App.tsx  (default export App, props 없음 — Router는 main.tsx/테스트의 MemoryRouter가 감싼다)
//   - <Routes> 안의 <Route>는 정확히 5개: '/'→Home, '/plan'→Plan, '/result'→Result,
//     '/history'→History, 마지막 '*'→NotFound. (dev 전용 갤러리 Route 등 6번째 Route 금지)
//   - '*' 라우트 선언은 src 전체에서 App.tsx 한 곳뿐이다.
//   - src/main.tsx(@AI:ANCHOR)는 손대지 않는다.

// 화면 본문은 각자의 패킷에서 검증한다 — 여기서는 "어느 라우트가 어느 화면을 그리는가"만 본다.
// 404는 진짜 NotFound를 써서 '홈으로 가기' 이동·히스토리를 실제 라우터로 검증한다.
vi.mock("@/pages/Home", async () => {
  const R = await import("react");
  return { default: () => R.createElement("div", { "data-testid": "page-home" }, "home") };
});
vi.mock("@/pages/Plan", async () => {
  const R = await import("react");
  return { default: () => R.createElement("div", { "data-testid": "page-plan" }, "plan") };
});
vi.mock("@/pages/Result", async () => {
  const R = await import("react");
  return { default: () => R.createElement("div", { "data-testid": "page-result" }, "result") };
});
vi.mock("@/pages/History", async () => {
  const R = await import("react");
  return { default: () => R.createElement("div", { "data-testid": "page-history" }, "history") };
});

// ⚠️ mocks.ts는 import되는 순간 react-router-dom 목(useNavigate → mockNavigate)을 등록한다.
// 실제 이동(홈으로 가기)을 검증해야 하므로 vi.doMock으로 원본을 되돌리고 동적 import한다.
vi.doMock("react-router-dom", async () => await vi.importActual("react-router-dom"));

const { MemoryRouter, useLocation, useNavigate } = await import("react-router-dom");
const { default: App } = await import("@/App");

const h = React.createElement;

/** 현재 경로를 노출하고, history를 한 칸 되감는 버튼을 둔다. */
function RouteProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return h(
    "div",
    null,
    h("span", { "data-testid": "probe-path" }, location.pathname),
    h("button", { type: "button", onClick: () => navigate(-1) }, "probe-back"),
  );
}

function renderApp(initialEntries: string[], initialIndex?: number) {
  return render(h(MemoryRouter, { initialEntries, initialIndex }, h(App), h(RouteProbe)));
}

const SRC_DIR = resolve(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** 주석을 걷어낸 App.tsx — 주석 속 '<Route' 문구가 개수에 섞이지 않게 한다. */
function readAppCode(): string {
  return readFileSync(join(SRC_DIR, "App.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("라우팅 연결 (App.tsx 단일 소유)", () => {
  it("AC-1[P0]: '*' 라우트 선언은 src 전체에서 App.tsx 한 곳 1건뿐이다", () => {
    // 패킷 AC의 grep 패턴과 동일 — 이 파일 자신이 매치되지 않게 조각으로 조립한다
    const star = "\\*";
    const pattern = new RegExp(`path="${star}"|path: '${star}'`);
    const hits = walk(SRC_DIR)
      .filter((f) => /\.(tsx?|jsx?)$/.test(f))
      .filter((f) => pattern.test(readFileSync(f, "utf8")));

    expect(hits).toHaveLength(1);
    expect(hits[0].endsWith("App.tsx")).toBe(true);
  });

  it("AC-1[P0]: App.tsx의 <Route>는 정확히 5개이고 마지막이 '*'다", () => {
    const code = readAppCode();
    const routes = code.match(/<Route\b[^>]*?path=(?:"[^"]*"|\{[^}]*\})/g) ?? [];
    const paths = routes.map((r) => r.match(/path=(?:"([^"]*)"|\{([^}]*)\})/)!.slice(1).find(Boolean));

    expect((code.match(/<Route\b/g) ?? []).length).toBe(5);
    expect(paths).toEqual(["/", "/plan", "/result", "/history", "*"]);
    expect(code.indexOf('path="/history"')).toBeLessThan(code.lastIndexOf("<Route"));
  });

  it("AC-2[P0]: /plan/, /plan?from=home은 Plan, /history#top은 History를 렌더하고 not-found는 0개다", () => {
    const first = renderApp(["/plan/"]);
    expect(screen.getAllByTestId("page-plan")).toHaveLength(1);
    expect(screen.queryAllByTestId("not-found")).toHaveLength(0);
    expect(screen.queryByTestId("page-history")).toBeNull();
    first.unmount();

    const second = renderApp(["/plan?from=home"]);
    expect(screen.getAllByTestId("page-plan")).toHaveLength(1);
    expect(screen.queryAllByTestId("not-found")).toHaveLength(0);
    expect(screen.queryByTestId("page-home")).toBeNull();
    second.unmount();

    renderApp(["/history#top"]);
    expect(screen.getAllByTestId("page-history")).toHaveLength(1);
    expect(screen.queryAllByTestId("not-found")).toHaveLength(0);
    expect(screen.queryByTestId("page-plan")).toBeNull();
  });

  it("AC-2[P0]: '/'와 '/result'는 각각 Home·Result를 렌더한다", () => {
    const first = renderApp(["/"]);
    expect(screen.getAllByTestId("page-home")).toHaveLength(1);
    expect(screen.queryAllByTestId("not-found")).toHaveLength(0);
    first.unmount();

    renderApp(["/result"]);
    expect(screen.getAllByTestId("page-result")).toHaveLength(1);
    expect(screen.queryAllByTestId("not-found")).toHaveLength(0);
    expect(screen.queryByTestId("page-home")).toBeNull();
  });

  it.each(["/unknown", "/history/2026-09", "/plan/edit"])(
    "AC-2[P0]: %s로 진입하면 not-found가 렌더되고 어떤 화면도 그려지지 않는다",
    (path) => {
      renderApp([path]);

      expect(screen.getAllByTestId("not-found")).toHaveLength(1);
      expect(screen.getByText("페이지를 찾을 수 없어요")).toBeInTheDocument();
      for (const id of ["page-home", "page-plan", "page-result", "page-history"]) {
        expect(screen.queryByTestId(id)).toBeNull();
      }
    },
  );

  it("AC-3[P0]: /unknown에서 '홈으로 가기'를 탭하면 홈이 렌더되고 not-found는 사라진다", () => {
    renderApp(["/unknown"]);
    expect(screen.getByTestId("probe-path")).toHaveTextContent("/unknown");

    fireEvent.click(screen.getByRole("button", { name: "홈으로 가기" }));

    expect(screen.getByTestId("probe-path").textContent).toBe("/");
    expect(screen.getAllByTestId("page-home")).toHaveLength(1);
    expect(screen.queryAllByTestId("not-found")).toHaveLength(0);
  });

  it("AC-3[P0]: 홈으로 간 뒤 뒤로 가도 not-found로 돌아가지 않고 직전 화면(/history)이 나온다", () => {
    renderApp(["/history", "/unknown"], 1);
    expect(screen.getAllByTestId("not-found")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "홈으로 가기" }));
    expect(screen.getAllByTestId("page-home")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "probe-back" }));

    expect(screen.getByTestId("probe-path").textContent).toBe("/history");
    expect(screen.getAllByTestId("page-history")).toHaveLength(1);
    expect(screen.queryAllByTestId("not-found")).toHaveLength(0);
  });

  it("AC-4[P0]: src에 http로 시작하는 URL을 여는 window.open / window.location.href 대입이 0건이다", () => {
    const pattern = /window\.open\(\s*["'`]https?:|window\.location\.href\s*=\s*["'`]https?:/;
    const broad = /window\.open\(|window\.location\.href\s*=/;
    const files = walk(SRC_DIR).filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.endsWith("packet-0018.test.ts"));

    const httpHits = files.filter((f) => pattern.test(readFileSync(f, "utf8")));
    const anyHits = files.filter((f) => broad.test(readFileSync(f, "utf8")));

    expect(httpHits).toEqual([]);
    expect(anyHits).toEqual([]);
  });

  it("AC-4[P0]: src/main.tsx는 수정되지 않았다(diff 0줄, ANCHOR·BrowserRouter·Provider 유지)", () => {
    const diff = execSync("git diff HEAD -- src/main.tsx", { cwd: resolve(SRC_DIR, ".."), encoding: "utf8" });
    const main = readFileSync(join(SRC_DIR, "main.tsx"), "utf8");

    expect(diff).toBe("");
    expect(main).toContain("@AI:ANCHOR");
    expect(main).toContain("<BrowserRouter basename={import.meta.env.BASE_URL}>");
    expect(main).toContain("<TDSMobileAITProvider>");
  });
});
