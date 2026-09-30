import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BRAND, CATEGORY_COLOR, CATEGORY_TINT, SPLIT_LABEL, SURFACE } from "@/lib/theme";

// 색 원천 대조 — 앱이 그리는 색은 전부 tds-colors adaptive 토큰이고(다크 모드에서 저절로 바뀐다),
// 브랜드 HEX는 apps-in-toss.config.ts 하나이며 그 값은 라이트 --adaptiveGreen800이다(토스 파랑 아님).
const ROOT = resolve(__dirname, "..", "..", "..");
const COLORS_DIR = join(ROOT, "node_modules", "@toss", "tds-colors");
const light = readFileSync(join(COLORS_DIR, "colors.light.css"), "utf8");
const dark = readFileSync(join(COLORS_DIR, "colors.dark.css"), "utf8");
const config = readFileSync(join(ROOT, "apps-in-toss.config.ts"), "utf8");

function tokenValue(css: string, name: string): string | null {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m ? m[1].trim().toLowerCase() : null;
}

const TOKEN_RE = /^var\(--(adaptive[A-Za-z]+\d*)\)$/;
const tokenName = (v: string) => (v.match(TOKEN_RE) ?? [])[1];

describe("P3-01 브랜드색", () => {
  const brandHex = (config.match(/primaryColor:\s*['"](#[0-9a-fA-F]{6})['"]/) ?? [])[1]?.toLowerCase();

  it("config에서 primaryColor HEX를 읽을 수 있다(대조가 빈 값으로 초록이 되지 않게)", () => {
    expect(brandHex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("브랜드 HEX = tds-colors 라이트 --adaptiveGreen800", () => {
    const green800 = tokenValue(light, "adaptiveGreen800");
    expect(green800).toMatch(/^#[0-9a-f]{6}$/);
    expect(brandHex).toBe(green800);
  });

  it("토스 기본 파랑(#3182f6)이 아니다", () => {
    expect(brandHex).not.toBe("#3182f6");
  });

  it("앱 쪽 브랜드 accent 토큰도 같은 Green800이다", () => {
    expect(tokenName(BRAND.accent)).toBe("adaptiveGreen800");
  });
});

describe("P3-02 토큰 원천", () => {
  const all = [
    ...Object.values(CATEGORY_COLOR),
    ...Object.values(CATEGORY_TINT),
    ...Object.values(BRAND),
    ...Object.values(SURFACE),
  ];

  it("CATEGORY_COLOR·CATEGORY_TINT 값은 전부 var(--adaptive…) 토큰이다", () => {
    for (const v of [...Object.values(CATEGORY_COLOR), ...Object.values(CATEGORY_TINT)]) {
      expect(v).toMatch(TOKEN_RE);
    }
  });

  it("참조한 토큰이 전부 colors.light.css와 colors.dark.css 둘 다에 있다", () => {
    const names = [...new Set(all.map(tokenName))];
    expect(names.length).toBeGreaterThan(5);
    for (const name of names) {
      expect(name, "토큰 형식").toBeTruthy();
      expect(tokenValue(light, name), `${name} (light)`).not.toBeNull();
      expect(tokenValue(dark, name), `${name} (dark)`).not.toBeNull();
    }
  });

  it("통장 다섯 가지(고정비 포함)가 서로 다른 색이고, 라벨이 있다", () => {
    const keys = ["fixed", "living", "saving", "emergency", "leisure"] as const;
    expect(new Set(keys.map((k) => CATEGORY_COLOR[k])).size).toBe(5);
    expect(keys.map((k) => SPLIT_LABEL[k])).toEqual(["고정비", "생활비", "저축", "비상금", "여가"]);
  });

  it("여가에 노랑을 쓰지 않고(흰 바탕 대비 부족), 어떤 통장도 파랑이 아니다", () => {
    expect(CATEGORY_COLOR.leisure).not.toMatch(/Yellow/);
    for (const v of Object.values(CATEGORY_COLOR)) expect(v).not.toMatch(/Blue/);
  });

  it("theme.ts에 HEX가 없다", () => {
    const src = readFileSync(join(ROOT, "src", "lib", "theme.ts"), "utf8");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
