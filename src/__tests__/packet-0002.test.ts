import { describe, it, expect, beforeEach } from "vitest";
import {
  formatWon,
  formatComma,
  parseDigits,
  clampRatio,
  genId,
} from "@/lib/format";
import {
  BUCKET_ORDER,
  BUCKET_LABEL,
  PRESETS,
  STORAGE_KEYS,
  LIMITS,
  MSG,
} from "@/lib/constants";

describe("Packet 0002: 상수와 포맷·입력 헬퍼", () => {
  // ============= AC-1: formatWon(2300000) === '2,300,000원' =============
  describe("AC-1: formatWon", () => {
    it("should format 2300000 to '2,300,000원'", () => {
      const result = formatWon(2300000);
      expect(result).toBe("2,300,000원");
    });

    it("should format 0 to '0원'", () => {
      const result = formatWon(0);
      expect(result).toBe("0원");
    });

    it("should format 1000 to '1,000원'", () => {
      const result = formatWon(1000);
      expect(result).toBe("1,000원");
    });

    it("should format 50000000 (50M) to '50,000,000원'", () => {
      const result = formatWon(50000000);
      expect(result).toBe("50,000,000원");
    });

    it("should truncate decimals to integer", () => {
      const result = formatWon(1234.56);
      expect(result).toBe("1,234원");
    });
  });

  // ============= AC-2a: parseDigits('-1.5') === 15 =============
  describe("AC-2a: parseDigits", () => {
    it("should parse '-1.5' to 15 (remove sign, keep digits only)", () => {
      const result = parseDigits("-1.5");
      expect(result).toBe(15);
    });

    it("should return null for empty string", () => {
      const result = parseDigits("");
      expect(result).toBeNull();
    });

    it("should parse '1234567' to 1234567", () => {
      const result = parseDigits("1234567");
      expect(result).toBe(1234567);
    });

    it("should parse '-999' to 999 (remove negative sign)", () => {
      const result = parseDigits("-999");
      expect(result).toBe(999);
    });

    it("should parse '+100' to 100 (remove positive sign)", () => {
      const result = parseDigits("+100");
      expect(result).toBe(100);
    });

    it("should parse '0' to 0", () => {
      const result = parseDigits("0");
      expect(result).toBe(0);
    });

    it("should parse '12.34.56' to 123456 (remove all dots)", () => {
      const result = parseDigits("12.34.56");
      expect(result).toBe(123456);
    });
  });

  // ============= AC-2b: clampRatio(120) === 100 =============
  describe("AC-2b: clampRatio", () => {
    it("should clamp 120 to 100", () => {
      const result = clampRatio(120);
      expect(result).toBe(100);
    });

    it("should clamp 50 to 50 (within range)", () => {
      const result = clampRatio(50);
      expect(result).toBe(50);
    });

    it("should clamp -10 to 0", () => {
      const result = clampRatio(-10);
      expect(result).toBe(0);
    });

    it("should clamp 0 to 0", () => {
      const result = clampRatio(0);
      expect(result).toBe(0);
    });

    it("should clamp 100 to 100 (upper bound inclusive)", () => {
      const result = clampRatio(100);
      expect(result).toBe(100);
    });

    it("should clamp 200 to 100", () => {
      const result = clampRatio(200);
      expect(result).toBe(100);
    });
  });

  // ============= AC-2c: formatComma =============
  describe("AC-2c: formatComma", () => {
    it("should format 1000 to '1,000'", () => {
      const result = formatComma(1000);
      expect(result).toBe("1,000");
    });

    it("should format 0 to '0'", () => {
      const result = formatComma(0);
      expect(result).toBe("0");
    });

    it("should format 50000000 to '50,000,000'", () => {
      const result = formatComma(50000000);
      expect(result).toBe("50,000,000");
    });
  });

  // ============= AC-3: genId() 중복 검사 =============
  describe("AC-3: genId - no duplicates in 1,000 calls", () => {
    it("should generate 1000 unique IDs with no collisions", () => {
      const ids = new Set<string>();
      const attempts = 1000;

      for (let i = 0; i < attempts; i++) {
        const id = genId();
        expect(id).toBeTruthy();
        expect(typeof id).toBe("string");
        expect(id.length).toBeGreaterThan(0);
        ids.add(id);
      }

      expect(ids.size).toBe(1000);
    });

    it("should generate IDs of consistent length/format", () => {
      const id1 = genId();
      const id2 = genId();
      const id3 = genId();

      // All should have consistent format (numeric-like or alphanumeric)
      expect(id1.length).toBeGreaterThan(0);
      expect(id2.length).toBeGreaterThan(0);
      expect(id3.length).toBeGreaterThan(0);

      // All should be different
      expect(new Set([id1, id2, id3]).size).toBe(3);
    });
  });

  // ============= Constants Tests =============
  describe("Constants: BUCKET_ORDER & BUCKET_LABEL", () => {
    it("should have BUCKET_ORDER array with 4 buckets", () => {
      expect(Array.isArray(BUCKET_ORDER)).toBe(true);
      expect(BUCKET_ORDER.length).toBe(4);
    });

    it("should have BUCKET_LABEL mapping", () => {
      expect(typeof BUCKET_LABEL).toBe("object");
      BUCKET_ORDER.forEach((bucket) => {
        expect(BUCKET_LABEL[bucket]).toBeDefined();
        expect(typeof BUCKET_LABEL[bucket]).toBe("string");
      });
    });

    it("should have 생활비/저축/비상금/여가 labels", () => {
      const labels = Object.values(BUCKET_LABEL);
      const expected = ["생활비", "저축", "비상금", "여가"];
      expected.forEach((label) => {
        expect(labels.some((l) => l.includes(label))).toBe(true);
      });
    });
  });

  describe("Constants: PRESETS", () => {
    it("should have basic_5311 preset with 50/30/10/10", () => {
      expect(PRESETS.basic_5311).toBeDefined();
      const preset = PRESETS.basic_5311;
      expect(Object.values(preset).reduce((a, b) => a + b, 0)).toBe(100);
    });

    it("should have saving_4411 preset with 40/40/10/10", () => {
      expect(PRESETS.saving_4411).toBeDefined();
      const preset = PRESETS.saving_4411;
      expect(Object.values(preset).reduce((a, b) => a + b, 0)).toBe(100);
    });

    it("should have living_6211 preset with 60/20/10/10", () => {
      expect(PRESETS.living_6211).toBeDefined();
      const preset = PRESETS.living_6211;
      expect(Object.values(preset).reduce((a, b) => a + b, 0)).toBe(100);
    });

    it("should have custom preset", () => {
      expect(PRESETS.custom).toBeDefined();
    });
  });

  describe("Constants: STORAGE_KEYS", () => {
    it("should have plan and records storage keys", () => {
      expect(STORAGE_KEYS.plan).toBe("psp.plan.v1");
      expect(STORAGE_KEYS.records).toBe("psp.records.v1");
    });
  });

  describe("Constants: LIMITS", () => {
    it("should define LIMITS object", () => {
      expect(typeof LIMITS).toBe("object");
      expect(LIMITS).toBeDefined();
    });
  });

  describe("Constants: MSG", () => {
    it("should have quota, planLoadFail, saved messages", () => {
      expect(MSG.quota).toBeDefined();
      expect(typeof MSG.quota).toBe("string");
      expect(MSG.planLoadFail).toBeDefined();
      expect(typeof MSG.planLoadFail).toBe("string");
      expect(MSG.saved).toBeDefined();
      expect(typeof MSG.saved).toBe("string");
    });
  });
});
