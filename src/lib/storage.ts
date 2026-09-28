import { generateId } from "./id";
import { isIsoTimestamp, nowIso } from "./date";
import { isValidPlan, isValidRecord, normalizeLegacyPlan, normalizeLegacyRecord } from "./validate";
import { formatManwon, formatWon } from "./format";
import type { MonthRecord, PlanDraft, RecordStore, ReviewPromptState, SalaryPlan, SaveResult } from "./types";

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

// ── 도메인 저장소: 계획(싱글톤) · 기록 읽기 ──

export const PLAN_KEY = "paysplit:plan:v1";
export const RECORDS_KEY = "paysplit:records:v1";
export const REVIEW_KEY = "paysplit:review:v1";

type Obj = Record<string, unknown>;

function isObj(x: unknown): x is Obj {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * 저장 문자열 → 검증된 계획. 파싱·검증 실패는 null(키는 건드리지 않는다).
 * 레거시 정규화는 메모리에서만 한다. 버전 필드가 생기기 전 빌드의 데이터(version·updatedAt 없음)는
 * 여기서 version 1 / updatedAt = createdAt으로 채워 normalizeLegacyPlan에 넘긴다.
 */
function parsePlan(raw: string): SalaryPlan | null {
  try {
    let data: unknown = JSON.parse(raw);
    if (isObj(data)) {
      const filled: Obj = { ...data };
      if (filled.version === undefined) filled.version = 1;
      if (filled.updatedAt === undefined && isIsoTimestamp(filled.createdAt)) filled.updatedAt = filled.createdAt;
      data = filled;
    }
    const plan = normalizeLegacyPlan(data);
    return isValidPlan(plan) ? plan : null;
  } catch {
    return null;
  }
}

/** 저장된 계획. 깨졌거나 검증에 실패하면 키를 지우고 null. 던지지 않고 console.error도 남기지 않는다. */
export function loadPlan(): SalaryPlan | null {
  const raw = readRaw(PLAN_KEY);
  if (raw === null) return null;
  const plan = parsePlan(raw);
  if (plan) return plan;
  try {
    localStorage.removeItem(PLAN_KEY);
  } catch {
    // 저장소가 막힌 환경 — 지우지 못해도 null이면 충분하다.
  }
  return null;
}

/**
 * 초안을 계획으로 저장한다. 기존 계획이 있으면 id·createdAt을 유지하고,
 * updatedAt = max(지금, createdAt). 쓰기가 예외를 던지면(용량 초과 등) QUOTA — 기존 값은 그대로다.
 */
export function savePlan(draft: PlanDraft): SaveResult {
  const now = nowIso();
  const raw = readRaw(PLAN_KEY);
  const existing = raw === null ? null : parsePlan(raw);

  const createdAt = existing ? existing.createdAt : now;
  const updatedAt = Date.parse(now) >= Date.parse(createdAt) ? now : createdAt;
  const plan: SalaryPlan = {
    version: 1,
    id: existing ? existing.id : generateId("plan"),
    salary: draft.salary,
    fixedCosts: draft.fixedCosts,
    presetId: draft.presetId,
    ratios: draft.ratios,
    payday: draft.payday,
    createdAt,
    updatedAt,
  };

  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    return { ok: true };
  } catch {
    return { ok: false, error: "QUOTA" };
  }
}

/** 월별 기록 스토어. 읽기 전용 — 잘못된 레코드는 결과에서만 빼고 저장소는 건드리지 않는다. */
export function loadRecords(): RecordStore {
  const empty = (): RecordStore => ({ version: 1, records: {} });
  const raw = readRaw(RECORDS_KEY);
  if (raw === null) return empty();
  try {
    const data: unknown = JSON.parse(raw);
    if (!isObj(data) || data.version !== 1 || !isObj(data.records)) return empty();
    const records: RecordStore["records"] = {};
    for (const [month, value] of Object.entries(data.records)) {
      const record = normalizeLegacyRecord(month, value);
      if (isValidRecord(month, record)) records[month] = record;
    }
    return { version: 1, records };
  } catch {
    return empty();
  }
}

const MAX_RECORD_MONTHS = 24;

/**
 * 월별 기록 하나를 저장한다(contract `saveRecordFn`). 같은 month가 있으면 덮어쓰고,
 * 24개월을 넘으면 가장 오래된 month부터 지운다. 다른 레코드는 정규화·검증을 거쳐 함께 다시 쓰인다.
 * 검증을 통과하지 못하는 기록은 저장하지 않는다. 던지지 않는다 — 쓰기 실패(QUOTA)면 기존 값이 그대로 남는다.
 */
export function saveRecord(record: MonthRecord): void {
  try {
    if (!isValidRecord(record.month, record)) return;
    const store = loadRecords();
    const records: RecordStore["records"] = { ...store.records, [record.month]: record };
    const months = Object.keys(records).sort();
    for (const month of months.slice(0, Math.max(0, months.length - MAX_RECORD_MONTHS))) delete records[month];
    const next: RecordStore = { version: 1, records };
    localStorage.setItem(RECORDS_KEY, JSON.stringify(next));
  } catch {
    // 용량 초과·저장소 차단 — 기존 값 유지.
  }
}

function isReviewState(x: unknown): x is ReviewPromptState {
  return (
    isObj(x) &&
    x.version === 1 &&
    x.id === "review-prompt" &&
    isIsoTimestamp(x.createdAt) &&
    isIsoTimestamp(x.updatedAt)
  );
}

/**
 * 리뷰 요청 기록(contract `loadReviewFn`). 리뷰 기록은 싱글톤이라 planId는 쓰지 않는다.
 * 키가 없거나 레거시 '1'·깨진 값이면 null이다 — 이 키는 "있으면 이미 물었다"는 가드라 지우거나 고치지 않는다.
 */
export function loadReview(_planId: string): ReviewPromptState | null {
  const raw = readRaw(REVIEW_KEY);
  if (raw === null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    return isReviewState(data) ? data : null;
  } catch {
    return null;
  }
}

/** 리뷰 요청 기록을 저장한다(contract `saveReviewFn`). 모양이 틀린 값은 저장하지 않고, 던지지 않는다. */
export function saveReview(review: ReviewPromptState): void {
  try {
    if (!isReviewState(review)) return;
    localStorage.setItem(REVIEW_KEY, JSON.stringify(review));
  } catch {
    // 용량 초과·저장소 차단 — 무시한다.
  }
}

/**
 * 저장된 계획 목록(contract `listPlansFn`). 계획은 싱글톤이라 0개 또는 1개다.
 * name은 화면에 그대로 쓸 수 있는 "월급 350만 원" 형태다.
 */
export function listPlans(): { id: string; name: string; createdAt: string }[] {
  const plan = loadPlan();
  if (!plan) return [];
  return [{ id: plan.id, name: `월급 ${formatManwon(plan.salary) || formatWon(plan.salary)}`, createdAt: plan.createdAt }];
}
