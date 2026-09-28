import { describe, it, expect, vi, beforeEach } from "vitest";

const sdk = vi.hoisted(() => ({ requestReview: vi.fn(async () => {}) }));
vi.mock("@apps-in-toss/web-framework", () => ({ requestReview: sdk.requestReview }));

import { requestReviewOnce } from "@/lib/review";
import { REVIEW_KEY } from "@/lib/storage";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T01:00:00.000Z"));
});

describe("requestReviewOnce", () => {
  it("AC-5: 두 번 불러도 요청은 1회이고 ReviewPromptState를 저장한다", () => {
    requestReviewOnce();
    requestReviewOnce();
    expect(sdk.requestReview).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(REVIEW_KEY)!)).toEqual({
      version: 1,
      id: "review-prompt",
      createdAt: "2026-09-29T01:00:00.000Z",
      updatedAt: "2026-09-29T01:00:00.000Z",
    });
  });

  it("AC-5: 레거시 값 '1'이면 요청 0회이고 값은 그대로다", () => {
    localStorage.setItem(REVIEW_KEY, "1");
    requestReviewOnce();
    expect(sdk.requestReview).not.toHaveBeenCalled();
    expect(localStorage.getItem(REVIEW_KEY)).toBe("1");
  });

  it("요청이 던지면 가드를 되돌려 다시 물을 수 있다", () => {
    sdk.requestReview.mockImplementationOnce(() => {
      throw new Error("no bridge");
    });
    requestReviewOnce();
    expect(localStorage.getItem(REVIEW_KEY)).toBeNull();
    requestReviewOnce();
    expect(sdk.requestReview).toHaveBeenCalledTimes(2);
  });
});
