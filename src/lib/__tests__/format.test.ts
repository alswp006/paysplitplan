import { describe, it, expect } from "vitest";
import { formatWon, formatKrw, formatPercent, formatComma, parseDigits, clampRatio, genId } from "@/lib/format";
import { MSG } from "@/lib/constants";

describe("formatWon", () => {
  it("formats 2300000 as '2,300,000원'", () => {
    expect(formatWon(2300000)).toBe("2,300,000원");
  });

  it("formats 0 as '0원'", () => {
    expect(formatWon(0)).toBe("0원");
  });
});

describe("formatKrw", () => {
  it("formats an integer amount without decimals by default", () => {
    expect(formatKrw(2300000)).toBe("2,300,000원");
  });

  it("formats with the requested number of decimals", () => {
    expect(formatKrw(2300000.5, { decimals: 1 })).toBe("2,300,000.5원");
  });
});

describe("formatPercent", () => {
  it("formats 75 as '75%' with no decimals by default", () => {
    expect(formatPercent(75)).toBe("75%");
  });

  it("formats with the requested number of decimals", () => {
    expect(formatPercent(83.333, 1)).toBe("83.3%");
  });
});

describe("formatComma", () => {
  it("formats 1000 as '1,000'", () => {
    expect(formatComma(1000)).toBe("1,000");
  });
});

describe("parseDigits", () => {
  it("keeps only digits, dropping sign and dot", () => {
    expect(parseDigits("-1.5")).toBe(15);
  });

  it("returns null for empty string", () => {
    expect(parseDigits("")).toBeNull();
  });

  it("returns null when no digits are present", () => {
    expect(parseDigits("abc")).toBeNull();
  });
});

describe("clampRatio", () => {
  it("clamps values above 100 down to 100", () => {
    expect(clampRatio(120)).toBe(100);
  });

  it("clamps values below 0 up to 0", () => {
    expect(clampRatio(-10)).toBe(0);
  });

  it("leaves in-range values unchanged", () => {
    expect(clampRatio(42)).toBe(42);
  });
});

describe("genId", () => {
  it("generates 1000 ids with no duplicates", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => genId()));
    expect(ids.size).toBe(1000);
  });
});

describe("MSG", () => {
  it("matches the agreed copy", () => {
    expect(MSG.quota).toBe("저장 공간이 부족해 저장하지 못했어요");
    expect(MSG.planLoadFail).toBe("저장된 계획을 불러오지 못했어요");
    expect(MSG.saved).toBe("계획을 저장했어요");
  });
});
