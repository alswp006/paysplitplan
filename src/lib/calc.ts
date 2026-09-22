import type { Allocation, IncomeScenario } from "./types";
import { PRESETS, BUCKET_ORDER } from "./constants";

const ROUND_UNIT = 1000;

function floorToUnit(amount: number): number {
  return Math.floor(amount / ROUND_UNIT) * ROUND_UNIT;
}

export function calcAllocation(
  salary: number,
  fixedTotal: number,
  presetId: string
): Allocation {
  const remaining = salary - fixedTotal;
  const ratios =
    PRESETS[presetId as keyof typeof PRESETS] ?? PRESETS.custom;

  const saving = floorToUnit(remaining * (ratios.saving / 100));
  const emergency = floorToUnit(remaining * (ratios.emergency / 100));
  const leisure = floorToUnit(remaining * (ratios.leisure / 100));
  const living = remaining - saving - emergency - leisure;

  return {
    fixedTotal,
    remaining,
    buckets: { living, saving, emergency, leisure },
  };
}

export function calcRate(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

export function activeBuckets(buckets: Record<string, number>): string[] {
  return BUCKET_ORDER.filter((bucket) => buckets[bucket] > 0);
}

const SCENARIO_DELTAS = [-1_000_000, -500_000, 0, 500_000, 1_000_000];

export function buildIncomeScenarios(
  salary: number,
  fixedTotal: number
): IncomeScenario[] {
  const ratios = PRESETS.basic_5311;

  return SCENARIO_DELTAS.map((delta) => {
    const scenarioSalary = salary + delta;
    const remaining = scenarioSalary - fixedTotal;
    const saving = floorToUnit(remaining * (ratios.saving / 100));

    return {
      salary: scenarioSalary,
      remaining,
      saving,
      yearlySaving: saving * 12,
    };
  }).filter((scenario) => scenario.salary >= 100_000 && scenario.remaining > 0);
}

export function sumRatios(ratios: Record<string, number>): number {
  return Object.values(ratios).reduce((sum, value) => sum + value, 0);
}

export function matchPreset(ratios: Record<string, number>): string {
  const entry = Object.entries(PRESETS).find(([, presetRatios]) =>
    BUCKET_ORDER.every((bucket) => presetRatios[bucket] === ratios[bucket])
  );
  return entry?.[0] ?? "custom";
}
