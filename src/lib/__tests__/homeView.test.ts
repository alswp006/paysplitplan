import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildChecklist, calculateChecklistStatus, isCompletionTransition } from "@/lib/homeView";
import type { MonthRecord, RecordStore, SalaryPlan } from "@/lib/types";

const TS = "2026-09-01T00:00:00.000Z";
const TODAY = new Date("2026-09-29T02:00:00.000Z");

const plan: SalaryPlan = {
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

function storeWith(month: string, checked: [boolean, boolean, boolean, boolean]): RecordStore {
  const record: MonthRecord = {
    id: "rec_" + month,
    planId: "plan_a",
    month,
    checked: { living: checked[0], saving: checked[1], emergency: checked[2], leisure: checked[3] },
    eligible: ["living", "saving", "emergency", "leisure"],
    rate: 0,
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
  return { version: 1, records: { [month]: record } };
}

describe("buildChecklist", () => {
  it("기록이 없으면 4행이 모두 꺼져 있고 진행 문구는 0/4 완료 · 0%다", () => {
    const view = buildChecklist(plan, { version: 1, records: {} }, TODAY);
    expect(view.rows.map((r) => r.label)).toEqual(["생활비 통장", "저축 통장", "비상금 통장", "여가 통장"]);
    expect(view.progressText).toBe("0/4 완료 · 0%");
  });

  it("이번 달 기록의 체크만 센다", () => {
    const view = buildChecklist(plan, storeWith("2026-09", [true, false, true, false]), TODAY);
    expect(view.checkedCount).toBe(2);
    expect(view.progressText).toBe("2/4 완료 · 50%");
  });

  it("다른 달 기록은 무시한다", () => {
    const view = buildChecklist(plan, storeWith("2026-08", [true, true, true, true]), TODAY);
    expect(view.percent).toBe(0);
  });

  it("행이 하나도 없으면 percent는 0이다", () => {
    const empty = buildChecklist({ ...plan, salary: 500_000 }, { version: 1, records: {} }, TODAY);
    expect(empty.total).toBe(0);
    expect(empty.progressText).toBe("0/0 완료 · 0%");
  });
});

describe("isCompletionTransition", () => {
  it("100 미만에서 100이 될 때만 true다", () => {
    expect(isCompletionTransition(75, 100)).toBe(true);
    expect(isCompletionTransition(100, 100)).toBe(false);
    expect(isCompletionTransition(100, 75)).toBe(false);
  });
});

describe("calculateChecklistStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TODAY);
  });

  it("이번 달 기록의 체크를 완료 수와 항목으로 돌려준다", () => {
    const records = Object.values(storeWith("2026-09", [true, false, true, false]).records);
    const status = calculateChecklistStatus(plan, records);
    expect(status.completed).toBe(2);
    expect(status.total).toBe(4);
    expect(status.items).toEqual([
      { id: "living", label: "생활비 통장", done: true },
      { id: "saving", label: "저축 통장", done: false },
      { id: "emergency", label: "비상금 통장", done: true },
      { id: "leisure", label: "여가 통장", done: false },
    ]);
  });

  it("기록이 없거나 다른 달이면 모두 미완료다", () => {
    expect(calculateChecklistStatus(plan, []).completed).toBe(0);
    const old = Object.values(storeWith("2026-08", [true, true, true, true]).records);
    expect(calculateChecklistStatus(plan, old).completed).toBe(0);
  });
});
