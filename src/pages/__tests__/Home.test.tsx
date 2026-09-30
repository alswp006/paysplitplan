import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { mockAll, mockOpenToast } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import Home from "@/pages/Home";
import { PLAN_KEY, RECORDS_KEY } from "@/lib/storage";

mockAll();

const TS = "2026-09-01T00:00:00.000Z";
const planA = {
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
const sept3of4 = {
  id: "rec_2026-09",
  planId: "plan_a",
  month: "2026-09",
  checked: { living: true, saving: true, emergency: true, leisure: false },
  eligible: ["living", "saving", "emergency", "leisure"],
  rate: 75,
  completedAt: null,
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 29, 9));
});

describe("Home 히어로 — 체크에 바로 반응한다", () => {
  it("3/4에서 마지막 스위치를 켜면 히어로가 '9월 이체 · 1개 남았어요' → '9월 이체 완료'가 되고 완료 토스트는 CTA 위로 뜬다", async () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(planA));
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, records: { "2026-09": sept3of4 } }));
    renderWithRouter(<Home />);

    const hero = screen.getByTestId("dday-hero");
    expect(hero.textContent).toContain("9월 이체");
    expect(hero.textContent).toContain("1개 남았어요");
    expect(hero.textContent).toContain("10월 25일 월급날까지 D-26");

    fireEvent.click(within(screen.getByTestId("checklist-card")).getByRole("switch", { name: "여가 통장 이체 완료" }));

    await waitFor(() => expect(screen.getByTestId("dday-hero").textContent).toContain("9월 이체 완료"));
    expect(screen.getByTestId("dday-hero").textContent).toContain("계획대로 옮겼어요");
    expect(mockOpenToast).toHaveBeenCalledWith("9월 이체를 모두 체크했어요", { higherThanCTA: true });
  });

  it("Top 제목은 앱 이름 '월급쪼개기'다", () => {
    renderWithRouter(<Home />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("월급쪼개기");
  });

  it("시그니처 막대(split-strip)는 체크한 통장만 채운다 — 스위치를 켜면 바로 따라온다", async () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(planA));
    renderWithRouter(<Home />);

    const filled = () =>
      Array.from(screen.getByTestId("split-strip").querySelectorAll('[data-filled="true"]')).map(
        (el) => (el as HTMLElement).dataset.key,
      );
    expect(screen.getAllByTestId("split-segment")).toHaveLength(4);
    expect(filled()).toEqual([]);

    const card = within(screen.getByTestId("checklist-card"));
    fireEvent.click(card.getByRole("switch", { name: "저축 통장 이체 완료" }));
    await waitFor(() => expect(filled()).toEqual(["saving"]));
    fireEvent.click(card.getByRole("switch", { name: "비상금 통장 이체 완료" }));
    await waitFor(() => expect(filled()).toEqual(["saving", "emergency"]));
    expect(screen.getByRole("img", { name: "이번 달 이체: 생활비 남음, 저축 옮김, 비상금 옮김, 여가 남음" })).toBeTruthy();
  });

  it("체크리스트 행마다 통장 배지(장식)가 있다", () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(planA));
    renderWithRouter(<Home />);
    const rows = screen.getAllByTestId("checklist-row");
    expect(rows.map((r) => r.querySelector('[data-testid="category-badge"]')?.getAttribute("data-kind"))).toEqual([
      "living",
      "saving",
      "emergency",
      "leisure",
    ]);
  });

  it("빈 홈은 예시 막대(example-split)로 이 앱이 하는 일을 먼저 보여 준다", () => {
    renderWithRouter(<Home />);
    const example = screen.getByTestId("example-split");
    expect(example.textContent).toContain("예시 · 월급 300만 원, 고정비 60만 원, 기본 5:3:1:1");
    expect(within(example).getAllByTestId("split-segment")).toHaveLength(5);
    expect(screen.getByText("통장별 금액을 정하고, 은행 앱에 붙여 넣고, 월급날마다 체크해요")).toBeTruthy();
  });
});

describe("홈 세팅 넛지 — 고도화 0930 리뷰 수정", () => {
  const SETUP_KEY = "paysplit:setup:v1";
  // 시드 A 서명: 월급날 25 | 1,200,000 | 720,000 | 240,000 | 240,000
  const SIG_A = "25|1200000|720000|240000|240000";

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 29, 9));
    localStorage.setItem(PLAN_KEY, JSON.stringify(planA));
  });

  it("일부만 복사했으면 '세팅표 4개 중 N개 복사했어요'로 말한다", () => {
    localStorage.setItem(SETUP_KEY, JSON.stringify({ version: 1, signature: SIG_A, copiedKeys: ["living", "saving", "emergency"], copiedAt: TS }));
    renderWithRouter(<Home />);
    expect(screen.getByTestId("setup-nudge").textContent).toContain("세팅표 4개 중 3개 복사했어요");
  });

  it("복사한 금액과 지금 계획이 다르면 '계획이 바뀌었다'고 단정하지 않는다(저장 안 한 초안을 복사했을 수 있다)", () => {
    localStorage.setItem(SETUP_KEY, JSON.stringify({ version: 1, signature: "25|1|2|3|4", copiedKeys: ["living"], copiedAt: TS }));
    renderWithRouter(<Home />);
    const nudge = screen.getByTestId("setup-nudge");
    expect(nudge.textContent).toContain("은행에 넣은 금액과 지금 계획이 달라요");
    expect(nudge.textContent).not.toContain("계획이 바뀌었어요");
  });

  it("'이미 넣었어요'를 누르면 넛지가 사라지고 지금 계획을 모두 넣은 것으로 기록한다", () => {
    renderWithRouter(<Home />);
    expect(screen.getByTestId("setup-nudge").textContent).toContain("은행 세팅 전이에요");
    fireEvent.click(screen.getByRole("button", { name: "이미 넣었어요" }));
    expect(screen.queryByTestId("setup-nudge")).toBeNull();
    expect(JSON.parse(localStorage.getItem(SETUP_KEY)!)).toMatchObject({
      signature: SIG_A,
      copiedKeys: ["living", "saving", "emergency", "leisure"],
    });
  });
});
