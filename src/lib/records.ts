import type { MonthRecord, MonthRecordMap, Plan } from "./types";
import { activeBuckets } from "./calc";
import { toMonthKey, monthRange } from "./date";
import { BUCKET_ORDER } from "./constants";

function parseIsoLocal(iso: string): { year: number; month: number } {
  const [y, m] = iso.split("T")[0].split("-").map(Number);
  return { year: y, month: m - 1 }; // 0-indexed month
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * plan.createdAt 달부터 today 달까지 빈 달을 채우고, 이번 달은 현재 plan.ratios 기준으로
 * total/checked/rate를 다시 계산한다. 과거 달 레코드는 그대로 둔다(동일 참조 유지).
 */
export function ensureMonthRecords(
  plan: Plan,
  today: Date,
  existing: MonthRecordMap
): { map: MonthRecordMap; changed: boolean } {
  const created = parseIsoLocal(plan.createdAt);
  const startKey = toMonthKey(created.year, created.month);
  const endKey = toMonthKey(today.getFullYear(), today.getMonth());
  const monthKeys = monthRange(startKey, endKey);
  const currentMonthKey = endKey;

  const active = activeBuckets(plan.ratios);
  const activeSet = new Set(active);
  const total = active.length;
  const nowIso = new Date().toISOString();

  let changed = false;
  const map: MonthRecordMap = {};

  for (const key of monthKeys) {
    const prev = existing[key];

    if (key === currentMonthKey) {
      const checked = prev ? prev.checked.filter((b) => activeSet.has(b)) : [];
      const rate = total === 0 ? 0 : Math.round((checked.length / total) * 100);

      if (prev && arraysEqual(prev.checked, checked) && prev.total === total && prev.rate === rate) {
        map[key] = prev;
      } else {
        map[key] = { month: key, checked, total, rate, updatedAt: nowIso };
        changed = true;
      }
      continue;
    }

    if (prev) {
      map[key] = prev;
    } else {
      map[key] = { month: key, checked: [], total, rate: 0, updatedAt: nowIso };
      changed = true;
    }
  }

  return { map, changed };
}

/** 새 map을 반환한다(입력 map/record는 변경하지 않는다). 월이 없으면 새로 만든다. */
export function toggleCheck(map: MonthRecordMap, monthKey: string, bucket: string): MonthRecordMap {
  const prev = map[monthKey];
  const checked = prev ? prev.checked : [];
  const total = prev ? prev.total : BUCKET_ORDER.length;

  const nextChecked = checked.includes(bucket)
    ? checked.filter((b) => b !== bucket)
    : [...checked, bucket];
  const rate = total === 0 ? 0 : Math.round((nextChecked.length / total) * 100);

  const record: MonthRecord = {
    month: monthKey,
    checked: nextChecked,
    total,
    rate,
    updatedAt: new Date().toISOString(),
  };

  return { ...map, [monthKey]: record };
}

/** today 기준 최근 count개 달의 키를 최신순(내림차순)으로 반환한다. */
export function recentMonths(map: MonthRecordMap, today: Date, count: number): string[] {
  const currentKey = toMonthKey(today.getFullYear(), today.getMonth());
  const keys = Object.keys(map)
    .filter((k) => k <= currentKey)
    .sort();
  return keys.slice(-count).reverse();
}
