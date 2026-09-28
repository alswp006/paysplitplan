import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseAmountInput, formatWon, formatManwon, formatMonthLabel } from "@/lib/format";
import { monthKey, shiftMonth, nowIso, isIsoTimestamp } from "@/lib/date";
import { createId } from "@/lib/id";

describe("공용 유틸: 날짜, ID, 금액 포맷 (Packet 0002)", () => {
  // ===== AC 1: parseAmountInput 결과 검증 =====
  describe("AC-1: parseAmountInput 결과", () => {
    it("should parse valid comma-separated number '3,000,000' as 3000000", () => {
      const result = parseAmountInput("3,000,000");
      expect(result.kind).toBe("ok");
      expect(result.value).toBe(3000000);
    });

    it("should parse leading zeros '007' as 7", () => {
      const result = parseAmountInput("007");
      expect(result.kind).toBe("ok");
      expect(result.value).toBe(7);
    });

    it("should return 'empty' for whitespace-only input", () => {
      const result = parseAmountInput(" ");
      expect(result.kind).toBe("empty");
    });

    it("should return 'negative' for negative number '-50000'", () => {
      const result = parseAmountInput("-50000");
      expect(result.kind).toBe("negative");
    });

    it("should return 'decimal' for decimal input '2.5'", () => {
      const result = parseAmountInput("2.5");
      expect(result.kind).toBe("decimal");
    });

    it("should return 'invalid' for non-numeric strings 'abc'", () => {
      const result = parseAmountInput("abc");
      expect(result.kind).toBe("invalid");
    });

    it("should return 'invalid' for bare minus sign '-'", () => {
      const result = parseAmountInput("-");
      expect(result.kind).toBe("invalid");
    });

    it("should return 'invalid' for scientific notation '3e6'", () => {
      const result = parseAmountInput("3e6");
      expect(result.kind).toBe("invalid");
    });

    it("should return 'invalid' for won-suffixed input '3,000원'", () => {
      const result = parseAmountInput("3,000원");
      expect(result.kind).toBe("invalid");
    });
  });

  // ===== AC 2: formatManwon 및 formatWon 결과 검증 =====
  describe("AC-2: formatManwon 및 formatWon 결과", () => {
    it("should format 3000000 as '300만 원'", () => {
      expect(formatManwon(3000000)).toBe("300만 원");
    });

    it("should format 3450000 as '345만 원' (반올림 테스트)", () => {
      expect(formatManwon(3450000)).toBe("345만 원");
    });

    it("should format 5000 as '5,000원' (만 원 미만)", () => {
      expect(formatManwon(5000)).toBe("5,000원");
    });

    it("should return empty string for 0", () => {
      expect(formatManwon(0)).toBe("");
    });

    it("should return empty string for negative -1", () => {
      expect(formatManwon(-1)).toBe("");
    });

    it("should format 2400000 with formatWon as '2,400,000원'", () => {
      expect(formatWon(2400000)).toBe("2,400,000원");
    });
  });

  // ===== AC 3: 시간 함수 (시간 고정 필수) =====
  describe("AC-3: 시간 함수 (시간 고정)", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-09-29T01:00:00.000Z"));
    });

    it("should return ISO timestamp '2026-09-29T01:00:00.000Z' from nowIso()", () => {
      const result = nowIso();
      expect(result).toBe("2026-09-29T01:00:00.000Z");
    });

    it("should return false for invalid ISO timestamp 'not-a-date'", () => {
      expect(isIsoTimestamp("not-a-date")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isIsoTimestamp("")).toBe(false);
    });

    it("should return false for number 42", () => {
      expect(isIsoTimestamp(42 as any)).toBe(false);
    });
  });

  // ===== AC 4: 날짜 포맷 함수 =====
  describe("AC-4: 날짜 포맷 함수", () => {
    it("should return '2026-10' from monthKey(new Date(2026, 9, 1, 12))", () => {
      // new Date(2026, 9, 1, 12) => October (month is 0-based, so 9 = October)
      const result = monthKey(new Date(2026, 9, 1, 12));
      expect(result).toBe("2026-10");
    });

    it("should shift month backward: shiftMonth('2026-01', -1) => '2025-12'", () => {
      const result = shiftMonth("2026-01", -1);
      expect(result).toBe("2025-12");
    });

    it("should shift month forward: shiftMonth('2026-12', 1) => '2027-01'", () => {
      const result = shiftMonth("2026-12", 1);
      expect(result).toBe("2027-01");
    });

    it("should format month to Korean: formatMonthLabel('2026-09') => '2026년 9월'", () => {
      const result = formatMonthLabel("2026-09");
      expect(result).toBe("2026년 9월");
    });
  });

  // ===== AC 5: createId 고유성 =====
  describe("AC-5: createId 고유성", () => {
    it("should generate 1000 unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const id = createId();
        expect(typeof id).toBe("string");
        ids.add(id);
      }
      expect(ids.size).toBe(1000);
    });

    it("should generate string IDs with reasonable length", () => {
      const id = createId();
      expect(id.length).toBeGreaterThan(0);
      expect(id.length).toBeLessThan(100);
    });
  });
});
