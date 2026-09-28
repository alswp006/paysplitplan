import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockRouter, mockOpenToast } from "@/__tests__/__helpers__/mocks";
import { ChecklistCard } from "@/components/home/ChecklistCard";
import { buildChecklist, isCompletionTransition } from "@/lib/homeView";
import { loadRecords, PLAN_KEY, RECORDS_KEY } from "@/lib/storage";
import type { CategoryKey, MonthRecord, RecordStore, SalaryPlan } from "@/lib/types";

mockTds();
mockAppsInToss();
mockRouter();

// ── 계약 (Coder가 이 시그니처대로 만든다) ──
// src/lib/homeView.ts
//   buildChecklist(plan: SalaryPlan, store: RecordStore, today: Date): {
//     rows: { key: CategoryKey; label: string; amount: number; checked: boolean }[];  // amounts[key] > 0 인 것만, CATEGORY_ORDER 순
//     checkedCount: number;   // rows 중 checked인 개수 (분자 c)
//     total: number;          // rows.length (분모 m)
//     percent: number;        // total === 0 ? 0 : Math.round(c / m * 100)
//     progressText: string;   // `${c}/${m} 완료 · ${p}%`
//   }
//   - label은 '생활비 통장' / '저축 통장' / '비상금 통장' / '여가 통장'
//   - 이번 달 = monthKey(today). 기록이 없으면 전부 false. 저장된 record.eligible / record.rate / record.planId는 쓰지 않는다.
//   isCompletionTransition(prevPercent: number, nextPercent: number): boolean   // prev < 100 && next === 100
// src/components/home/ChecklistCard.tsx
//   export function ChecklistCard({ plan }: { plan: SalaryPlan })
//   - 행: ListRow data-testid="checklist-row" (onClick으로 행 전체 탭 = 토글), 오른쪽 Switch aria-label "{통장명} 이체 완료"
//     예) "저축 통장 이체 완료". 행 안에 통장명과 금액("720,000원")이 보인다.
//   - Switch 자체를 눌러도, 행을 눌러도 toggleRecordItem(key, !checked)은 정확히 1회 (버블링으로 2회 호출 금지)
//   - data-testid="progress-text"에 progressText

const { logClick, requestReviewOnce, toggleSpy } = vi.hoisted(() => ({
  logClick: vi.fn(),
  requestReviewOnce: vi.fn(),
  toggleSpy: vi.fn(),
}));

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  logClick,
}));
vi.mock("@/lib/review", () => ({ requestReviewOnce }));
vi.mock("@/lib/recordToggle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/recordToggle")>();
  toggleSpy.mockImplementation(actual.toggleRecordItem);
  return { ...actual, toggleRecordItem: toggleSpy };
});

const CREATED = "2026-09-01T00:00:00.000Z";
const SEPT = "2026-09-29T02:00:00.000Z";
const OCT = "2026-10-01T12:00:00.000Z";
const COMPLETE_TOAST = "이번 달 통장 쪼개기 완료!";
const FAIL_TOAST = "저장하지 못했어요. 다시 시도해주세요";

const fixedRent = { id: "fc_rent", name: "월세", amount: 600_000, createdAt: CREATED, updatedAt: CREATED };

// 예시 A: 300만 원 − 고정비 60만 원 = 240만 원 → 1,200,000 / 720,000 / 240,000 / 240,000
const planA: SalaryPlan = {
  version: 1,
  id: "plan_a",
  salary: 3_000_000,
  fixedCosts: [fixedRent],
  presetId: "p532",
  ratios: [50, 30, 10, 10],
  payday: 25,
  createdAt: CREATED,
  updatedAt: CREATED,
};
// 60:30:10:0 → 여가 금액 0원
const planNoLeisure: SalaryPlan = { ...planA, presetId: "custom", ratios: [60, 30, 10, 0] };
// F6-AC-9: 1,234,567원, 고정비 없음, 0:50:30:20 → 생활비 1원
const planTiny: SalaryPlan = { ...planA, salary: 1_234_567, fixedCosts: [], presetId: "custom", ratios: [0, 50, 30, 20] };

const KEYS: CategoryKey[] = ["living", "saving", "emergency", "leisure"];

function makeRecord(month: string, checked: boolean[], extra: Partial<MonthRecord> = {}): MonthRecord {
  return {
    id: "rec_" + month,
    planId: "plan_a",
    month,
    checked: { living: checked[0], saving: checked[1], emergency: checked[2], leisure: checked[3] },
    eligible: [...KEYS],
    rate: 75,
    completedAt: null,
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

function storeOf(...records: MonthRecord[]): RecordStore {
  return { version: 1, records: Object.fromEntries(records.map((r) => [r.month, r])) };
}

function seed(plan: SalaryPlan, ...records: MonthRecord[]) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  if (records.length > 0) localStorage.setItem(RECORDS_KEY, JSON.stringify(storeOf(...records)));
}

function setClock(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

beforeEach(() => {
  setClock(SEPT);
  toggleSpy.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderCard(plan: SalaryPlan) {
  return render(React.createElement(MemoryRouter, null, React.createElement(ChecklistCard, { plan })));
}

const sw = (name: string) => screen.getByRole("switch", { name: `${name} 이체 완료` }) as HTMLInputElement;
const progress = () => screen.getByTestId("progress-text").textContent;
const toasts = () => mockOpenToast.mock.calls.map((c) => c[0]);
const rows = () => screen.getAllByTestId("checklist-row");

describe("홈 이체 체크리스트 카드 — homeView 순수 함수", () => {
  it("AC-1[P0]: buildChecklist는 예시 A 기록 없음에서 4행(생활비·저축·비상금·여가)과 '0/4 완료 · 0%'를 만든다", () => {
    const view = buildChecklist(planA, storeOf(), new Date(SEPT));

    expect(view.rows).toEqual([
      { key: "living", label: "생활비 통장", amount: 1_200_000, checked: false },
      { key: "saving", label: "저축 통장", amount: 720_000, checked: false },
      { key: "emergency", label: "비상금 통장", amount: 240_000, checked: false },
      { key: "leisure", label: "여가 통장", amount: 240_000, checked: false },
    ]);
    expect(view.checkedCount).toBe(0);
    expect(view.total).toBe(4);
    expect(view.percent).toBe(0);
    expect(view.progressText).toBe("0/4 완료 · 0%");
  });

  it("AC-3[P0]: 금액 0원 카테고리는 행에서 빠지고, 저장된 eligible·rate(75)가 아니라 현재 계획으로 2/3 · 67%를 센다", () => {
    const stale = makeRecord("2026-09", [true, true, false, true], { rate: 75 });
    const view = buildChecklist(planNoLeisure, storeOf(stale), new Date(SEPT));

    expect(view.rows.map((r) => r.key)).toEqual(["living", "saving", "emergency"]);
    expect(view.rows.map((r) => r.checked)).toEqual([true, true, false]);
    expect(view.total).toBe(3);
    expect(view.checkedCount).toBe(2);
    expect(view.percent).toBe(67);
    expect(view.progressText).toBe("2/3 완료 · 67%");
  });

  it("AC-5[P1]: 월이 바뀌면 지난달 4/4 기록은 무시하고 0/4 · 0%다. 생활비 비율 0이어도 잔액 1원이면 '생활비 통장'이 amount 1로 남는다", () => {
    const septDone = makeRecord("2026-09", [true, true, true, true], { rate: 100 });
    const october = buildChecklist(planA, storeOf(septDone), new Date(OCT));
    expect(october.rows.every((r) => r.checked === false)).toBe(true);
    expect(october.progressText).toBe("0/4 완료 · 0%");

    const tiny = buildChecklist(planTiny, storeOf(), new Date(SEPT));
    expect(tiny.rows).toHaveLength(4);
    expect(tiny.rows[0]).toEqual({ key: "living", label: "생활비 통장", amount: 1, checked: false });
    expect(tiny.rows.map((r) => r.amount)).toEqual([1, 617_283, 370_370, 246_913]);
  });

  it("AC-2[P0]: isCompletionTransition은 100 미만에서 100이 되는 순간에만 true다", () => {
    expect(isCompletionTransition(75, 100)).toBe(true);
    expect(isCompletionTransition(0, 100)).toBe(true);
    expect(isCompletionTransition(100, 75)).toBe(false);
    expect(isCompletionTransition(100, 100)).toBe(false);
    expect(isCompletionTransition(50, 75)).toBe(false);
  });
});

describe("홈 이체 체크리스트 카드 (ChecklistCard)", () => {
  it("AC-1[P0]: 저축 Switch를 켜면 '1/4 완료 · 25%', planId 'plan_a'로 저장되고 logClick('checklist_toggle')은 1회다", async () => {
    seed(planA);
    renderCard(planA);

    expect(rows()).toHaveLength(4);
    expect(progress()).toBe("0/4 완료 · 0%");
    const savingRow = rows().find((r) => /저축 통장/.test(r.textContent ?? ""));
    expect(savingRow?.textContent).toMatch(/720,000원/);

    fireEvent.click(sw("저축 통장"));

    await waitFor(() => expect(progress()).toBe("1/4 완료 · 25%"));
    expect(sw("저축 통장").checked).toBe(true);
    const record = loadRecords().records["2026-09"];
    expect(record.checked.saving).toBe(true);
    expect(record.rate).toBe(25);
    expect(record.planId).toBe("plan_a");
    expect(logClick.mock.calls.filter((c) => c[0] === "checklist_toggle")).toHaveLength(1);
    expect(toggleSpy).toHaveBeenCalledTimes(1);
    expect(toggleSpy).toHaveBeenCalledWith("saving", true);
    expect(toasts()).toEqual([]);
  });

  it("AC-1[P0]: 행 영역을 1회 탭해도, Switch를 직접 1회 눌러도 toggleRecordItem은 각각 정확히 1회다(버블링 중복 없음)", async () => {
    seed(planA);
    renderCard(planA);

    const savingRow = rows().find((r) => /저축 통장/.test(r.textContent ?? ""))!;
    fireEvent.click(savingRow);

    await waitFor(() => expect(progress()).toBe("1/4 완료 · 25%"));
    expect(toggleSpy).toHaveBeenCalledTimes(1);
    expect(toggleSpy).toHaveBeenCalledWith("saving", true);
    expect(sw("저축 통장").checked).toBe(true);

    toggleSpy.mockClear();
    fireEvent.click(sw("비상금 통장"));

    await waitFor(() => expect(progress()).toBe("2/4 완료 · 50%"));
    expect(toggleSpy).toHaveBeenCalledTimes(1);
    expect(toggleSpy).toHaveBeenCalledWith("emergency", true);
  });

  it("AC-2[P0]: 4개를 모두 켜면 완료 Toast 1회 + requestReviewOnce, 이후 하나를 끄면 '3/4 완료 · 75%'이고 Toast는 늘지 않는다", async () => {
    seed(planA);
    renderCard(planA);

    for (const name of ["생활비 통장", "저축 통장", "비상금 통장"]) fireEvent.click(sw(name));
    await waitFor(() => expect(progress()).toBe("3/4 완료 · 75%"));
    expect(toasts()).toEqual([]);
    expect(requestReviewOnce).toHaveBeenCalledTimes(0);

    fireEvent.click(sw("여가 통장"));

    await waitFor(() => expect(progress()).toBe("4/4 완료 · 100%"));
    expect(toasts()).toEqual([COMPLETE_TOAST]);
    expect(requestReviewOnce).toHaveBeenCalledTimes(1);
    const done = loadRecords().records["2026-09"];
    expect(done.rate).toBe(100);
    expect(typeof done.completedAt).toBe("string");

    fireEvent.click(sw("저축 통장"));

    await waitFor(() => expect(progress()).toBe("3/4 완료 · 75%"));
    expect(toasts()).toEqual([COMPLETE_TOAST]);
    expect(requestReviewOnce).toHaveBeenCalledTimes(1);
    const undone = loadRecords().records["2026-09"];
    expect(undone.rate).toBe(75);
    expect(undone.completedAt).toBeNull();
    expect(undone.id).toBe(done.id);
    expect(undone.createdAt).toBe(done.createdAt);
  });

  it("AC-3[P0]: 60:30:10:0 계획은 행 3개(여가 없음), 기록 {T,T,F,T}로 마운트하면 '2/3 완료 · 67%'이고 setItem은 0회, 비상금을 켜면 '3/3 완료 · 100%'와 완료 Toast 1회", async () => {
    seed(planNoLeisure, makeRecord("2026-09", [true, true, false, true]));
    const before = localStorage.getItem(RECORDS_KEY);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    renderCard(planNoLeisure);

    expect(rows()).toHaveLength(3);
    expect(screen.queryByRole("switch", { name: "여가 통장 이체 완료" })).toBeNull();
    expect(sw("생활비 통장").checked).toBe(true);
    expect(sw("저축 통장").checked).toBe(true);
    expect(sw("비상금 통장").checked).toBe(false);
    expect(progress()).toBe("2/3 완료 · 67%");
    expect(setItem).toHaveBeenCalledTimes(0);
    expect(localStorage.getItem(RECORDS_KEY)).toBe(before);
    expect(toasts()).toEqual([]);

    fireEvent.click(sw("비상금 통장"));

    await waitFor(() => expect(progress()).toBe("3/3 완료 · 100%"));
    expect(toasts()).toEqual([COMPLETE_TOAST]);
    expect(requestReviewOnce).toHaveBeenCalledTimes(1);
    const record = loadRecords().records["2026-09"];
    expect(record.eligible).toEqual(["living", "saving", "emergency"]);
    expect(record.rate).toBe(100);
  });

  it("AC-4[P1]: setItem이 QuotaExceededError를 던지면 저축 Switch는 꺼진 채로 돌아가고 progress-text는 그대로, 실패 Toast가 뜨며 완료 처리(리뷰)는 없다", async () => {
    seed(planA);
    renderCard(planA);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });

    fireEvent.click(sw("저축 통장"));

    await waitFor(() => expect(toasts()).toEqual([FAIL_TOAST]));
    expect(toggleSpy).toHaveBeenCalledTimes(1);
    expect(sw("저축 통장").checked).toBe(false);
    expect(progress()).toBe("0/4 완료 · 0%");
    expect(requestReviewOnce).toHaveBeenCalledTimes(0);
    expect(loadRecords().records["2026-09"]).toBeUndefined();
  });

  it("AC-5[P1]: 시각이 2026-10-01이고 9월이 4/4 완료면 Switch가 모두 꺼져 있고 '0/4 완료 · 0%'이며 9월 기록은 그대로다", () => {
    seed(planA, makeRecord("2026-09", [true, true, true, true], { rate: 100, completedAt: SEPT }));
    const before = localStorage.getItem(RECORDS_KEY);
    setClock(OCT);

    renderCard(planA);

    expect(screen.getAllByRole("switch")).toHaveLength(4);
    for (const s of screen.getAllByRole("switch")) expect((s as HTMLInputElement).checked).toBe(false);
    expect(progress()).toBe("0/4 완료 · 0%");
    expect(localStorage.getItem(RECORDS_KEY)).toBe(before);
    expect(toasts()).toEqual([]);
  });

  it("AC-5[P1]: F6-AC-9 계획(생활비 비율 0, 잔액 1원)은 행 4개이고 그중 '생활비 통장 · 1원'이 있다", () => {
    seed(planTiny);

    renderCard(planTiny);

    expect(rows()).toHaveLength(4);
    const living = rows().find((r) => /생활비 통장/.test(r.textContent ?? ""))!;
    expect(living.textContent).toMatch(/생활비 통장.*1원/);
    expect(living.textContent).not.toMatch(/1,\d{3}원|\d{2,}원/);
    expect(progress()).toBe("0/4 완료 · 0%");
  });
});
