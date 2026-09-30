import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { NavigateFunction } from "react-router-dom";
import { mockTds, mockAppsInToss, mockAnalytics } from "@/__tests__/__helpers__/mocks";

// 광고 env 두 개를 빈 값으로 둔다 — 콘솔 발급값이 없는 지금 배포본과 같은 조건이다.
// Result가 모듈 평가 시점에 env를 읽으므로 App을 import하기 **전에** stub한다.
vi.stubEnv("VITE_TOSS_AD_SLOT_ID", "");
vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "");

mockTds();
mockAppsInToss();
mockAnalytics();

// mocks.ts를 import하는 순간 react-router-dom·TossRewardAd 목이 함께 등록된다.
// 전체 흐름은 실제 라우팅과 실제 광고 게이트(fail-open)를 거쳐야 하므로 둘 다 원본으로 되돌린다.
vi.doMock("react-router-dom", async () => await vi.importActual("react-router-dom"));
vi.doMock("@/components/TossRewardAd", async () => await vi.importActual("@/components/TossRewardAd"));

const { MemoryRouter, useNavigate } = await import("react-router-dom");
const { default: App } = await import("@/App");

// 주소창 직접 입력을 흉내내려고 라우터의 navigate를 밖으로 꺼낸다.
let addressBar: NavigateFunction | null = null;
function AddressBar() {
  addressBar = useNavigate();
  return null;
}

describe("전체 흐름 (광고 env 비어 있음)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-20T09:00:00+09:00"));
    errorSpy = vi.spyOn(console, "error");
    warnSpy = vi.spyOn(console, "warn");
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("/ → /plan → /result 저장 → 홈 체크 4개 → /history → /does-not-exist → 홈을 완주한다", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AddressBar />
        <App />
      </MemoryRouter>,
    );

    // ── 1. 홈(계획 없음) → /plan
    fireEvent.click(await screen.findByRole("button", { name: "월급 계획 짜기" }));

    // ── 2. /plan: 월급 300만 원 + 고정비 월세 60만 원, 기본 5:3:1:1
    fireEvent.change(await screen.findByLabelText("월급"), { target: { value: "3,000,000" } });
    fireEvent.click(screen.getByRole("button", { name: "고정비 추가" }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("항목 이름"), { target: { value: "월세" } });
    fireEvent.change(within(sheet).getByLabelText("금액"), { target: { value: "600,000" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "추가" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "세팅표 보기" }));

    // ── 3. /result: 무료 층은 게이트 밖에서 바로, 잠금 층은 슬롯 ID가 없어 게이트가 자동으로 열린다
    const freeTier = await screen.findByTestId("free-tier");
    await waitFor(() => expect(within(freeTier).getByText("2,400,000원")).toBeInTheDocument());
    expect(within(freeTier).getAllByTestId("allocation-card")).toHaveLength(4);
    for (const text of ["1,200,000원", "720,000원"]) {
      expect(within(freeTier).getByText(text)).toBeInTheDocument();
    }
    expect(within(freeTier).getAllByText("240,000원")).toHaveLength(2);
    const lockedTier = await screen.findByTestId("locked-tier");
    expect(within(lockedTier).getByTestId("bracket-compare")).toBeInTheDocument();
    expect(within(lockedTier).getByTestId("trend-block")).toBeInTheDocument();
    expect(screen.queryByText("광고를 준비하고 있어요")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "이 계획 저장하기" }));
    fireEvent.click(await screen.findByRole("button", { name: "홈에서 이체 체크하기" }));

    // ── 4. 홈: 체크 4개 → 4/4 완료 · 100%
    const checklist = await screen.findByTestId("checklist-card");
    expect(within(checklist).getAllByTestId("checklist-row")).toHaveLength(4);
    for (const label of ["생활비", "저축", "비상금", "여가"]) {
      fireEvent.click(within(checklist).getByRole("switch", { name: `${label} 통장 이체 완료` }));
    }
    await waitFor(() => expect(screen.getByTestId("progress-text")).toHaveTextContent("4/4 완료 · 100%"));

    // ── 5. /history (하단 탭)
    fireEvent.click(screen.getByRole("tab", { name: "기록" }));
    const hero = await screen.findByTestId("history-hero");
    await waitFor(() => expect(hero).toHaveTextContent("100"));
    expect(screen.getAllByTestId("month-row")).toHaveLength(1);

    // ── 6. 주소창에서 /does-not-exist → 404 → "홈으로 가기"
    act(() => {
      addressBar?.("/does-not-exist");
    });
    expect(await screen.findByTestId("not-found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "홈으로 가기" }));

    // ── 7. 홈 복귀: 저장된 계획과 이번 달 체크가 그대로 남아 있다
    expect(await screen.findByTestId("dday-hero")).toBeInTheDocument();
    expect(screen.getByTestId("progress-text")).toHaveTextContent("4/4 완료 · 100%");

    // ── 콘솔: error 0회, 'No routes matched' warn 0회
    expect(errorSpy).toHaveBeenCalledTimes(0);
    const routeWarns = warnSpy.mock.calls.filter((args) =>
      args.some((a) => String(a).includes("No routes matched")),
    );
    expect(routeWarns).toHaveLength(0);
  });
});
