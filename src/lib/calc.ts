import type { Allocation, IncomeScenario } from "./types";
import { PRESETS } from "./constants";

export function calcAllocation(
  salary: number,
  fixedTotal: number,
  presetId: string
): Allocation {
  throw new Error("Not implemented");
}

export function calcRate(value: number, total: number): number {
  throw new Error("Not implemented");
}

export function activeBuckets(buckets: Record<string, number>): string[] {
  throw new Error("Not implemented");
}

export function buildIncomeScenarios(
  salary: number,
  fixedTotal: number
): IncomeScenario[] {
  throw new Error("Not implemented");
}

export function sumRatios(ratios: Record<string, number>): number {
  throw new Error("Not implemented");
}

export function matchPreset(ratios: Record<string, number>): string {
  throw new Error("Not implemented");
}
