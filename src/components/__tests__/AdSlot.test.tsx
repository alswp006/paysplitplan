import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { TossAds } from "@apps-in-toss/web-framework";

mockTds();
mockAppsInToss();

const { AdSlot } = await import("@/components/AdSlot");
const attach = vi.mocked(TossAds.attachBanner);

beforeEach(() => {
  attach.mockClear();
});

describe("AdSlot — 배너 래퍼 (review 0930)", () => {
  it("광고 그룹 ID가 비어 있으면 SDK를 부르지 않는다(빈 ID로 attachBanner 금지)", () => {
    render(<AdSlot adGroupId="" onImpression={vi.fn()} />);
    expect(attach).toHaveBeenCalledTimes(0);
  });

  it("노출 로그는 SDK의 onAdImpression이 왔을 때만 부른다", () => {
    const onImpression = vi.fn();
    render(<AdSlot adGroupId="ag-banner" onImpression={onImpression} />);
    expect(attach).toHaveBeenCalledTimes(1);
    expect(onImpression).toHaveBeenCalledTimes(0);
    const options = attach.mock.calls[0][2];
    options?.callbacks?.onAdImpression?.({ slotId: "s", adGroupId: "ag-banner", adMetadata: { creativeId: "c", requestId: "r" } });
    expect(onImpression).toHaveBeenCalledTimes(1);
  });
});
