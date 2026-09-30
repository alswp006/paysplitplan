import { generateId } from "./id";
import { isIsoTimestamp, nowIso } from "./date";
import { isValidPlan, isValidRecord, normalizeLegacyPlan, normalizeLegacyRecord } from "./validate";
import { formatManwon, formatWon } from "./format";
import { foldPrunedIntoGoal } from "./goal";
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
/**
 * 백업 키 — 검증에 실패한 원문을 **지우거나 덮어쓰기 전에** 여기 복사한다(사용자 데이터를 잃지 않는다).
 * 최신 실패 원문 하나만 둔다(덮어쓰기). 복사에 실패하면 원문도 건드리지 않는다.
 */
export const PLAN_BACKUP_KEY = "paysplit:plan:v1:bak";
export const RECORDS_BACKUP_KEY = "paysplit:records:v1:bak";

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

/** 원문 문자열을 그대로 쓴다. 성공하면 true — 던지지 않는다. */
function writeRaw(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
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

/**
 * 저장된 계획을 **읽기만** 한다 — 쓰기·삭제 0회. 깨졌거나 검증에 실패하면 null.
 * 마운트 후 저장소를 건드리면 안 되는 화면(기록 탭)과 저장 직후 재확인에 쓴다.
 */
export function peekPlan(): SalaryPlan | null {
  const raw = readRaw(PLAN_KEY);
  return raw === null ? null : parsePlan(raw);
}

/**
 * 저장된 계획. 깨졌거나 검증에 실패하면 원문을 PLAN_BACKUP_KEY에 복사한 **뒤** 키를 지우고 null.
 * 복사하지 못하면(용량 초과·저장소 차단) 원문을 지우지 않는다. 조용히 실패한다.
 */
export function loadPlan(): SalaryPlan | null {
  const raw = readRaw(PLAN_KEY);
  if (raw === null) return null;
  const plan = parsePlan(raw);
  if (plan) return plan;
  if (!writeRaw(PLAN_BACKUP_KEY, raw)) return null;
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
  // 검증에 실패한 원문을 덮어쓰기 전에 백업한다. 백업을 못 하면 쓰지 않는다(원문 보존).
  if (raw !== null && existing === null && !writeRaw(PLAN_BACKUP_KEY, raw)) return { ok: false, error: "QUOTA" };

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

export const MAX_RECORD_MONTHS = 24;
const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * 24개월 정리 — 단일 헬퍼. 'YYYY-MM' 키만 대상으로 최신 max개만 남기고(records를 직접 고친다)
 * 지운 항목을 [month, 원문] 배열로 돌려준다. 달 형식이 아닌 키는 건드리지 않는다.
 */
export function pruneMonths(
  records: Record<string, unknown>,
  max: number = MAX_RECORD_MONTHS,
): [month: string, raw: unknown][] {
  const months = Object.keys(records).filter((k) => MONTH_KEY_RE.test(k)).sort();
  const drop = months.slice(0, Math.max(0, months.length - max));
  const pruned: [string, unknown][] = drop.map((m) => [m, records[m]]);
  for (const m of drop) delete records[m];
  return pruned;
}

/**
 * 월별 기록 하나를 쓰는 **단일 쓰기 경로**. 원문(RECORDS_KEY) 위에 그 달 하나만 바꾼다.
 * - 다른 달의 원문 항목은 유효하든 아니든 그대로 둔다(loadRecords가 걸러 읽을 뿐 지우지 않는다).
 * - 원문 전체가 파싱되지 않거나 모양이 틀리면, 또는 대상 달의 원문이 검증을 통과하지 못하면
 *   원문 전체를 RECORDS_BACKUP_KEY에 복사한 **뒤에만** 쓴다. 복사하지 못하면 쓰지 않고 QUOTA.
 * - 24개월을 넘으면 pruneMonths로 가장 오래된 달부터 지운다. 지운 달의 비상금 체크는 goal.foldPrunedIntoGoal이
 *   목표에 합친다(합치지 못하면 그 쓰기에서는 지우지 않는다).
 * 던지지 않는다 — 쓰기 실패면 {ok:false, error:"QUOTA"}이고 기존 값이 그대로 남는다.
 */
export function writeMonthRecord(record: MonthRecord): SaveResult {
  try {
    const raw = readRaw(RECORDS_KEY);
    let records: Record<string, unknown> = {};
    if (raw !== null) {
      let data: unknown = null;
      let parsed = true;
      try {
        data = JSON.parse(raw);
      } catch {
        parsed = false;
      }
      if (parsed && isObj(data) && data.version === 1 && isObj(data.records)) {
        records = { ...data.records };
        const target = records[record.month];
        if (target !== undefined && !isValidRecord(record.month, normalizeLegacyRecord(record.month, target))) {
          if (!writeRaw(RECORDS_BACKUP_KEY, raw)) return { ok: false, error: "QUOTA" };
        }
      } else {
        if (!writeRaw(RECORDS_BACKUP_KEY, raw)) return { ok: false, error: "QUOTA" };
      }
    }
    records[record.month] = record;
    const pruned = pruneMonths(records);
    // 지우는 달의 비상금 체크는 목표(baseBalance)에 먼저 합친다 — 모은 돈 총합이 변하지 않게.
    // 합치지 못하면(목표 쓰기 실패) 이번에는 정리하지 않는다: 25개월이 남는 것이 모은 돈을 잃는 것보다 낫다.
    if (pruned.length > 0 && !foldPrunedIntoGoal(pruned)) {
      for (const [month, value] of pruned) records[month] = value;
    }
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, records }));
    return { ok: true };
  } catch {
    return { ok: false, error: "QUOTA" };
  }
}

/**
 * 월별 기록 하나를 저장한다(contract `saveRecordFn`). 같은 month가 있으면 덮어쓰고,
 * 24개월을 넘으면 가장 오래된 month부터 지운다. 쓰기는 writeMonthRecord 하나로 한다.
 * 검증을 통과하지 못하는 기록은 저장하지 않는다. 던지지 않는다 — 쓰기 실패(QUOTA)면 기존 값이 그대로 남는다.
 */
export function saveRecord(record: MonthRecord): void {
  try {
    if (!isValidRecord(record.month, record)) return;
    writeMonthRecord(record);
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
