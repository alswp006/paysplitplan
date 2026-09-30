import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import History from "@/pages/History";
import { PLAN_KEY, RECORDS_KEY } from "@/lib/storage";

mockAll();

// hero의 value prop(이행률)을 직접 볼 수 있게 CountUp만 대역으로 바꾼다.
vi.mock("@/components/CountUp", async () => {
  const R = await import("react");
  return {
    CountUp: ({ value, unit }: { value: number; unit?: string }) =>
      R.createElement("span", { "data-testid": "count-up", "data-value": String(value) }, `${value}${unit ?? ""}`),
  };
});

vi.mock("@/components/AdSlot", async () => {
  const R = await import("react");
  return { AdSlot: () => R.createElement("div", { "data-testid": "ad-slot" }) };
});

const TS = "2026-09-01T00:00:00.000Z";

function record(month: string, rate: number) {
  const on = Math.round((rate / 100) * 4);
  return {
    id: `rec_${month}`,
    planId: "plan_a",
    month,
    checked: { living: on > 0, saving: on > 1, emergency: on > 2, leisure: on > 3 },
    eligible: ["living", "saving", "emergency", "leisure"],
    rate,
    completedAt: rate === 100 ? TS : null,
    snapshot: {
      salary: 3_000_000,
      fixedTotal: 600_000,
      available: 2_400_000,
      ratios: [50, 30, 10, 10],
      amounts: { living: 1_200_000, saving: 720_000, emergency: 240_000, leisure: 240_000 },
    },
    createdAt: TS,
    updatedAt: TS,
  };
}

const plan5311 = {
  version: 1,
  id: "plan_a",
  salary: 3_000_000,
  fixedCosts: [{ id: "fc_rent", name: "월세", amount: 600_000, createdAt: TS, updatedAt: TS }],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
  createdAt: TS,
  updatedAt: TS,
};

// 60/30/10/0 계획일 때 저장된 9월 기록: 3/3 · 100%(여가는 대상 밖)
const septOld3of3 = {
  ...record("2026-09", 100),
  checked: { living: true, saving: true, emergency: true, leisure: false },
  eligible: ["living", "saving", "emergency"],
  snapshot: {
    salary: 3_000_000,
    fixedTotal: 600_000,
    available: 2_400_000,
    ratios: [60, 30, 10, 0],
    amounts: { living: 1_440_000, saving: 720_000, emergency: 240_000, leisure: 0 },
  },
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 29, 9, 0, 0));
  mockNavigate.mockClear();
});

describe("History 화면", () => {
  it("최신 월부터 행을 보여주고 100%인 행에만 '완료'가 붙는다", () => {
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ version: 1, records: { "2026-07": record("2026-07", 100), "2026-09": record("2026-09", 75) } }),
    );
    renderWithRouter(<History />, { initialEntries: ["/history"] });

    const rows = screen.getAllByTestId("month-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("2026년 9월");
    expect(rows[1].textContent).toContain("2026년 7월");
    expect(screen.getAllByText("완료")).toHaveLength(1);
  });

  it("N12: 월 행 — '완료' 배지는 월 이름 옆(top)에, 아랫줄은 'N개 중 M개 옮겼어요', 목록은 카드 한 장 안에 있다", () => {
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ version: 1, records: { "2026-07": record("2026-07", 100), "2026-09": record("2026-09", 75) } }),
    );
    renderWithRouter(<History />, { initialEntries: ["/history"] });

    const [sep, jul] = screen.getAllByTestId("month-row");
    expect(jul.querySelector('[data-slot="top"]')?.textContent).toBe("2026년 7월 완료");
    expect(jul.querySelector('[data-slot="right"]')?.textContent).toBe("100%");
    expect(sep.querySelector('[data-slot="bottom"]')?.textContent).toBe("4개 중 3개 옮겼어요");
    expect(within(screen.getByTestId("month-list")).getAllByTestId("month-row")).toHaveLength(2);
  });

  it("N2: 계획(50/30/10/10)이 있으면 이번 달은 저장된 100%가 아니라 현재 계획으로 다시 센 75%다 — 홈과 같은 숫자", () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan5311));
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, records: { "2026-09": septOld3of3 } }));
    renderWithRouter(<History />, { initialEntries: ["/history"] });

    const hero = screen.getByTestId("history-hero");
    expect(within(hero).getByTestId("count-up").getAttribute("data-value")).toBe("75");
    const [sep] = screen.getAllByTestId("month-row");
    expect(sep.textContent).toContain("75%");
    expect(sep.textContent).toContain("4개 중 3개");
    expect(screen.queryAllByText("완료")).toHaveLength(0);
  });

  it("계획 원문이 '{broken'이어도 마운트 후 setItem은 0회이고 원문은 그대로다(기록 화면은 쓰지 않는다)", () => {
    localStorage.setItem(PLAN_KEY, "{broken");
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, records: { "2026-09": record("2026-09", 75) } }));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    renderWithRouter(<History />, { initialEntries: ["/history"] });

    expect(screen.getAllByTestId("month-row")).toHaveLength(1);
    expect(setItem).toHaveBeenCalledTimes(0);
    expect(removeItem).toHaveBeenCalledTimes(0);
    expect(localStorage.getItem(PLAN_KEY)).toBe("{broken");
    setItem.mockRestore();
    removeItem.mockRestore();
  });

  it("07·08·09월이 모두 100%면 히어로 캡션에 연속 기록, 목록 위에 저축·비상금으로 옮긴 돈 합계가 보인다", () => {
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({
        version: 1,
        records: { "2026-07": record("2026-07", 100), "2026-08": record("2026-08", 100), "2026-09": record("2026-09", 100) },
      }),
    );
    renderWithRouter(<History />, { initialEntries: ["/history"] });

    expect(screen.getByTestId("history-hero").textContent).toContain("3개월 연속 지켰어요 · 가장 긴 기록 3개월");
    const moved = screen.getByTestId("moved-total");
    expect(moved.textContent).toContain("저축·비상금 통장에 옮긴 돈");
    expect(within(moved).getByText("2,880,000원")).toBeInTheDocument(); // 3 × (720,000 + 240,000)
    expect(moved.textContent).toContain("직접 체크한 이체 기준이에요 · 최근 24개월");
    // 증거 카드는 히어로와 월 목록 사이에 있다
    const firstRow = screen.getAllByTestId("month-row")[0];
    expect(moved.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("옮긴 돈이 0원이면 증거 카드가 없고, 100%인 달이 없으면 연속 기록 캡션도 없다", () => {
    const none = { ...record("2026-09", 0), checked: { living: false, saving: false, emergency: false, leisure: false } };
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ version: 1, records: { "2026-09": none } }),
    );
    renderWithRouter(<History />, { initialEntries: ["/history"] });
    expect(screen.queryByTestId("moved-total")).toBeNull();
    expect(screen.getByTestId("history-hero").textContent).not.toContain("가장 긴 기록");
  });

  it("6월 100% · 9월 50%면 캡션은 '가장 긴 기록 1개월'이다", () => {
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ version: 1, records: { "2026-06": record("2026-06", 100), "2026-09": record("2026-09", 50) } }),
    );
    renderWithRouter(<History />, { initialEntries: ["/history"] });
    const hero = screen.getByTestId("history-hero");
    expect(hero.textContent).toContain("가장 긴 기록 1개월");
    expect(hero.textContent).not.toContain("연속");
  });

  it("기록이 없으면 빈 상태를 보여주고 버튼이 홈으로 이동한다", () => {
    renderWithRouter(<History />, { initialEntries: ["/history"] });

    expect(screen.getByText("아직 기록이 없어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이번 달 체크하러 가기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
