import { isIsoTimestamp, nowIso } from "./date";
import { CATEGORY_ORDER } from "./plan";
import { buildSetupRows, setupSignature } from "./setup";
import type { CategoryKey, PlanDraft, SetupNudge, SetupState } from "./types";

/**
 * 세팅표 복사 기록 — "은행에 금액을 넣었나"를 홈 넛지가 짐작하는 근거(사용자가 복사를 눌렀다는 사실만 안다).
 * 이 기록은 사용자가 입력한 데이터가 아니라 복사 동작의 흔적이라, 무효 원문 위에는 새로 쓴다(백업 키 없음).
 * 읽기는 절대 지우지 않는다.
 */
export const SETUP_KEY = "paysplit:setup:v1";

const CATEGORY_SET = new Set<string>(CATEGORY_ORDER);

function isSetupState(x: unknown): x is SetupState {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return (
    o.version === 1 &&
    typeof o.signature === "string" &&
    o.signature !== "" &&
    Array.isArray(o.copiedKeys) &&
    o.copiedKeys.every((k) => typeof k === "string" && CATEGORY_SET.has(k)) &&
    isIsoTimestamp(o.copiedAt)
  );
}

/** 저장된 복사 기록. 없거나 깨졌으면 null — 원문은 지우지 않는다. 던지지 않는다. */
export function loadSetupState(): SetupState | null {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (raw === null) return null;
    const data: unknown = JSON.parse(raw);
    return isSetupState(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * 복사한 통장을 기록한다. 서명이 같으면 기존 keys와 합집합, 다르면(계획 금액이 바뀜) 새로 시작한다.
 * 성공하면 true — 던지지 않는다(용량 초과·저장소 차단이면 false).
 */
export function markSetupCopied(signature: string, keys: CategoryKey[]): boolean {
  try {
    const prev = loadSetupState();
    const base = prev && prev.signature === signature ? prev.copiedKeys : [];
    const copiedKeys = CATEGORY_ORDER.filter((k) => base.includes(k) || keys.includes(k));
    const next: SetupState = { version: 1, signature, copiedKeys, copiedAt: nowIso() };
    localStorage.setItem(SETUP_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/**
 * 홈 넛지 판정.
 *  - none   : 기록의 서명이 지금 계획과 같고, 금액이 있는 통장을 모두 복사했다
 *  - changed: 기록이 있는데 서명이 다르다(복사한 뒤 계획 금액·날짜가 바뀜)
 *  - notYet : 그 밖(기록 없음·일부만 복사)
 */
export function setupNudge(
  plan: Pick<PlanDraft, "salary" | "fixedCosts" | "ratios" | "payday">,
  state: SetupState | null,
): SetupNudge {
  if (!state) return "notYet";
  if (state.signature !== setupSignature(plan)) return "changed";
  const eligible = buildSetupRows(plan).map((row) => row.key);
  return eligible.every((k) => state.copiedKeys.includes(k)) ? "none" : "notYet";
}

/**
 * 지금 계획의 세팅표 중 몇 통장을 복사했나(서명이 같을 때만 센다 — 다르면 0). 홈 넛지가 "4개 중 3개"를 말한다.
 */
export function setupCopyProgress(
  plan: Pick<PlanDraft, "salary" | "fixedCosts" | "ratios" | "payday">,
  state: SetupState | null,
): { copied: number; total: number } {
  const eligible = buildSetupRows(plan).map((row) => row.key);
  if (!state || state.signature !== setupSignature(plan)) return { copied: 0, total: eligible.length };
  return { copied: eligible.filter((k) => state.copiedKeys.includes(k)).length, total: eligible.length };
}

/**
 * "이미 은행에 넣었어요" — 복사하지 않고 직접 자동이체를 걸었거나 손으로 옮기는 사용자가 넛지를 끈다.
 * 지금 계획의 모든 통장을 복사한 것으로 기록한다(계획 금액이 바뀌면 서명이 달라져 넛지가 다시 나온다).
 */
export function markSetupDone(plan: Pick<PlanDraft, "salary" | "fixedCosts" | "ratios" | "payday">): boolean {
  return markSetupCopied(
    setupSignature(plan),
    buildSetupRows(plan).map((row) => row.key),
  );
}
