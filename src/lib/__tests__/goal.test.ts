import { describe, it, expect, vi, beforeEach } from "vitest";
import { shiftMonth } from "@/lib/date";
import {
  GOAL_BACKUP_KEY,
  GOAL_KEY,
  adjustBalance,
  createGoal,
  foldPrunedIntoGoal,
  formatMonthsCovered,
  loadGoal,
  saveGoal,
  summarizeGoal,
  withMonths,
} from "@/lib/goal";
import { calculateAllocation, CATEGORY_ORDER } from "@/lib/plan";
import { RECORDS_KEY, loadRecords, writeMonthRecord } from "@/lib/storage";
import type { CategoryKey, EmergencyGoal, FixedCost, MonthRecord, RecordStore, SalaryPlan } from "@/lib/types";

const TS = "2026-09-01T00:00:00.000Z";
const fc = (id: string, name: string, amount: number): FixedCost => ({ id, name, amount, createdAt: TS, updatedAt: TS });

// 시드 B — 필수 지출 695,000 + 862,000 = 1,557,000 · 6개월 목표 9,342,000 · 비상금 월 215,500
const PLAN_B: SalaryPlan = {
  version: 1,
  id: "plan_b",
  salary: 2_850_000,
  fixedCosts: [fc("fc_rent", "월세", 550_000), fc("fc_phone", "통신비", 65_000), fc("fc_bus", "교통비", 80_000)],
  presetId: "p442",
  ratios: [40, 40, 10, 10],
  payday: 10,
  createdAt: TS,
  updatedAt: TS,
};

function record(plan: SalaryPlan, month: string, on: CategoryKey[]): MonthRecord {
  const { fixedTotal, available, amounts } = calculateAllocation(plan.salary, plan.fixedCosts, plan.ratios);
  const eligible = CATEGORY_ORDER.filter((k) => amounts[k] > 0);
  const checked = { living: false, saving: false, emergency: false, leisure: false };
  for (const k of on) checked[k] = true;
  const rate = Math.round((eligible.filter((k) => checked[k]).length / eligible.length) * 100);
  return {
    id: `rec_${month}`,
    planId: plan.id,
    month,
    checked,
    eligible,
    rate,
    completedAt: rate === 100 ? TS : null,
    snapshot: { salary: plan.salary, fixedTotal, available, ratios: plan.ratios, amounts },
    createdAt: TS,
    updatedAt: TS,
  };
}

function storeOf(...records: MonthRecord[]): RecordStore {
  return { version: 1, records: Object.fromEntries(records.map((r) => [r.month, r])) };
}

const today = () => new Date(2026, 8, 29, 9);
const EMPTY: RecordStore = { version: 1, records: {} };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(today());
});

describe("summarizeGoal — 시드 B, 2026-09-29", () => {
  it("목표 6개월, 체크 없음 → 모은 돈 0 · 목표 9,342,000 · 2030년 4월에 채운다", () => {
    const goal = createGoal(6, today());
    expect(goal.baseMonth).toBe("2026-08");
    const s = summarizeGoal(goal, PLAN_B, EMPTY, today());
    expect(s).toMatchObject({ essential: 1_557_000, target: 9_342_000, saved: 0, monthsCovered: 0, reachMonth: "2030-04", thisMonthAdded: 0 });
  });

  it("9월 비상금을 체크하면 215,500 · 0.1개월치 · 이번 달 +215,500 · 여전히 2030년 4월", () => {
    const s = summarizeGoal(createGoal(6, today()), PLAN_B, storeOf(record(PLAN_B, "2026-09", ["emergency"])), today());
    expect(s).toMatchObject({ saved: 215_500, monthsCovered: 0.1, reachMonth: "2030-04", thisMonthAdded: 215_500 });
  });

  it("잔액 맞추기(3,000,000) 뒤에는 이번 달 체크를 두 번 세지 않는다 → 1.9개월치 · 2029년 3월", () => {
    const store = storeOf(record(PLAN_B, "2026-09", ["emergency"]));
    const goal = adjustBalance(createGoal(6, today()), 3_000_000, today(), true);
    expect(goal.baseMonth).toBe("2026-09");
    const s = summarizeGoal(goal, PLAN_B, store, today());
    expect(s.saved).toBe(3_000_000);
    expect(s.monthsCovered).toBe(1.9);
    expect(formatMonthsCovered(s.monthsCovered!)).toBe("1.9");
    expect(s.thisMonthAdded).toBe(0);
    expect(s.reachMonth).toBe("2029-03");
  });

  it("baseBalance가 목표 이상이면 reached이고 reachMonth는 null", () => {
    const goal = adjustBalance(createGoal(6, today()), 9_342_000, today(), false);
    const s = summarizeGoal(goal, PLAN_B, EMPTY, today());
    expect(s.reached).toBe(true);
    expect(s.progress).toBe(1);
    expect(s.reachMonth).toBeNull();
  });

  it("비상금 0%면 채우는 시점을 계산하지 않는다(reachMonth null)", () => {
    const noEmergency: SalaryPlan = { ...PLAN_B, ratios: [50, 40, 0, 10] };
    const s = summarizeGoal(createGoal(6, today()), noEmergency, EMPTY, today());
    expect(s.monthlyEmergency).toBe(0);
    expect(s.reachMonth).toBeNull();
    expect(s.reached).toBe(false);
  });

  it("필수 지출이 0원이면 목표 0 · monthsCovered null(카드는 모은 금액만 보인다)", () => {
    const noEssential: SalaryPlan = { ...PLAN_B, fixedCosts: [], salary: 2_000_000, ratios: [0, 50, 25, 25] };
    const s = summarizeGoal(adjustBalance(createGoal(3, today()), 100_000, today(), false), noEssential, EMPTY, today());
    expect(s).toMatchObject({ essential: 0, target: 0, monthsCovered: null, saved: 100_000, reached: false, reachMonth: null });
  });

  it("2개월치 딱 맞으면 '2'로 표기한다", () => {
    expect(formatMonthsCovered(2)).toBe("2");
  });
});

describe("목표 저장소 — 무효 원문은 지우지 않고, 덮기 전에 백업한다", () => {
  it("무효 원문 '{bad' → loadGoal null · 원문 유지 · saveGoal 뒤 :bak === '{bad'", () => {
    localStorage.setItem(GOAL_KEY, "{bad");
    expect(loadGoal()).toBeNull();
    expect(localStorage.getItem(GOAL_KEY)).toBe("{bad");

    const goal = createGoal(6, today());
    expect(saveGoal(goal)).toEqual({ ok: true });
    expect(localStorage.getItem(GOAL_BACKUP_KEY)).toBe("{bad");
    expect(loadGoal()).toEqual(goal);
  });

  it("백업을 쓰지 못하면 원문을 덮지 않고 QUOTA", () => {
    localStorage.setItem(GOAL_KEY, JSON.stringify({ version: 1, months: 5 }));
    const before = localStorage.getItem(GOAL_KEY);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveGoal(createGoal(6, today()))).toEqual({ ok: false, error: "QUOTA" });
    setItem.mockRestore();
    expect(localStorage.getItem(GOAL_KEY)).toBe(before);
  });

  it("개월 수를 바꿔 저장하면 다시 읽어도 그대로다", () => {
    saveGoal(withMonths(createGoal(3, today()), 12));
    expect(loadGoal()?.months).toBe(12);
  });

  it("모양이 틀린 목표(개월 5·음수 잔액)는 쓰지 않는다", () => {
    const bad = { ...createGoal(6, today()), months: 5 } as unknown as EmergencyGoal;
    expect(saveGoal(bad).ok).toBe(false);
    expect(saveGoal({ ...createGoal(6, today()), baseBalance: -1 }).ok).toBe(false);
    expect(localStorage.getItem(GOAL_KEY)).toBeNull();
  });
});

describe("24개월 정리 — 지운 달의 비상금은 목표에 합쳐져 모은 돈 총합이 변하지 않는다", () => {
  it("foldPrunedIntoGoal: baseMonth 뒤의 체크한 달만 더하고 baseMonth를 지운 달 중 최댓값으로 옮긴다", () => {
    const goal: EmergencyGoal = { ...createGoal(6, today()), baseMonth: "2024-06", baseBalance: 1_000 };
    saveGoal(goal);
    const pruned: [string, unknown][] = [
      ["2024-05", record(PLAN_B, "2024-05", ["emergency"])], // baseMonth 이전 — 이미 baseBalance에 들어 있다
      ["2024-07", record(PLAN_B, "2024-07", ["emergency"])],
      ["2024-08", record(PLAN_B, "2024-08", ["saving"])], // 비상금 미체크
      ["2024-09", { broken: true }], // 무효 원문 — 세지 않는다(화면도 세지 않았다)
    ];
    expect(foldPrunedIntoGoal(pruned)).toBe(true);
    const after = loadGoal()!;
    expect(after.baseBalance).toBe(1_000 + 215_500);
    expect(after.baseMonth).toBe("2024-09");
  });

  it("writeMonthRecord가 25번째 달을 쓰며 가장 오래된 달을 지워도 summarizeGoal의 saved는 그대로다", () => {
    const goal = createGoal(6, new Date(2024, 8, 15)); // baseMonth 2024-08
    saveGoal(goal);
    // 2024-09 ~ 2026-08 (24개월) 비상금 체크
    const months = Array.from({ length: 24 }, (_, i) => shiftMonth("2024-09", i));
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ version: 1, records: Object.fromEntries(months.map((m) => [m, record(PLAN_B, m, ["emergency"])])) }),
    );
    const before = summarizeGoal(loadGoal()!, PLAN_B, loadRecords(), today()).saved;
    expect(before).toBe(24 * 215_500);

    // 9월 기록(비상금 미체크)을 쓰면 2024-09가 정리된다
    expect(writeMonthRecord(record(PLAN_B, "2026-09", ["living"]))).toEqual({ ok: true });
    const records = loadRecords();
    expect(Object.keys(records.records)).toHaveLength(24);
    expect(records.records["2024-09"]).toBeUndefined();
    expect(loadGoal()!.baseMonth).toBe("2024-09");
    expect(summarizeGoal(loadGoal()!, PLAN_B, records, today()).saved).toBe(before);
  });

  it("목표가 없으면 아무것도 쓰지 않는다", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    expect(foldPrunedIntoGoal([["2024-07", record(PLAN_B, "2024-07", ["emergency"])]])).toBe(true);
    expect(setItem).toHaveBeenCalledTimes(0);
    setItem.mockRestore();
  });
});

describe("잔액 맞추기 — 이번 달 이체 전후 (review 0930 MAJOR 2)", () => {
  it("이번 달 비상금 체크 전에 잔액을 넣으면 baseMonth는 지난달 — 나중에 체크하면 그 달 금액이 더해지고 채우는 달은 늦어지지 않는다", () => {
    const goal = adjustBalance(createGoal(6, today()), 3_000_000, today(), false);
    expect(goal.baseMonth).toBe("2026-08");
    const before = summarizeGoal(goal, PLAN_B, EMPTY, today());
    expect(before).toMatchObject({ saved: 3_000_000, thisMonthAdded: 0, reachMonth: "2029-02" });

    const after = summarizeGoal(goal, PLAN_B, storeOf(record(PLAN_B, "2026-09", ["emergency"])), today());
    expect(after.saved).toBe(3_215_500);
    expect(after.thisMonthAdded).toBe(215_500);
    expect(after.reachMonth).toBe("2029-02");
  });

  it("기준 달이 이번 달이면(체크 뒤 잔액 맞추기) 체크를 풀어도 이번 달 이체를 다시 첫 이체로 세지 않는다", () => {
    const goal = adjustBalance(createGoal(6, today()), 3_000_000, today(), true);
    const checked = summarizeGoal(goal, PLAN_B, storeOf(record(PLAN_B, "2026-09", ["emergency"])), today());
    const unchecked = summarizeGoal(goal, PLAN_B, EMPTY, today());
    expect(checked.reachMonth).toBe("2029-03");
    expect(unchecked.reachMonth).toBe("2029-03");
  });
});

describe("snapshot 없는 기록 (review 0930 D-2) — 크래시 대신 모르는 금액은 0으로 센다", () => {
  function noSnapshot(month: string): MonthRecord {
    const r = record(PLAN_B, month, ["emergency"]) as Partial<MonthRecord>;
    delete r.snapshot;
    return r as MonthRecord;
  }

  it("summarizeGoal은 던지지 않고 snapshot 없는 달을 0원으로 센다", () => {
    const goal = { ...createGoal(6, today()), baseMonth: "2026-07" };
    const store = storeOf(noSnapshot("2026-08"), record(PLAN_B, "2026-09", ["emergency"]));
    const s = summarizeGoal(goal, PLAN_B, store, today());
    expect(s.saved).toBe(215_500);
    expect(s.thisMonthAdded).toBe(215_500);
  });

  it("이번 달 기록에 snapshot이 없어도 thisMonthAdded는 0이고 던지지 않는다", () => {
    const s = summarizeGoal(createGoal(6, today()), PLAN_B, storeOf(noSnapshot("2026-09")), today());
    expect(s.saved).toBe(0);
    expect(s.thisMonthAdded).toBe(0);
  });

  it("정리되는 달에 snapshot이 없어도 foldPrunedIntoGoal은 실패하지 않는다(정리가 매번 되돌려지지 않게)", () => {
    saveGoal({ ...createGoal(6, today()), baseMonth: "2024-06", baseBalance: 0 });
    expect(foldPrunedIntoGoal([["2024-07", noSnapshot("2024-07")]])).toBe(true);
    expect(loadGoal()!.baseMonth).toBe("2024-07");
    expect(loadGoal()!.baseBalance).toBe(0);
  });
});
