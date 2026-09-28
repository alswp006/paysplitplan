// Domain entity types — type-only file (no runtime code)

// ── Core domain types ──

export type CategoryKey = "savings" | "expense" | "fun";

export type Ratios = globalThis.Record<CategoryKey, number>;

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
