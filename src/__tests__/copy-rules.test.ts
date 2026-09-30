import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// 화면 문구 규칙을 소스 텍스트로 대조한다(렌더 없이 — 모든 화면·컴포넌트를 한 번에 본다).
//  · 앱 표시 이름은 "월급쪼개기" 하나(manifest koreanName). 띄어 쓴 "월급 쪼개기"·영문 "PaySplitPlan"은 화면에 쓰지 않는다.
//  · 손실 프레이밍("끊겼"·"놓쳤") 금지, 다이얼로그 왼쪽 버튼은 "닫기"("취소" 금지) — 토스 UX 라이팅.
const ROOT = resolve(__dirname, "..", "..");
const SCAN_DIRS = [join(ROOT, "src", "pages"), join(ROOT, "src", "components")];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : walk(full);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\./.test(name) ? [full] : [];
  });
}

const files = SCAN_DIRS.flatMap(walk);

function hits(pattern: RegExp): string[] {
  return files.flatMap((f) =>
    readFileSync(f, "utf8")
      .split("\n")
      .flatMap((line, i) => (pattern.test(line) ? [`${relative(ROOT, f)}:${i + 1}`] : [])),
  );
}

describe("카피 규칙 — 앱 이름·손실 프레이밍·닫기", () => {
  it("스캔 대상이 실제로 있다(빈 목록으로 초록이 되지 않게)", () => {
    expect(files.some((f) => f.endsWith(join("pages", "Home.tsx")))).toBe(true);
    expect(files.some((f) => f.endsWith(join("components", "home", "ChecklistCard.tsx")))).toBe(true);
  });

  it("src/pages·src/components에 '월급 쪼개기'·'PaySplitPlan'이 0건이다", () => {
    expect(hits(/월급 쪼개기/)).toEqual([]);
    expect(hits(/PaySplitPlan/)).toEqual([]);
  });

  it("index.html의 제목은 '월급쪼개기'다", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    expect(html).toContain("<title>월급쪼개기</title>");
  });

  it("손실 프레이밍('끊겼'·'놓쳤')이 0건이다", () => {
    expect(hits(/끊겼|놓쳤/)).toEqual([]);
  });

  it("다이얼로그 cancelButton에 '취소'를 쓰지 않는다", () => {
    expect(hits(/cancelButton:\s*["'`]취소/)).toEqual([]);
  });
});
