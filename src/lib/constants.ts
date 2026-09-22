export const BUCKET_ORDER = ["living", "saving", "emergency", "leisure"] as const;

export type Bucket = (typeof BUCKET_ORDER)[number];

export const BUCKET_LABEL: Record<Bucket, string> = {
  living: "생활비",
  saving: "저축",
  emergency: "비상금",
  leisure: "여가",
};

export const PRESETS = {
  basic_5311: { living: 50, saving: 30, emergency: 10, leisure: 10 },
  saving_4411: { living: 40, saving: 40, emergency: 10, leisure: 10 },
  living_6211: { living: 60, saving: 20, emergency: 10, leisure: 10 },
  custom: { living: 0, saving: 0, emergency: 0, leisure: 0 },
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
  quota: "저장 공간이 부족해 저장하지 못했어요",
  planLoadFail: "저장된 계획을 불러오지 못했어요",
  saved: "계획을 저장했어요",
} as const;
