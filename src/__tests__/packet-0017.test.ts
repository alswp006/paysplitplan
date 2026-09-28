import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import History from "@/pages/History";
import { RECORDS_KEY } from "@/lib/storage";

mockTds();
mockAppsInToss();
mockRouter();

// ── 계약 (Coder가 이 시그니처대로 만든다) ──
// src/pages/History.tsx  (default export History, props 없음 — 자리 페이지를 통째로 교체)
//   - 마운트 시 loadRecords()로 읽는다(읽기 전용 — setItem·removeItem 호출 없음). 계획(loadPlan)은 필요 없다.
//   - 목록: 월 하나당 data-testid="month-row" 1개, 최신 월 → 오래된 월 순.
//       행 텍스트에 'YYYY년 M월'(예: '2026년 9월'), 오른쪽 값 '{rate}%', 행 안에 <MiniBar>(role=progressbar, aria-valuenow=rate).
//       rate가 100이면 그 행에만 '완료' Badge.
//   - hero: <SummaryHero testId="history-hero" label="이번 달 이행률" value={<CountUp value={이번 달 rate} unit="%" />} />
//       이번 달(getToday() 기준 monthKey) 기록이 없으면 value 0 + '이번 달은 아직 체크 전이에요'.
//   - 기록 0개(키 없음·빈 records·깨진 JSON): EmptyState '아직 기록이 없어요' + weak 버튼 '이번 달 체크하러 가기'
//       → onClick navigate('/') (state 없음). month-row 0개, console.error 0회.
//   - 목록 뒤에 <AdSlot /> 1개, 본문 맨 끝 <Spacing size={80} />, 그 아래 FloatingTabBar(홈·기록 — 기록이 선택 탭).
//   - History.tsx에는 overflow / react-window / react-virtual 문자열이 없다(단순 map 렌더).
//   - loadRecords가 걸러낸 레코드(rate가 문자열 등 손상)는 행으로 보이지 않는다.

// hero의 value prop을 직접 볼 수 있게 CountUp만 대역으로 바꾼다(나머지 컴포넌트는 실물).
vi.mock("@/components/CountUp", async () => {
  const R = await import("react");
  return {
    CountUp: ({ value, unit }: { value: number; unit?: string }) =>
      R.createElement("span", { "data-testid": "count-up", "data-value": String(value), "data-unit": unit }, `${value}${unit ?? ""}`),
  };
});

// 광고 슬롯 위치만 본다 — SDK 배너 부착은 이 화면 테스트의 관심사가 아니다.
vi.mock("@/components/AdSlot", async () => {
  const R = await import("react");
  return { AdSlot: () => R.createElement("div", { "data-testid": "ad-slot" }) };
});

const CREATED = "2026-09-01T00:00:00.000Z";
const CATS = ["living", "saving", "emergency", "leisure"] as const;

function record(month: string, rate: number, extra: Record<string, unknown> = {}) {
  const on = Math.round((rate / 100) * 4);
  return {
    id: `rec_${month}`,
    planId: "plan_a",
    month,
    checked: { living: on > 0, saving: on > 1, emergency: on > 2, leisure: on > 3 },
    eligible: [...CATS],
    rate,
    completedAt: rate === 100 ? CREATED : null,
    snapshot: {
      salary: 3_000_000,
      fixedTotal: 600_000,
      available: 2_400_000,
      ratios: [50, 30, 10, 10],
      amounts: { living: 1_200_000, saving: 720_000, emergency: 240_000, leisure: 240_000 },
    },
    createdAt: CREATED,
    updatedAt: CREATED,
    ...extra,
  };
}

function seed(records: Record<string, unknown> | string) {
  localStorage.setItem(RECORDS_KEY, typeof records === "string" ? records : JSON.stringify({ version: 1, records }));
}

function renderHistory() {
  return render(React.createElement(MemoryRouter, { initialEntries: ["/history"] }, React.createElement(History)));
}

const rowTexts = () => screen.queryAllByTestId("month-row").map((r) => r.textContent ?? "");

beforeEach(() => {
  // 2026-09-29 (로컬) — 이번 달은 2026-09
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 29, 9, 0, 0));
  mockNavigate.mockClear();
  mockLocation.pathname = "/history";
  mockLocation.state = null;
});

afterEach(() => {
  mockLocation.pathname = "/";
  vi.restoreAllMocks();
});

describe("이행 기록 화면 (/history)", () => {
  it("AC-1[P0]: 07:100·08:50·09:75 기록이면 month-row 3개가 9월→8월→7월 순이고 오른쪽 값은 75%·50%·100%다", () => {
    // 저장 순서를 뒤섞어도 화면은 최신 월부터다
    seed({ "2026-07": record("2026-07", 100), "2026-09": record("2026-09", 75), "2026-08": record("2026-08", 50) });
    renderHistory();

    const rows = screen.getAllByTestId("month-row");
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain("2026년 9월");
    expect(rows[0].textContent).toContain("75%");
    expect(rows[1].textContent).toContain("2026년 8월");
    expect(rows[1].textContent).toContain("50%");
    expect(rows[2].textContent).toContain("2026년 7월");
    expect(rows[2].textContent).toContain("100%");
    expect(rows.map((r) => within(r).getByRole("progressbar").getAttribute("aria-valuenow"))).toEqual(["75", "50", "100"]);
  });

  it("AC-1[P0]: '완료' Badge는 100%인 7월 행에만 있다", () => {
    seed({ "2026-07": record("2026-07", 100), "2026-08": record("2026-08", 50), "2026-09": record("2026-09", 75) });
    renderHistory();

    const [sep, aug, jul] = screen.getAllByTestId("month-row");
    expect(within(jul).getByText("완료")).toBeInTheDocument();
    expect(within(sep).queryByText("완료")).toBeNull();
    expect(within(aug).queryByText("완료")).toBeNull();
    expect(screen.getAllByText("완료")).toHaveLength(1);
  });

  it("AC-1[P0]: 시각이 2026-09-29이면 history-hero의 라벨은 '이번 달 이행률'이고 value는 75다", () => {
    seed({ "2026-07": record("2026-07", 100), "2026-08": record("2026-08", 50), "2026-09": record("2026-09", 75) });
    renderHistory();

    const hero = screen.getByTestId("history-hero");
    expect(hero.textContent).toContain("이번 달 이행률");
    expect(within(hero).getByTestId("count-up").getAttribute("data-value")).toBe("75");
    expect(screen.queryByText("이번 달은 아직 체크 전이에요")).toBeNull();
  });

  it.each([
    ["키가 없을 때", null],
    ["records가 비었을 때", JSON.stringify({ version: 1, records: {} })],
    ["저장값이 '{broken'일 때", "{broken"],
  ])("AC-2[P0]: 기록이 0개이거나 손상됐으면(%s) 빈 상태만 보이고 month-row 0개·console.error 0회다", (_name, raw) => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    if (raw !== null) seed(raw);
    renderHistory();

    expect(screen.getByText("아직 기록이 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이번 달 체크하러 가기" })).toBeInTheDocument();
    expect(screen.queryAllByTestId("month-row")).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalledTimes(0);
  });

  it("AC-2[P0]: '이번 달 체크하러 가기'를 탭하면 navigate('/')가 state 없이 한 번 호출된다", () => {
    seed("{broken");
    renderHistory();
    expect(mockNavigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "이번 달 체크하러 가기" }));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("AC-3[P0]: 8월 기록만 있으면 hero value는 0이고 '이번 달은 아직 체크 전이에요'가 보이며 8월 행은 50%다", () => {
    seed({ "2026-08": record("2026-08", 50) });
    renderHistory();

    const hero = screen.getByTestId("history-hero");
    expect(within(hero).getByTestId("count-up").getAttribute("data-value")).toBe("0");
    expect(screen.getByText("이번 달은 아직 체크 전이에요")).toBeInTheDocument();
    expect(screen.queryByText("아직 기록이 없어요")).toBeNull();
    const rows = rowTexts();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("2026년 8월");
    expect(rows[0]).toContain("50%");
  });

  it("AC-4[P0]: 8월이 rate '50'(문자열)이면 행은 2개(9월 75%·7월 100%)이고 hero는 75이며 마운트 후 setItem은 0회다", () => {
    seed({
      "2026-07": record("2026-07", 100),
      "2026-08": record("2026-08", 50, { rate: "50" }),
      "2026-09": record("2026-09", 75),
    });
    const before = localStorage.getItem(RECORDS_KEY);
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    renderHistory();

    const rows = rowTexts();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("2026년 9월");
    expect(rows[0]).toContain("75%");
    expect(rows[1]).toContain("2026년 7월");
    expect(rows[1]).toContain("100%");
    expect(rows.join("")).not.toContain("2026년 8월");
    expect(within(screen.getByTestId("history-hero")).getByTestId("count-up").getAttribute("data-value")).toBe("75");
    expect(setItemSpy).toHaveBeenCalledTimes(0);
    expect(localStorage.getItem(RECORDS_KEY)).toBe(before);
  });

  it("AC-4[P0]: planId가 'plan_deleted'인 레코드와 레거시 레코드(id·planId·createdAt 없음)는 행 2개로 50%·100%를 표시한다", () => {
    const legacy: Record<string, unknown> = record("2026-07", 100);
    delete legacy.id;
    delete legacy.planId;
    delete legacy.createdAt;
    seed({ "2026-07": legacy, "2026-08": record("2026-08", 50, { planId: "plan_deleted" }) });
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    renderHistory();

    const rows = rowTexts();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("2026년 8월");
    expect(rows[0]).toContain("50%");
    expect(rows[1]).toContain("2026년 7월");
    expect(rows[1]).toContain("100%");
    expect(setItemSpy).toHaveBeenCalledTimes(0);
  });

  it("AC-5[P1]: AdSlot은 마지막 month-row 뒤에 1개, 목록 끝은 Spacing 80이고 그 아래가 하단 탭(홈·기록)이다", () => {
    seed({ "2026-07": record("2026-07", 100), "2026-08": record("2026-08", 50), "2026-09": record("2026-09", 75) });
    renderHistory();

    const rows = screen.getAllByTestId("month-row");
    const ads = screen.getAllByTestId("ad-slot");
    expect(ads).toHaveLength(1);
    expect(rows[rows.length - 1].compareDocumentPosition(ads[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const spacer = document.querySelector('[data-spacing="80"]');
    expect(spacer).not.toBeNull();
    expect(ads[0].compareDocumentPosition(spacer!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const next = spacer!.nextElementSibling;
    expect(next === null || next.getAttribute("role") === "tablist").toBe(true);

    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual(["홈", "기록"]);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("AC-5[P1]: History.tsx에는 overflow·react-window·react-virtual이 없다(가상화·자체 스크롤 금지)", () => {
    const src = readFileSync(resolve(__dirname, "../pages/History.tsx"), "utf8");

    expect(src).not.toMatch(/overflow|react-window|react-virtual/);
    expect(src).not.toContain("@ai-factory:placeholder");
    expect(src).toContain("month-row");
  });
});
