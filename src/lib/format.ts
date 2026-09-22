export function formatWon(amount: number): string {
  const integer = Math.floor(amount);
  return `${formatComma(integer)}원`;
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
