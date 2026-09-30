import { getToday, monthKey } from "./date";
import { CATEGORY_LABEL, CATEGORY_ORDER, calculateAllocation } from "./plan";
import type { CategoryKey, MonthRecord, RecordStore, SalaryPlan } from "./types";

export interface ChecklistRow {
  key: CategoryKey;
  label: string;
  amount: number;
  checked: boolean;
}

export interface ChecklistView {
  rows: ChecklistRow[];
  checkedCount: number;
  total: number;
  percent: number;
  progressText: string;
}

/**
 * 홈 체크리스트 — 현재 계획에서 금액이 0보다 큰 카테고리만 CATEGORY_ORDER 순으로 행이 된다.
 * 체크 상태만 이번 달 기록에서 읽고, 기록에 저장된 eligible·rate·planId는 쓰지 않는다(계획이 바뀌면 낡는다).
 */
export function buildChecklist(plan: SalaryPlan, store: RecordStore, today: Date): ChecklistView {
  const { amounts } = calculateAllocation(plan.salary, plan.fixedCosts, plan.ratios);
  const record = store.records[monthKey(today)];

  const rows: ChecklistRow[] = CATEGORY_ORDER.filter((key) => amounts[key] > 0).map((key) => ({
    key,
    label: `${CATEGORY_LABEL[key]} 통장`,
    amount: amounts[key],
    checked: record?.checked[key] === true,
  }));

  const checkedCount = rows.filter((r) => r.checked).length;
  const total = rows.length;
  const percent = total === 0 ? 0 : Math.round((checkedCount / total) * 100);

  return { rows, checkedCount, total, percent, progressText: `${checkedCount}/${total} 완료 · ${percent}%` };
}

/**
 * 이번 달 기록의 rate·eligible을 **현재 계획으로 다시 센 사본**을 돌려준다(순수 함수 — 저장하지 않는다).
 * 홈 체크리스트는 현재 계획으로 세고 기록 탭은 저장값을 읽어서, 계획을 바꾸면 같은 달이 75%와 100%로
 * 갈렸다. 기록 탭·연속 기록이 이 사본을 읽으면 두 화면이 같은 숫자를 본다. 이번 달 기록이 없으면 store 그대로.
 */
export function withLiveCurrentMonth(store: RecordStore, plan: SalaryPlan, today: Date): RecordStore {
  const month = monthKey(today);
  const record = store.records[month];
  if (!record) return store;
  const view = buildChecklist(plan, store, today);
  return {
    ...store,
    records: { ...store.records, [month]: { ...record, rate: view.percent, eligible: view.rows.map((r) => r.key) } },
  };
}

/** 이행률이 100 미만에서 100이 되는 순간에만 true — 완료 안내를 한 번만 띄우는 기준. */
export function isCompletionTransition(prevPercent: number, nextPercent: number): boolean {
  return prevPercent < 100 && nextPercent === 100;
}

/**
 * 계약(contract.ts)의 calculateChecklistStatusFn — 이번 달 이체 체크 현황.
 * records 중 이번 달 기록의 체크만 읽고, 행은 buildChecklist와 같은 규칙(금액 > 0인 카테고리)으로 만든다.
 */
export function calculateChecklistStatus(
  plan: SalaryPlan,
  records: MonthRecord[],
): { completed: number; total: number; items: { id: string; label: string; done: boolean }[] } {
  const store: RecordStore = {
    version: 1,
    records: Object.fromEntries(records.map((r) => [r.month, r])),
  };
  const view = buildChecklist(plan, store, getToday());
  return {
    completed: view.checkedCount,
    total: view.total,
    items: view.rows.map((r) => ({ id: r.key, label: r.label, done: r.checked })),
  };
}
