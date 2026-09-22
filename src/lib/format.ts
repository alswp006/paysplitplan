export function formatWon(amount: number): string {
  const integer = Math.floor(amount);
  return `${formatComma(integer)}원`;
}

export function formatKrw(amount: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? 0;
  if (decimals <= 0) return formatWon(amount);

  const formatted = amount.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${formatted}원`;
}

export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatComma(num: number): string {
  return Math.floor(num).toLocaleString("ko-KR");
}

export function parseDigits(str: string): number | null {
  if (!str) return null;

  const digits = str.replace(/[^\d]/g, "");
  if (!digits) return null;

  return parseInt(digits, 10);
}

export function clampRatio(ratio: number): number {
  return Math.max(0, Math.min(100, ratio));
}

export function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 9)}`;
}
