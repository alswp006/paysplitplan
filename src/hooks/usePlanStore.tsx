import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Allocation, BucketKey, MonthRecord, MonthRecordMap, Plan, SaveResult } from "@/lib/types";
import { isPlanCorrupted, loadPlan, loadRecords, savePlan as persistPlan, saveRecords } from "@/lib/storage";
import { ensureMonthRecords, toggleCheck } from "@/lib/records";
import { calcAllocation } from "@/lib/calc";
import { toMonthKey } from "@/lib/date";
import { BUCKET_ORDER } from "@/lib/constants";

export interface PlanStoreValue {
  plan: Plan | null;
  corrupted: boolean;
  allocation: Allocation | null;
  records: MonthRecordMap;
  currentRecord: MonthRecord | null;
  savePlan: (plan: Plan) => SaveResult;
  toggleBucket: (bucket: BucketKey) => SaveResult;
}

const PlanStoreContext = createContext<PlanStoreValue | null>(null);

function currentMonthKey(today: Date = new Date()): string {
  return toMonthKey(today.getFullYear(), today.getMonth());
}

// @AI:NOTE calcAllocation은 presetId로 비율을 찾는다 — 직접 조정(custom)은 plan.ratios를 같은 규칙(천 원 내림, 나머지는 생활비)으로 쓴다.
function allocationFor(plan: Plan): Allocation {
  const fixedTotal = plan.fixedCosts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  if (plan.presetId !== "custom") return calcAllocation(plan.salary, fixedTotal, plan.presetId);

  const remaining = plan.salary - fixedTotal;
  const floor = (n: number) => Math.floor(n / 1000) * 1000;
  const buckets: Record<BucketKey, number> = {};
  let assigned = 0;
  for (const bucket of BUCKET_ORDER) {
    if (bucket === "living") continue;
    buckets[bucket] = floor(remaining * ((plan.ratios[bucket] ?? 0) / 100));
    assigned += buckets[bucket];
  }
  return { fixedTotal, remaining, buckets: { living: remaining - assigned, ...buckets } };
}

interface StoreState {
  plan: Plan | null;
  corrupted: boolean;
  records: MonthRecordMap;
  pendingPersist: boolean;
}

function initState(): StoreState {
  const plan = loadPlan();
  const corrupted = isPlanCorrupted();
  const stored = loadRecords();
  const existing: MonthRecordMap = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  if (!plan) return { plan, corrupted, records: existing, pendingPersist: false };
  const { map, changed } = ensureMonthRecords(plan, new Date(), existing);
  return { plan, corrupted, records: map, pendingPersist: changed };
}

export function PlanStoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(initState);
  const [plan, setPlan] = useState<Plan | null>(initial.plan);
  const [corrupted, setCorrupted] = useState(initial.corrupted);
  const [records, setRecords] = useState<MonthRecordMap>(initial.records);

  // 핸들러가 항상 최신 상태를 기준으로 계산하도록 ref로도 들고 있는다.
  const planRef = useRef(plan);
  const recordsRef = useRef(records);
  planRef.current = plan;
  recordsRef.current = records;

  useEffect(() => {
    if (initial.pendingPersist) saveRecords(initial.records);
  }, [initial]);

  const savePlan = useCallback((next: Plan): SaveResult => {
    const result = persistPlan(next);
    if (!result.ok) return { ok: false, reason: result.reason ?? "unknown" };

    // 비율이 바뀌면 이번 달 기록의 total/rate도 다시 맞춘다. 기록 저장 실패는 계획 저장을 되돌리지 않는다.
    const { map, changed } = ensureMonthRecords(next, new Date(), recordsRef.current);
    if (changed && saveRecords(map).ok) {
      recordsRef.current = map;
      setRecords(map);
    }
    planRef.current = next;
    setPlan(next);
    setCorrupted(false);
    return { ok: true };
  }, []);

  const toggleBucket = useCallback((bucket: BucketKey): SaveResult => {
    const current = planRef.current;
    if (!current) return { ok: false, reason: "unknown" };

    const today = new Date();
    const { map: ensured } = ensureMonthRecords(current, today, recordsRef.current);
    const next = toggleCheck(ensured, currentMonthKey(today), bucket);
    const result = saveRecords(next);
    // 저장 실패 → 상태를 건드리지 않아 호출 전 값이 그대로 남는다.
    if (!result.ok) return { ok: false, reason: result.reason ?? "unknown" };

    recordsRef.current = next;
    setRecords(next);
    return { ok: true };
  }, []);

  const value = useMemo<PlanStoreValue>(
    () => ({
      plan,
      corrupted,
      allocation: plan ? allocationFor(plan) : null,
      records,
      currentRecord: records[currentMonthKey()] ?? null,
      savePlan,
      toggleBucket,
    }),
    [plan, corrupted, records, savePlan, toggleBucket],
  );

  return <PlanStoreContext.Provider value={value}>{children}</PlanStoreContext.Provider>;
}

export function usePlanStore(): PlanStoreValue {
  const ctx = useContext(PlanStoreContext);
  if (!ctx) throw new Error("usePlanStore는 PlanStoreProvider 안에서만 쓸 수 있어요");
  return ctx;
}
