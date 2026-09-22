export const BUCKET_ORDER = ["living", "savings", "emergency", "leisure"] as const;

export type Bucket = (typeof BUCKET_ORDER)[number];

export const BUCKET_LABEL: Record<Bucket, string> = {
  living: "생활비",
  savings: "저축",
  emergency: "비상금",
  leisure: "여가",
};

export const PRESETS = {
  basic_5311: { living: 50, savings: 30, emergency: 10, leisure: 10 },
  saving_4411: { living: 40, savings: 40, emergency: 10, leisure: 10 },
  living_6211: { living: 60, savings: 20, emergency: 10, leisure: 10 },
  custom: { living: 0, savings: 0, emergency: 0, leisure: 0 },
} as const;

export const STORAGE_KEYS = {
  plan: "psp.plan.v1",
  records: "psp.records.v1",
} as const;

export const LIMITS = {
  maxSalary: 999_999_999,
  maxBudgetItems: 100,
  maxMonthlyRecords: 1000,
} as const;

export const MSG = {
  quota: "한 달에 최대 100개까지 기록할 수 있습니다",
  planLoadFail: "저축 계획을 불러올 수 없습니다",
  saved: "저장되었습니다",
} as const;
