import type { Plan, MonthRecord, MonthRecordMap, SaveResult } from "./types";

export function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

const PLAN_KEY = "psp.plan.v1";
const RECORDS_KEY = "psp.records.v1";
const MAX_MONTHS = 36;

function isValidPlanShape(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.version === "number" &&
    typeof p.salary === "number" &&
    Array.isArray(p.fixedCosts) &&
    typeof p.payday === "number" &&
    typeof p.presetId === "string" &&
    typeof p.ratios === "object" &&
    p.ratios !== null &&
    !Array.isArray(p.ratios) &&
    typeof p.createdAt === "string" &&
    typeof p.updatedAt === "string"
  );
}

export function loadPlan(): Plan | null {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidPlanShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isPlanCorrupted(): boolean {
  const raw = localStorage.getItem(PLAN_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return !isValidPlanShape(parsed);
  } catch {
    return true;
  }
}

export function savePlan(plan: Plan): SaveResult {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    return { ok: true, plan };
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014)
    ) {
      return { ok: false, reason: "quota" };
    }
    return { ok: false, reason: "unknown" };
  }
}

export function loadRecords(): MonthRecordMap {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveRecords(records: MonthRecordMap): SaveResult {
  try {
    const sorted = Object.keys(records)
      .sort()
      .slice(-MAX_MONTHS)
      .reduce<MonthRecordMap>((acc, month) => {
        acc[month] = records[month];
        return acc;
      }, {});

    localStorage.setItem(RECORDS_KEY, JSON.stringify(sorted));
    return { ok: true };
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014)
    ) {
      return { ok: false, reason: "quota" };
    }
    return { ok: false, reason: "unknown" };
  }
}

export function saveMonthRecords(records: MonthRecord[]): SaveResult {
  const map = records.reduce<MonthRecordMap>((acc, record) => {
    acc[record.month] = record;
    return acc;
  }, {});
  return saveRecords(map);
}

export function loadMonthRecords(): MonthRecord[] {
  return Object.values(loadRecords()).sort((a, b) => a.month.localeCompare(b.month));
}
