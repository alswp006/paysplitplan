// Domain entity types — type-only file (no runtime code)

// ── Core domain types ──

export type CategoryKey = "living" | "saving" | "emergency" | "leisure";

// CATEGORY_ORDER 순서(생활비·저축·비상금·여가)의 비율 4개, 합계 100
export type Ratios = [number, number, number, number];

export type PresetId = string;

export interface Preset {
  id: PresetId;
  name: string;
  ratios: Ratios;
}

export interface FixedCost {
  id: string;
  name: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryPlan {
  version: 1;
  id: string;
  salary: number;
  fixedCosts: FixedCost[];
  presetId: PresetId;
  ratios: Ratios;
  payday: number;
  createdAt: string;
  updatedAt: string;
}

export type PlanDraft = Omit<SalaryPlan, "version" | "id" | "createdAt" | "updatedAt">;

export interface MonthRecord {
  id: string;
  planId: string | null;
  month: string; // ISO month like "2026-09"
  checked: globalThis.Record<CategoryKey, boolean>;
  eligible: CategoryKey[];
  rate: number;
  completedAt: string | null;
  snapshot: {
    salary: number;
    fixedTotal: number;
    available: number;
    ratios: Ratios;
    amounts: globalThis.Record<CategoryKey, number>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface RecordStore {
  version: 1;
  records: globalThis.Record<string, MonthRecord>;
}

export interface ReviewPromptState {
  version: 1;
  id: "review-prompt";
  createdAt: string;
  updatedAt: string;
}

// ── Allocation and other domain types ──

export interface Allocation {
  categoryKey: CategoryKey;
  amount: number;
  percentage: number;
}

// parseAmountInput 결과 (SPEC P-2a) — ok일 때만 value가 있다
export type ParsedAmount =
  | { kind: "empty"; value?: undefined }
  | { kind: "ok"; value: number } // 0 이상 정수
  | { kind: "negative"; value?: undefined }
  | { kind: "decimal"; value?: undefined }
  | { kind: "invalid"; value?: undefined };

// ── Result and route state types ──

export type SaveResult = { ok: true } | { ok: false; error: "QUOTA" | "NO_PLAN" };

export interface RouteState {
  draft: PlanDraft;
}

// ── 은행 세팅표 복사 기록 (paysplit:setup:v1) ──

export interface SetupState {
  version: 1;
  /** 복사한 세팅표의 서명 — `${payday}|${생활비}|${저축}|${비상금}|${여가}`(금액 기준, setup.setupSignature) */
  signature: string;
  /** 이 서명으로 금액을 복사한 통장(CATEGORY_ORDER 순) */
  copiedKeys: CategoryKey[];
  copiedAt: string;
}

/** 홈 넛지 — none: 지금 계획의 금액을 모두 복사함 · changed: 복사한 뒤 계획 금액이 바뀜 · notYet: 그 밖 */
export type SetupNudge = "none" | "changed" | "notYet";

// ── 비상금 목표 (paysplit:goal:v1) ──

export type GoalMonths = 3 | 6 | 12;

export interface EmergencyGoal {
  version: 1;
  /** 한 달 필수 지출의 몇 개월 치를 모을지 */
  months: GoalMonths;
  /** baseMonth 시점까지 모인 비상금(잔액 맞추기 값 + 정리된 달의 합산). 0 이상 100억 이하 정수 */
  baseBalance: number;
  /** 'YYYY-MM' — 이 달보다 **뒤**의 체크만 saved에 더한다 */
  baseMonth: string;
  createdAt: string;
  updatedAt: string;
}

/** 비상금 목표 요약(저장하지 않는 파생 값 — goal.summarizeGoal) */
export interface GoalSummary {
  fixedTotal: number;
  living: number;
  /** 한 달 필수 지출 = 고정비 + 생활비(현재 계획) */
  essential: number;
  /** 목표 금액 = months × essential (essential이 0이면 0) */
  target: number;
  saved: number;
  /** 모은 돈이 필수 지출 몇 달 치인지(소수 첫째 자리 내림). essential이 0이면 null */
  monthsCovered: number | null;
  /** 0..1 (목표가 0이면 0) */
  progress: number;
  reached: boolean;
  /** 이번 달 체크로 더해진 비상금(없으면 0) */
  thisMonthAdded: number;
  /** 현재 계획대로 옮기면 목표를 채우는 달 'YYYY-MM'. 이미 채웠거나 비상금이 0원이면 null */
  reachMonth: string | null;
  /** 현재 계획의 한 달 비상금 이체액 */
  monthlyEmergency: number;
}

// ── Insights (저장하지 않는 파생 값) ──

export interface BracketScenario {
  salary: number;
  saving: number;
  annualSaving: number;
  isCurrent: boolean;
}

export interface TrendSummary {
  points: { month: string; rate: number | null }[];
  average: number | null;
  streak: number;
  hasEnoughTrend: boolean;
}
