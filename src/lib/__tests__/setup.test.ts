import { describe, it, expect } from "vitest";
import { buildSetupRows, buildSetupSheetText, setupSignature, transferDayLabel } from "@/lib/setup";
import type { FixedCost, PlanDraft } from "@/lib/types";

const TS = "2026-09-01T00:00:00.000Z";
const fc = (id: string, name: string, amount: number): FixedCost => ({ id, name, amount, createdAt: TS, updatedAt: TS });

// 시드 B — 가용 2,155,000 → 862,000 / 862,000 / 215,500 / 215,500, 이체일 매달 11일
const SEED_B: PlanDraft = {
  salary: 2_850_000,
  fixedCosts: [fc("fc_rent", "월세", 550_000), fc("fc_phone", "통신비", 65_000), fc("fc_bus", "교통비", 80_000)],
  presetId: "p442",
  ratios: [40, 40, 10, 10],
  payday: 10,
};

describe("transferDayLabel — 이체일 표기", () => {
  it("월급 다음 날이 모든 달에 있으면 '매달 N일', 29일 이후면 '월급날 다음 날'", () => {
    expect(transferDayLabel(10)).toBe("매달 11일");
    expect(transferDayLabel(27)).toBe("매달 28일");
    expect(transferDayLabel(28)).toBe("월급날 다음 날");
    expect(transferDayLabel(31)).toBe("월급날 다음 날");
  });
});

describe("세팅표", () => {
  it("시드 B 전체 복사 문자열은 정확히 5줄이다", () => {
    expect(buildSetupSheetText(SEED_B).split("\n")).toEqual([
      "월급쪼개기 세팅표 · 매달 11일 이체",
      "생활비 통장 862,000원",
      "저축 통장 862,000원",
      "비상금 통장 215,500원",
      "여가 통장 215,500원",
    ]);
  });

  it("여가 0%면 여가 통장 줄이 빠져 4줄이다", () => {
    const text = buildSetupSheetText({ ...SEED_B, ratios: [50, 40, 10, 0] });
    expect(text.split("\n")).toHaveLength(4);
    expect(text).not.toContain("여가");
  });

  it("생활비 0%면 내림 잔액(1원) 행을 세팅표에 넣지 않는다 — 몇 원짜리 자동이체를 시키지 않는다(review 0930)", () => {
    const draft = { ...SEED_B, fixedCosts: [], salary: 3_000_001, ratios: [0, 50, 25, 25] as PlanDraft["ratios"] };
    expect(buildSetupRows(draft).map((r) => r.key)).toEqual(["saving", "emergency", "leisure"]);
    expect(buildSetupSheetText(draft)).not.toContain("생활비");
  });

  it("행의 복사 값은 콤마 없는 숫자만이다(시드 B 저축 '862000')", () => {
    const rows = buildSetupRows(SEED_B);
    expect(rows.map((r) => r.key)).toEqual(["living", "saving", "emergency", "leisure"]);
    const saving = rows.find((r) => r.key === "saving")!;
    expect(saving).toMatchObject({ label: "저축 통장", ratio: 40, amount: 862_000, copyText: "862000" });
  });

  it("서명은 월급날과 통장별 금액으로 만든다 — 금액이 같으면 같고 다르면 다르다", () => {
    expect(setupSignature(SEED_B)).toBe("10|862000|862000|215500|215500");
    // 비율·고정비 구성이 달라도 넣을 금액·날짜가 같으면 같은 서명
    expect(setupSignature({ ...SEED_B, fixedCosts: [fc("fc_all", "고정비 합계", 695_000)] })).toBe(setupSignature(SEED_B));
    expect(setupSignature({ ...SEED_B, ratios: [60, 20, 10, 10] })).not.toBe(setupSignature(SEED_B));
    expect(setupSignature({ ...SEED_B, payday: 25 })).not.toBe(setupSignature(SEED_B));
  });
});
