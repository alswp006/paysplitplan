import type { ParsedAmount } from "@/lib/types";

export type { ParsedAmount };

export function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/**
 * 보조 표기 — 만 원 단위는 내림, 0 이하는 숨김('').
 * 1억 이상은 억 단위로 끊는다: 100,000,000 → "1억 원", 123,450,000 → "1억 2,345만 원"("10,000만 원" 방지).
 */
export function formatManwon(n: number): string {
  if (!(n > 0)) return "";
  if (n >= 100_000_000) {
    const eok = Math.floor(n / 100_000_000);
    const man = Math.floor((n % 100_000_000) / 10000);
    return man > 0 ? `${eok.toLocaleString("ko-KR")}억 ${man.toLocaleString("ko-KR")}만 원` : `${eok.toLocaleString("ko-KR")}억 원`;
  }
  if (n >= 10000) return `${Math.floor(n / 10000).toLocaleString("ko-KR")}만 원`;
  return formatWon(n);
}

/** 숫자 입력 원문 해석 (SPEC P-2a 6단계). 예외를 던지지 않는다. */
export function parseAmountInput(raw: string): ParsedAmount {
  const s = String(raw ?? "").replace(/[,\s]/g, "");
  if (s === "") return { kind: "empty" };
  if (/^\d+$/.test(s)) {
    const value = Number(s);
    return Number.isSafeInteger(value) ? { kind: "ok", value } : { kind: "invalid" };
  }
  if (/^-\d+(\.\d+)?$/.test(s)) return { kind: "negative" };
  if (/^\d+\.\d+$/.test(s)) return { kind: "decimal" };
  return { kind: "invalid" };
}

/**
 * 금액 입력칸 표시용 — 해석 결과가 ok일 때만 콤마를 붙인다("550000" → "550,000").
 * 그 외(빈 값·소수·음수·문자)는 원문 그대로 둔다(에러 문구와 함께 보여준다).
 */
export function formatAmountRaw(raw: string): string {
  const parsed = parseAmountInput(raw);
  return parsed.kind === "ok" ? parsed.value.toLocaleString("ko-KR") : raw;
}

/** '2026-09' → '2026년 9월' */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

/** 금액 표시. symbol(기본 true)이면 '원'을 붙인다. decimals 자리까지 반올림(기본 0). 숫자가 아니면 0으로 본다. */
export function formatAmount(
  amountKrw: number,
  opts?: { symbol?: boolean; decimals?: number },
): string {
  const symbol = opts?.symbol ?? true;
  const decimals = Math.min(Math.max(Math.trunc(opts?.decimals ?? 0), 0), 20);
  let n = Number.isFinite(amountKrw) ? amountKrw : 0;
  if (Math.abs(n) < 0.5 * 10 ** -decimals) n = 0; // "-0" 방지
  const text = n.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return symbol ? `${text}원` : text;
}
