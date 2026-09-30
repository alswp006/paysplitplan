import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
// 목 헬퍼를 SDK보다 먼저 import한다 — 목 등록(mocks.ts 평가)이 SDK 모듈 평가보다 앞서야 목이 걸린다.
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";

mockTds();
mockAppsInToss();

// mocks.ts를 import하면 TossRewardAd 목(children 바로 렌더)도 함께 등록된다 — 이 파일은 실물을 검증하므로 되돌린다.
vi.doMock("@/components/TossRewardAd", async () => await vi.importActual("@/components/TossRewardAd"));
const { TossRewardAd } = await import("@/components/TossRewardAd");

const load = vi.mocked(loadFullScreenAd);
const show = vi.mocked(showFullScreenAd);
type ShowParams = Parameters<typeof showFullScreenAd>[0];
type LoadParams = Parameters<typeof loadFullScreenAd>[0];

const CHILD = "잠금 층 내용";

function renderGate(props: { adGroupId?: string; onRewarded?: () => void; timeoutMs?: number } = {}) {
  return render(
    <TossRewardAd
      adGroupId={props.adGroupId ?? "ag-1"}
      description="광고를 보면 더 볼 수 있어요"
      buttonText="광고 보고 더 보기"
      onRewarded={props.onRewarded}
      timeoutMs={props.timeoutMs}
    >
      <p>{CHILD}</p>
    </TossRewardAd>,
  );
}

beforeEach(() => {
  load.mockClear();
  show.mockClear();
});

describe("TossRewardAd — 보상형 광고 게이트(벤더 모양)", () => {
  it("1. adGroupId가 비어 있으면 SDK를 부르지 않고 children을 보인다", () => {
    renderGate({ adGroupId: "" });
    expect(screen.getByText(CHILD)).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(0);
  });

  it("2. isSupported가 false이거나 throw하면 children을 보이고 load는 0회다", () => {
    vi.mocked(loadFullScreenAd.isSupported).mockReturnValueOnce(false).mockReturnValueOnce(false);
    const { unmount } = renderGate();
    expect(screen.getByText(CHILD)).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(0);
    unmount();

    const boom = () => {
      throw new Error("no bridge");
    };
    vi.mocked(showFullScreenAd.isSupported).mockImplementationOnce(boom).mockImplementationOnce(boom);
    renderGate();
    expect(screen.getByText(CHILD)).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(0);
  });

  it("3. load에는 options.adGroupId만 넘기고 최상위 slotId 키는 없다", () => {
    renderGate();
    expect(load).toHaveBeenCalledTimes(1);
    const arg = load.mock.calls[0][0];
    expect(arg).toEqual(expect.objectContaining({ options: { adGroupId: "ag-1" } }));
    expect(Object.keys(arg)).not.toContain("slotId");
  });

  it("4. loaded 이벤트가 오면 버튼이 활성화되고 children은 숨어 있다", async () => {
    renderGate();
    expect(screen.getByRole("button", { name: "광고를 준비하고 있어요" })).toBeDisabled();
    const button = await screen.findByRole("button", { name: "광고 보고 더 보기" });
    expect(button).toBeEnabled();
    expect(screen.queryByText(CHILD)).toBeNull();
    expect(screen.getByTestId("reward-gate")).toBeInTheDocument();
  });

  it("5. show가 userEarnedReward를 내면 children이 보이고 onRewarded가 1회 불린다", async () => {
    const onRewarded = vi.fn();
    renderGate({ onRewarded });
    fireEvent.click(await screen.findByRole("button", { name: "광고 보고 더 보기" }));
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ options: { adGroupId: "ag-1" } }));
    expect(await screen.findByText(CHILD)).toBeInTheDocument();
    expect(onRewarded).toHaveBeenCalledTimes(1);
  });

  it("6. 보상 없이 닫으면(requested·show·dismissed) 잠금 유지 + '광고 다시 보기'·재시도 설명, load 2회째", async () => {
    const onRewarded = vi.fn();
    show.mockImplementationOnce((p: ShowParams) => {
      for (const type of ["requested", "show", "dismissed"] as const) p.onEvent({ type });
      return vi.fn();
    });
    renderGate({ onRewarded });
    fireEvent.click(await screen.findByRole("button", { name: "광고 보고 더 보기" }));

    expect(await screen.findByRole("button", { name: "광고 다시 보기" })).toBeEnabled();
    expect(screen.getByText("광고를 끝까지 봐야 열려요. 다시 볼 수 있어요")).toBeInTheDocument();
    expect(screen.queryByText(CHILD)).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
    expect(onRewarded).toHaveBeenCalledTimes(0);
  });

  it("7. failedToShow와 onError는 각각 children을 보인다(fail-open, onRewarded 없음)", async () => {
    const onRewarded = vi.fn();
    show.mockImplementationOnce((p: ShowParams) => {
      p.onEvent({ type: "failedToShow" });
      return vi.fn();
    });
    const first = renderGate({ onRewarded });
    fireEvent.click(await screen.findByRole("button", { name: "광고 보고 더 보기" }));
    expect(await screen.findByText(CHILD)).toBeInTheDocument();
    first.unmount();

    show.mockImplementationOnce((p: ShowParams) => {
      p.onError(new Error("native error"));
      return vi.fn();
    });
    renderGate({ onRewarded });
    fireEvent.click(await screen.findByRole("button", { name: "광고 보고 더 보기" }));
    expect(await screen.findByText(CHILD)).toBeInTheDocument();
    expect(onRewarded).toHaveBeenCalledTimes(0);
  });

  it("7-1. load의 onError·throw도 children을 보인다", async () => {
    load.mockImplementationOnce((p: LoadParams) => {
      p.onError(new Error("load failed"));
      return vi.fn();
    });
    const first = renderGate();
    expect(await screen.findByText(CHILD)).toBeInTheDocument();
    first.unmount();

    load.mockImplementationOnce(() => {
      throw new Error("bridge missing");
    });
    renderGate();
    expect(await screen.findByText(CHILD)).toBeInTheDocument();
  });

  it("8. 언마운트하면 load가 돌려준 구독 해제 함수가 1회 불린다", async () => {
    const { unmount } = renderGate();
    await screen.findByRole("button", { name: "광고 보고 더 보기" });
    const unsubscribe = load.mock.results[0].value as ReturnType<typeof vi.fn>;
    expect(unsubscribe).toHaveBeenCalledTimes(0);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("9. show가 첫 이벤트(show)를 내면 타임아웃이 풀려, timeoutMs가 지나도 잠금이 유지된다", () => {
    vi.useFakeTimers();
    show.mockImplementationOnce((p: ShowParams) => {
      p.onEvent({ type: "show" });
      return vi.fn();
    });
    renderGate({ timeoutMs: 1000 });
    act(() => {
      vi.advanceTimersByTime(1); // 목의 loaded(setTimeout 0)
    });
    fireEvent.click(screen.getByRole("button", { name: "광고 보고 더 보기" }));
    act(() => {
      vi.advanceTimersByTime(1001);
    });
    expect(screen.queryByText(CHILD)).toBeNull();
    expect(screen.getByRole("button", { name: "광고를 보여 주고 있어요" })).toBeDisabled();
  });

  it("9-1. 로드가 timeoutMs 안에 안 오면 연다(fail-open)", () => {
    vi.useFakeTimers();
    load.mockImplementationOnce(() => vi.fn());
    renderGate({ timeoutMs: 1000 });
    expect(screen.queryByText(CHILD)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1001);
    });
    expect(screen.getByText(CHILD)).toBeInTheDocument();
  });

  it("10. 소스에 slotId·as Parameters·reward-ad.css가 없다", () => {
    const src = readFileSync(resolve(__dirname, "..", "TossRewardAd.tsx"), "utf8");
    expect(src).not.toContain("slotId");
    expect(src).not.toContain("as Parameters");
    expect(src).not.toContain("reward-ad.css");
  });
});
