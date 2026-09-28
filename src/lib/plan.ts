import type { CategoryKey, FixedCost, PlanDraft, Preset, Ratios } from "@/lib/types";

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  living: "생활비",
  saving: "저축",
  emergency: "비상금",
  leisure: "여가",
};

export const CATEGORY_ORDER: CategoryKey[] = ["living", "saving", "emergency", "leisure"];

export const PRESETS: Record<"p532" | "p442" | "p622", Preset> = {
  p532: { id: "p532", name: "5:3:2 기본", ratios: [50, 30, 10, 10] },
  p442: { id: "p442", name: "4:4:2 저축 집중", ratios: [40, 40, 10, 10] },
  p622: { id: "p622", name: "6:2:2 여유", ratios: [60, 20, 10, 10] },
};

export interface AllocationResult {
  fixedTotal: number;
  available: number;
  amounts: Record<CategoryKey, number>;
}

function sameRatios(a: Ratios, b: Ratios): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function calculateAllocation(
  salary: number,
  fixedCosts: Pick<FixedCost, "amount">[],
  ratios: Ratios,
): AllocationResult {
  const fixedTotal = fixedCosts.reduce((sum, c) => sum + c.amount, 0);
  const available = salary - fixedTotal;

  if (available <= 0) {
    return { fixedTotal, available, amounts: { living: 0, saving: 0, emergency: 0, leisure: 0 } };
  }

  const saving = Math.floor((available * ratios[1]) / 100);
  const emergency = Math.floor((available * ratios[2]) / 100);
  const leisure = Math.floor((available * ratios[3]) / 100);
  // 내림하고 남은 잔액은 생활비가 흡수한다
  const living = available - saving - emergency - leisure;

  return { fixedTotal, available, amounts: { living, saving, emergency, leisure } };
}

export function resolvePresetId(ratios: Ratios): string {
  const match = Object.values(PRESETS).find((p) => sameRatios(p.ratios, ratios));
  return match ? match.id : "custom";
}

export function isSamePlan(a: PlanDraft, b: PlanDraft): boolean {
  if (a.salary !== b.salary || a.payday !== b.payday) return false;
  if (!sameRatios(a.ratios, b.ratios)) return false;
  if (a.fixedCosts.length !== b.fixedCosts.length) return false;
  return a.fixedCosts.every((c, i) => {
    const o = b.fixedCosts[i];
    return c.name.trim() === o.name.trim() && c.amount === o.amount;
  });
}

/**
 * 월 소득에서 고정비를 뺀 가용 금액을 비율대로 나눈다 (contract: calculateDistributionFn).
 * 비율 합이 100이면 내림하고 남은 잔액을 생활비(`living`, 없으면 첫 항목)가 흡수해 합계가 가용 금액과 같다.
 * 가용 금액이 0 이하이거나 입력이 유효하지 않으면 모든 항목이 0이다. 예외는 던지지 않는다.
 */
export function calculateDistribution(
  monthlyIncome: number,
  fixedCosts: number,
  ratios: { categoryId: string; percent: number }[],
): { categoryId: string; allocated: number }[] {
  const income = Number.isFinite(monthlyIncome) ? monthlyIncome : 0;
  const fixed = Number.isFinite(fixedCosts) ? fixedCosts : 0;
  const available = income - fixed;

  const allocated = ratios.map((r) => {
    if (available <= 0 || !Number.isFinite(r.percent) || r.percent <= 0) return 0;
    return Math.floor((available * r.percent) / 100);
  });

  const percentSum = ratios.reduce((sum, r) => sum + (Number.isFinite(r.percent) ? r.percent : 0), 0);
  if (available > 0 && ratios.length > 0 && percentSum === 100) {
    const livingIdx = ratios.findIndex((r) => r.categoryId === "living");
    const absorber = livingIdx >= 0 ? livingIdx : 0;
    const others = allocated.reduce((sum, v, i) => (i === absorber ? sum : sum + v), 0);
    allocated[absorber] = available - others;
  }

  return ratios.map((r, i) => ({ categoryId: r.categoryId, allocated: allocated[i] }));
}
