// Domain types — add your app-specific types here

export type BucketKey = string;
export type PresetId = string;

export interface FixedCost {
  id: string;
  name: string;
  amount: number;
}

export interface Plan {
  version: 1;
  salary: number;
  fixedCosts: FixedCost[];
  payday: number;
  presetId: PresetId;
  ratios: Record<BucketKey, number>;
  createdAt: string;
  updatedAt: string;
}

export interface PlanDraft {
  salary: number;
  payday: number;
  fixedCosts: FixedCost[];
  presetId?: PresetId;
}

export interface MonthRecord {
  month: string;
  checked: BucketKey[];
  total: number;
  rate: number;
  updatedAt: string;
}

export type MonthRecordMap = Record<string, MonthRecord>;

export interface Allocation {
  fixedTotal: number;
  remaining: number;
  buckets: Record<BucketKey, number>;
}

export interface IncomeScenario {
  salary: number;
  remaining: number;
  saving: number;
  yearlySaving: number;
}

export type SaveResult =
  | { ok: true; plan?: Plan }
  | { ok: false; error?: string; reason?: "quota" | "unknown" };

export interface SetupErrors {
  salary?: string;
  payday?: string;
  fixedTotal?: string;
}

export interface RouteState {
  "/ratio": { draft: PlanDraft } | undefined;
  "/result": { justSaved: boolean } | undefined;
}
