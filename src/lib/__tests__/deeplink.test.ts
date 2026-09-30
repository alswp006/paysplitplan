import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APP_NAME, buildRatioShareMessage, parseSharedRatios, ratioLine, ratioParam, toIntossPath } from "@/lib/deeplink";

describe("deeplink — 공유 경로와 메시지", () => {
  it("앱 내부 경로를 intoss:// 딥링크로 바꾸고, 이미 intoss 계열이면 그대로 둔다", () => {
    expect(toIntossPath("/plan?r=50-30-10-10")).toBe("intoss://paysplitplan/plan?r=50-30-10-10");
    expect(toIntossPath("intoss://paysplitplan/result")).toBe("intoss://paysplitplan/result");
    expect(toIntossPath("intoss-private://paysplitplan/plan")).toBe("intoss-private://paysplitplan/plan");
  });

  it("APP_NAME은 apps-in-toss.config.ts의 appName과 같다", () => {
    const config = readFileSync(resolve(__dirname, "..", "..", "..", "apps-in-toss.config.ts"), "utf8");
    const m = /appName:\s*['"]([^'"]+)['"]/.exec(config);
    expect(m).not.toBeNull();
    expect(APP_NAME).toBe(m![1]);
  });

  it("비율 파라미터와 메시지 — 금액 없이 비율만 싣는다", () => {
    expect(ratioParam([40, 40, 10, 10])).toBe("40-40-10-10");
    const msg = buildRatioShareMessage([40, 40, 10, 10]);
    expect(msg).toBe("월급쪼개기로 이렇게 나눠요\n생활비 40% · 저축 40% · 비상금 10% · 여가 10%\n내 월급으로 계산해 보기");
    expect(msg).not.toMatch(/\d{1,3}(,\d{3})+원|만 원/);
  });
});

describe("parseSharedRatios — 받은 링크의 ?r=", () => {
  it("'40-40-10-10'은 유효하다(공유가 만든 값을 그대로 되읽는다)", () => {
    expect(parseSharedRatios("?r=40-40-10-10")).toEqual([40, 40, 10, 10]);
    expect(parseSharedRatios(`?r=${ratioParam([50, 30, 10, 10])}`)).toEqual([50, 30, 10, 10]);
    expect(parseSharedRatios("?from=share&r=100-0-0-0")).toEqual([100, 0, 0, 0]);
  });

  it.each([
    ["합 110", "?r=90-20-0-0"],
    ["숫자 아님", "?r=abc"],
    ["5의 배수 아님", "?r=41-39-10-10"],
    ["값 3개", "?r=40-40-10"],
    ["음수", "?r=-10-60-25-25"],
    ["100 초과", "?r=105-0-0-0"],
    ["없음", ""],
    ["다른 쿼리만", "?from=home"],
  ])("%s(%s)면 null", (_name, search) => {
    expect(parseSharedRatios(search)).toBeNull();
  });

  it("배너 줄은 공유 메시지와 같은 표기다", () => {
    expect(ratioLine([40, 40, 10, 10])).toBe("생활비 40% · 저축 40% · 비상금 10% · 여가 10%");
  });
});
