/**
 * 런타임 계측(analytics / review / share)의 계약 테스트.
 *
 * 여기서 무는 것은 "로그가 예쁘게 나오나"가 아니라 **계측이 앱을 죽이지 않는가**다.
 * 브릿지 없는 환경에서 SDK는 throw하고, 그 throw가 render/effect를 탈출하면 화면 전체가
 * 흰 화면이 된다. 아래 가드 테스트가 빨개지면 그 위험이 되살아난 것이다.
 *
 * SDK 목은 이 파일 최상위의 vi.mock으로 직접 건다(호이스팅이 보장되는 자리).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, renderHook, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

const sdk = vi.hoisted(() => ({
  screen: vi.fn(async (_params?: unknown) => {}),
  click: vi.fn(async (_params?: unknown) => {}),
  impression: vi.fn(async (_params?: unknown) => {}),
  requestReview: vi.fn(async () => {}),
  share: vi.fn(async (_message: { message: string }) => {}),
  getTossShareLink: vi.fn(async (path: string, _ogImageUrl?: string) => `https://toss.im/share/mock${path}`),
}));

vi.mock("@apps-in-toss/web-framework", () => ({
  Analytics: { screen: sdk.screen, click: sdk.click, impression: sdk.impression },
  requestReview: sdk.requestReview,
  share: sdk.share,
  getTossShareLink: sdk.getTossShareLink,
}));

import { DWELL_MS, logClick, logImpression, logScreen, useScreenLog } from "@/lib/analytics";
import { requestReviewOnce } from "@/lib/review";
import { shareApp } from "@/lib/share";
import { PageShell } from "@/components/PageShell";

afterEach(() => {
  cleanup();
  // jsdom의 경로를 원상복구 — PageShell의 라우터 밖 폴백이 다음 테스트에서 "/"를 봐야 한다.
  window.history.pushState({}, "", "/");
});

/** Analytics.screen 목에 실린 params 중 log_name이 주어진 값인 호출 수. */
function screenCallsNamed(logName: string): number {
  return sdk.screen.mock.calls.filter(
    ([params]) => (params as { log_name?: string } | undefined)?.log_name === logName,
  ).length;
}

describe("analytics — log_name 접두사", () => {
  it("경로를 안정적인 screen 이름으로 정규화하고 원본 경로를 필드로 남긴다", () => {
    logScreen("/savings/result");
    expect(sdk.screen).toHaveBeenCalledWith(
      expect.objectContaining({ log_name: "screen_savings_result", page: "/savings/result" }),
    );
  });

  it('"/"는 root로 접힌다', () => {
    logScreen("/");
    expect(sdk.screen).toHaveBeenCalledWith(expect.objectContaining({ log_name: "screen_root" }));
  });

  it("한글 라벨을 버리지 않는다(버리면 서로 다른 버튼이 한 이름으로 뭉친다)", () => {
    logClick("계산하기");
    logClick("저장");
    expect(sdk.click).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ log_name: "click_계산하기", target: "계산하기" }),
    );
    expect(sdk.click).toHaveBeenNthCalledWith(2, expect.objectContaining({ log_name: "click_저장" }));
  });

  it("impression도 같은 규칙을 쓴다", () => {
    logImpression("Hero Banner");
    expect(sdk.impression).toHaveBeenCalledWith(
      expect.objectContaining({ log_name: "impression_hero_banner" }),
    );
  });

  it("호출부의 extra가 log_name을 덮지 못한다", () => {
    logScreen("/home", { log_name: "hacked", plan: "free" });
    expect(sdk.screen).toHaveBeenCalledWith(
      expect.objectContaining({ log_name: "screen_home", plan: "free" }),
    );
  });
});

describe("analytics — 가드(브릿지 없는 환경)", () => {
  it("SDK가 동기 throw해도 로거는 던지지 않는다", () => {
    sdk.screen.mockImplementationOnce(() => {
      throw new Error("no native bridge");
    });
    expect(() => logScreen("/x")).not.toThrow();
  });

  it("반환이 undefined여도 안전하다(그냥 .catch를 붙이면 여기서 터진다)", () => {
    sdk.click.mockImplementationOnce((() => undefined) as unknown as () => Promise<void>);
    expect(() => logClick("cta")).not.toThrow();
  });

  it("반환 Promise가 거부돼도 미처리 거부를 남기지 않는다", async () => {
    sdk.impression.mockImplementationOnce(() => Promise.reject(new Error("bridge lost")));
    expect(() => logImpression("banner")).not.toThrow();
    await Promise.resolve();
  });
});

describe("useScreenLog — 체류 3초 경계", () => {
  it("마운트에 화면 로그 1회, DWELL_MS를 넘겨야 체류 로그 1회", () => {
    vi.useFakeTimers();
    renderHook(() => useScreenLog("/detail"));

    expect(screenCallsNamed("screen_detail")).toBe(1);
    expect(screenCallsNamed("dwell_detail")).toBe(0);

    vi.advanceTimersByTime(DWELL_MS - 1);
    expect(screenCallsNamed("dwell_detail")).toBe(0);

    vi.advanceTimersByTime(1);
    expect(screenCallsNamed("dwell_detail")).toBe(1);
    expect(sdk.screen).toHaveBeenLastCalledWith(
      expect.objectContaining({ log_name: "dwell_detail", dwell_ms: DWELL_MS }),
    );
  });

  it("3초 전에 떠나면 체류 로그가 없다(떠난 화면의 체류는 거짓이다)", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useScreenLog("/detail"));
    unmount();
    vi.advanceTimersByTime(DWELL_MS * 2);
    expect(screenCallsNamed("dwell_detail")).toBe(0);
  });

  it("같은 page로 재마운트되면 화면 로그가 다시 1회 남는다(방문 횟수를 세야 한다)", () => {
    renderHook(() => useScreenLog("/detail")).unmount();
    renderHook(() => useScreenLog("/detail")).unmount();
    expect(screenCallsNamed("screen_detail")).toBe(2);
  });
});

describe("requestReviewOnce", () => {
  it("두 번 불러도 실제 요청은 1회다", () => {
    requestReviewOnce();
    requestReviewOnce();
    expect(sdk.requestReview).toHaveBeenCalledTimes(1);
  });

  it("키가 다르면 각각 1회씩", () => {
    requestReviewOnce("a");
    requestReviewOnce("a");
    requestReviewOnce("b");
    expect(sdk.requestReview).toHaveBeenCalledTimes(2);
  });

  it("SDK가 throw해도 던지지 않는다", () => {
    sdk.requestReview.mockImplementationOnce(() => {
      throw new Error("no native bridge");
    });
    expect(() => requestReviewOnce()).not.toThrow();
  });

  it("동기 throw(브릿지 없음)면 가드를 되돌린다 — 그 사용자에게 다시 물을 수 있어야 한다", () => {
    sdk.requestReview.mockImplementationOnce(() => {
      throw new Error("no native bridge");
    });
    requestReviewOnce("rollback-sync");
    requestReviewOnce("rollback-sync");
    // 1회차는 실패했으므로 소진되지 않는다 → 2회차가 실제로 나간다.
    expect(sdk.requestReview).toHaveBeenCalledTimes(2);
  });

  it("거부(구버전 앱)여도 가드를 되돌린다", async () => {
    sdk.requestReview.mockImplementationOnce(() => Promise.reject(new Error("unsupported")));
    requestReviewOnce("rollback-async");
    await Promise.resolve();
    await Promise.resolve();
    requestReviewOnce("rollback-async");
    expect(sdk.requestReview).toHaveBeenCalledTimes(2);
  });

  it("성공하면 같은 틱의 두 번째 호출을 막는다(결과 화면 이중 렌더)", () => {
    requestReviewOnce("sync-dedup");
    requestReviewOnce("sync-dedup");
    expect(sdk.requestReview).toHaveBeenCalledTimes(1);
  });
});

describe("shareApp", () => {
  it("path를 주면 딥링크를 만들어 메시지 뒤에 붙인다", async () => {
    await shareApp({ message: "내 결과 보기", path: "/result" });
    expect(sdk.getTossShareLink).toHaveBeenCalledWith("/result", undefined);
    expect(sdk.share).toHaveBeenCalledWith({
      message: "내 결과 보기\nhttps://toss.im/share/mock/result",
    });
  });

  it("링크 생성이 실패하면 message만으로 공유한다(공유 자체를 잃지 않는다)", async () => {
    sdk.getTossShareLink.mockImplementationOnce(() => Promise.reject(new Error("no bridge")));
    await shareApp({ message: "내 결과 보기", path: "/result" });
    expect(sdk.share).toHaveBeenCalledWith({ message: "내 결과 보기" });
  });

  it("path가 없으면 링크를 만들지 않는다", async () => {
    await shareApp({ message: "그냥 공유" });
    expect(sdk.getTossShareLink).not.toHaveBeenCalled();
    expect(sdk.share).toHaveBeenCalledWith({ message: "그냥 공유" });
  });

  it("ogImageUrl을 그대로 넘긴다", async () => {
    await shareApp({ message: "m", path: "/p", ogImageUrl: "https://cdn.example/og.png" });
    expect(sdk.getTossShareLink).toHaveBeenCalledWith("/p", "https://cdn.example/og.png");
  });

  it("공유 자체가 실패해도 reject하지 않는다", async () => {
    sdk.share.mockImplementationOnce(() => Promise.reject(new Error("no bridge")));
    await expect(shareApp({ message: "m" })).resolves.toBeUndefined();
  });
});

describe("PageShell 자동 계측", () => {
  it("라우터 밖에서도 렌더된다(useLocation은 Router 밖에서 throw한다)", () => {
    const { container } = render(<PageShell>본문</PageShell>);
    expect(container.textContent).toContain("본문");
  });

  it("현재 경로를 화면 로그로 남긴다", () => {
    window.history.pushState({}, "", "/detail");
    render(
      <BrowserRouter>
        <PageShell>본문</PageShell>
      </BrowserRouter>,
    );
    expect(screenCallsNamed("screen_detail")).toBe(1);
  });

  it("page prop이 경로보다 우선한다", () => {
    window.history.pushState({}, "", "/detail");
    render(
      <BrowserRouter>
        <PageShell page="결과">본문</PageShell>
      </BrowserRouter>,
    );
    expect(screenCallsNamed("screen_결과")).toBe(1);
    expect(screenCallsNamed("screen_detail")).toBe(0);
  });
});
