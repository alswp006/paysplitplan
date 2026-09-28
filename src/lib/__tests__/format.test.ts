import { describe, it, expect } from "vitest";
import { parseAmountInput, formatManwon, formatWon, formatMonthLabel, formatAmount } from "@/lib/format";
import { formatDate } from "@/lib/date";
import { generateId, createId } from "@/lib/id";

describe("format", () => {
  it("parseAmountInput: 숫자·콤마·앞자리 0", () => {
    expect(parseAmountInput("3,000,000")).toEqual({ kind: "ok", value: 3000000 });
    expect(parseAmountInput("007")).toEqual({ kind: "ok", value: 7 });
  });

  it("parseAmountInput: 나머지 분기", () => {
    expect(parseAmountInput(" ").kind).toBe("empty");
    expect(parseAmountInput("-50000").kind).toBe("negative");
    expect(parseAmountInput("-2.5").kind).toBe("negative");
    expect(parseAmountInput("2.5").kind).toBe("decimal");
    for (const bad of ["abc", "-", "3e6", "3,000원", "99999999999999999999"]) {
      expect(parseAmountInput(bad).kind).toBe("invalid");
    }
  });

  it("parseAmountInput: 비문자열 입력에도 던지지 않는다", () => {
    expect(() => parseAmountInput(undefined as unknown as string)).not.toThrow();
  });

  it("formatManwon / formatWon", () => {
    expect(formatManwon(3000000)).toBe("300만 원");
    expect(formatManwon(3450000)).toBe("345만 원");
    expect(formatManwon(5000)).toBe("5,000원");
    expect(formatManwon(0)).toBe("");
    expect(formatManwon(-1)).toBe("");
    expect(formatWon(2400000)).toBe("2,400,000원");
  });

  it("formatMonthLabel", () => {
    expect(formatMonthLabel("2026-09")).toBe("2026년 9월");
  });

  it("formatAmount", () => {
    expect(formatAmount(2400000)).toBe("2,400,000원");
    expect(formatAmount(2400000, { symbol: false })).toBe("2,400,000");
    expect(formatAmount(1234.5, { decimals: 1, symbol: false })).toBe("1,234.5");
    expect(formatAmount(1234.6)).toBe("1,235원");
    expect(formatAmount(-5000)).toBe("-5,000원");
    expect(formatAmount(-0.2)).toBe("0원");
    expect(formatAmount(Number.NaN)).toBe("0원");
  });

  it("formatDate", () => {
    expect(formatDate("2026-09-05")).toBe("2026-09-05");
    expect(formatDate("2026-09-05", "M/D")).toBe("9/5");
    expect(formatDate(new Date(2026, 8, 29), "MMM D")).toBe("9월 29일");
    expect(formatDate(new Date(2026, 0, 2))).toBe("2026-01-02");
    expect(formatDate("not-a-date")).toBe("");
  });

  it("generateId", () => {
    expect(generateId()).not.toBe("");
    expect(generateId("plan").startsWith("plan_")).toBe(true);
    const ids = new Set(Array.from({ length: 1000 }, () => generateId("r")));
    expect(ids.size).toBe(1000);
    expect(createId()).not.toContain("_");
  });
});
