import { describe, it, expect } from "vitest";
import { buildHomeHero } from "@/lib/homeHero";
import type { CategoryKey, MonthRecord, RecordStore, SalaryPlan } from "@/lib/types";

// 시드 A: 월급 300만 · 월세 60만 · 50/30/10/10 · 월급날 25 → 1,200,000 / 720,000 / 240,000 / 240,000
const TS = "2026-09-01T00:00:00.000Z";
const planA: SalaryPlan = {
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
const KEYS: CategoryKey[] = ["living", "saving", "emergency", "leisure"];

function rec(month: string, on: CategoryKey[]): MonthRecord {
  const checked = { living: false, saving: false, emergency: false, leisure: false };
  for (const k of on) checked[k] = true;
  const rate = Math.round((on.length / 4) * 100);
  return {
    id: `rec_${month}`,
    planId: "plan_a",
    month,
    checked,
    eligible: [...KEYS],
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

const store = (...records: MonthRecord[]): RecordStore => ({
  version: 1,
  records: Object.fromEntries(records.map((r) => [r.month, r])),
});

const at = (m: number, d: number) => new Date(2026, m - 1, d, 9);
const text = (h: ReturnType<typeof buildHomeHero>) => `${h.label} ${h.value} ${h.caption}`;

describe("buildHomeHero — 월급날 히어로 상태", () => {
  it("09-29, 기록 없음(월급날 25일 지남) → inProgress '9월 이체' · '4개 남았어요' · '10월 25일 월급날까지 D-26'", () => {
    const h = buildHomeHero(planA, store(), at(9, 29));
    expect(h).toMatchObject({
      phase: "inProgress",
      label: "9월 이체",
      value: "4개 남았어요",
      caption: "10월 25일 월급날까지 D-26",
      filledKeys: [],
    });
  });

  it("10-25(월급날 당일) → payday '오늘은 월급날이에요' · '나눌 돈 2,400,000원' · '통장 4개로 나눠 옮기고 체크해요'", () => {
    const h = buildHomeHero(planA, store(), at(10, 25));
    expect(h).toMatchObject({
      phase: "payday",
      label: "오늘은 월급날이에요",
      value: "나눌 돈 2,400,000원",
      caption: "통장 4개로 나눠 옮기고 체크해요",
    });
  });

  it("월급날 당일에 이번 달 체크를 다 했으면 캡션이 '이번 달 이체는 모두 체크했어요'", () => {
    const h = buildHomeHero(planA, store(rec("2026-10", KEYS)), at(10, 25));
    expect(h.phase).toBe("payday");
    expect(h.caption).toBe("이번 달 이체는 모두 체크했어요");
  });

  it("10-10, 9월 4/4 → waiting 'D-15' · '10월 25일 월급날 · 지난달 4개 중 4개 옮겼어요'", () => {
    const h = buildHomeHero(planA, store(rec("2026-09", KEYS)), at(10, 10));
    expect(h).toMatchObject({
      phase: "waiting",
      label: "다음 월급날까지",
      value: "D-15",
      caption: "10월 25일 월급날 · 지난달 4개 중 4개 옮겼어요",
    });
  });

  it("09-29, 7·8·9월 4/4 → done '9월 이체 완료' · '3개월 연속 지켰어요'", () => {
    const h = buildHomeHero(planA, store(rec("2026-07", KEYS), rec("2026-08", KEYS), rec("2026-09", KEYS)), at(9, 29));
    expect(h).toMatchObject({
      phase: "done",
      label: "9월 이체 완료",
      value: "3개월 연속 지켰어요",
      caption: "10월 25일 월급날까지 D-26",
    });
  });

  it("이번 달만 완료면 '계획대로 옮겼어요'", () => {
    const h = buildHomeHero(planA, store(rec("2026-09", KEYS)), at(9, 29));
    expect(h.phase).toBe("done");
    expect(h.value).toBe("계획대로 옮겼어요");
  });

  it("payday 31, 09-29 → waiting 'D-1' · '9월 30일 월급날'(말일로 당김, 지난달 기록 없음)", () => {
    const h = buildHomeHero({ ...planA, payday: 31 }, store(), at(9, 29));
    expect(h).toMatchObject({ phase: "waiting", value: "D-1", caption: "9월 30일 월급날" });
  });

  it("9월 2/4(저축·비상금) → '2개 남았어요', filledKeys = ['saving','emergency']", () => {
    const h = buildHomeHero(planA, store(rec("2026-09", ["saving", "emergency"])), at(9, 29));
    expect(h.value).toBe("2개 남았어요");
    expect(h.filledKeys).toEqual(["saving", "emergency"]);
  });

  it("월급날 전이라도 하나라도 체크했으면 inProgress", () => {
    const h = buildHomeHero(planA, store(rec("2026-10", ["living"])), at(10, 10));
    expect(h).toMatchObject({ phase: "inProgress", label: "10월 이체", value: "3개 남았어요", caption: "10월 25일 월급날까지 D-15" });
  });

  it("어떤 경우에도 'D-0'을 보이지 않는다", () => {
    const cases = [
      buildHomeHero(planA, store(), at(9, 29)),
      buildHomeHero(planA, store(), at(10, 25)),
      buildHomeHero(planA, store(rec("2026-10", KEYS)), at(10, 25)),
      buildHomeHero(planA, store(rec("2026-09", KEYS)), at(10, 10)),
      buildHomeHero(planA, store(rec("2026-07", KEYS), rec("2026-08", KEYS), rec("2026-09", KEYS)), at(9, 29)),
      buildHomeHero({ ...planA, payday: 31 }, store(), at(9, 29)),
      buildHomeHero({ ...planA, payday: 31 }, store(), at(9, 30)),
      buildHomeHero(planA, store(rec("2026-09", ["saving", "emergency"])), at(9, 29)),
    ];
    for (const h of cases) expect(text(h)).not.toMatch(/D-0(?!\d)/);
  });
});
