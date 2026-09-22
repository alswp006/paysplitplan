import type { PlanDraft, SetupErrors } from "./types";

export interface ValidationError {
  name?: string;
  amount?: string;
}

export function validateSetup(draft: PlanDraft): SetupErrors {
  // TDD: Stub — tests will drive implementation
  return {};
}

export function validateFixedCost(
  name: string,
  amount: number
): ValidationError {
  // TDD: Stub — tests will drive implementation
  return {};
}
