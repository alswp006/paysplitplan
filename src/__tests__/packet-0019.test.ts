import { describe, it, expect, afterAll } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

// ── 계약 (Coder가 이 시그니처대로 만든다) ──
// scripts/audit-rules.mjs  (순수 node ESM, 의존성 0)
//   - `node scripts/audit-rules.mjs [rootDir]` — rootDir 기본값은 레포 루트(scripts/의 상위).
//     `<rootDir>/src` 아래 .ts/.tsx/.js/.jsx/.css 파일을 훑는다.
//   - 제외: 테스트·헬퍼(`__tests__/`, `__helpers__/`, `*.test.*`, `*.spec.*`)와 주석 줄(`//`, `*`, `/*`로 시작).
//   - 위반 규칙 5종(하나라도 있으면 위반 줄마다 `<rootDir 기준 상대경로>:<줄번호>`를 출력하고 exit 1, 없으면 exit 0):
//       ① HEX 색  /#[0-9a-fA-F]{3,8}\b/
//       ② 설치 유도 문구  '설치하세요|다운로드|앱 받기'
//       ③ 외부 분석 SDK  (react-ga · gtag · amplitude · mixpanel · firebase/analytics 등)
//       ④ 구형 WebView 위험 API  'structuredClone|\.at\(|Object\.hasOwn|\.findLast\(|\.toSorted\(|randomUUID'
//       ⑤ http(s) URL로의 window.open(...) · window.location.href = ...
// src/__tests__/fullFlow.test.tsx
//   - VITE_TOSS_AD_SLOT_ID·VITE_TOSS_AD_GROUP_ID를 빈 값으로 stub한 채
//     / → /plan → /result 저장 → 홈 체크 4개 → /history → /does-not-exist → 홈을 끝까지 수행한다.
//   - console.error 스파이 0회, 'No routes matched'를 포함한 console.warn 0회를 단언한다.
//   - App.tsx / main.tsx는 건드리지 않는다.

const ROOT = resolve(__dirname, "..", "..");
const SCRIPT = join(ROOT, "scripts", "audit-rules.mjs");
const FULL_FLOW = join(ROOT, "src", "__tests__", "fullFlow.test.tsx");

// 정책 스캐너가 fixture 문자열을 실제 코드로 오인하지 않도록 조각으로 조립한다.
const OPEN = ["window", "open"].join(".");
const HREF = ["window", "location", "href"].join(".");
const EXAMPLE = ["example", "com"].join(".");

function audit(root?: string) {
  const args = root ? [SCRIPT, root] : [SCRIPT];
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
  return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const tmpRoots: string[] = [];
function makeFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "audit-rules-"));
  tmpRoots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

afterAll(() => {
  for (const r of tmpRoots) rmSync(r, { recursive: true, force: true });
});

// 위반은 모두 3번째 줄에 둔다 — 출력에 `파일:3`이 있는지로 위치 보고를 검증한다.
const line3 = (code: string) => `// 위반 fixture\nexport {};\n${code}\n`;

describe("광고 fail-open 확인 + 검수 규칙 자동 점검 + 전체 흐름 테스트", () => {
  it("AC-1[P0]: 실제 레포에서 `node scripts/audit-rules.mjs`가 exit 0이고 위반 출력이 없다", () => {
    expect(existsSync(SCRIPT)).toBe(true);

    const { status, out } = audit();

    expect(status).toBe(0);
    expect(out).not.toMatch(/src\/[^\s:]+:\d+/);
  });

  it("AC-1[P0]: 규칙 5종 위반을 각각 `파일:줄`로 출력하고 exit 1이다", () => {
    const root = makeFixture({
      "src/bad-hex.tsx": line3('const color = "#3182F6";'),
      "src/bad-hex-short.tsx": line3('const color = "#fff";'),
      "src/bad-install-1.tsx": line3("const a = <p>앱을 설치하세요</p>;"),
      "src/bad-install-2.tsx": line3("const a = <p>파일 다운로드</p>;"),
      "src/bad-install-3.tsx": line3("const a = <p>앱 받기</p>;"),
      "src/bad-analytics-ga.ts": line3('import ReactGA from "react-ga";'),
      "src/bad-analytics-amp.ts": line3('import * as amplitude from "@amplitude/analytics-browser";'),
      "src/bad-api-clone.ts": line3("const b = structuredClone(a);"),
      "src/bad-api-at.ts": line3("const b = list.at(-1);"),
      "src/bad-api-hasown.ts": line3("const b = Object.hasOwn(a, 'x');"),
      "src/bad-api-findlast.ts": line3("const b = list.findLast((x) => x > 1);"),
      "src/bad-api-toSorted.ts": line3("const b = list.toSorted();"),
      "src/bad-api-uuid.ts": line3("const b = crypto.randomUUID();"),
      "src/bad-nav-open.ts": line3(`${OPEN}("https://${EXAMPLE}");`),
      "src/bad-nav-href.ts": line3(`${HREF} = "http://${EXAMPLE}";`),
    });

    const { status, out } = audit(root);

    expect(status).toBe(1);
    for (const name of [
      "bad-hex.tsx",
      "bad-hex-short.tsx",
      "bad-install-1.tsx",
      "bad-install-2.tsx",
      "bad-install-3.tsx",
      "bad-analytics-ga.ts",
      "bad-analytics-amp.ts",
      "bad-api-clone.ts",
      "bad-api-at.ts",
      "bad-api-hasown.ts",
      "bad-api-findlast.ts",
      "bad-api-toSorted.ts",
      "bad-api-uuid.ts",
      "bad-nav-open.ts",
      "bad-nav-href.ts",
    ]) {
      expect(out, `${name}:3 이 출력에 있어야 한다`).toMatch(new RegExp(`${name.replace(/\./g, "\\.")}:3\\b`));
    }
  });

  it("AC-1[P0]: 테스트 파일·주석 줄·CSS 변수·내부 이동은 위반으로 세지 않아 exit 0이다", () => {
    const root = makeFixture({
      "src/ok.tsx": [
        "// 외부 로깅 툴(GA·Amplitude·gtag)은 금지다 — 주석은 위반이 아니다",
        "/**",
        " * 색은 #3182F6 대신 var(--adaptiveBlue500). 설치하세요 같은 문구 금지. structuredClone 금지.",
        " */",
        'export const style = { color: "var(--adaptiveGrey600)" };',
        'export const anchor = "#top";',
        'export const label = "이번 달 이체 완료";',
        "export const last = [1, 2, 3].slice(-1)[0];",
        'export const go = (navigate: (p: string) => void) => navigate("/history");',
        "",
      ].join("\n"),
      "src/__tests__/sample.test.ts": `const c = "#3182F6"; structuredClone(c); ${OPEN}("https://${EXAMPLE}");\n`,
      "src/lib/__tests__/deep.test.ts": "const x = list.at(-1); list.toSorted();\n",
      "src/__tests__/__helpers__/mocks.ts": 'export const c = "#fff"; export const u = crypto.randomUUID();\n',
    });

    const { status, out } = audit(root);

    expect(status).toBe(0);
    expect(out).not.toMatch(/ok\.tsx:\d+|\.test\.ts:\d+|mocks\.ts:\d+/);
  });

  it("AC-1[P0]: 위반이 섞이면 깨끗한 파일은 목록에 없고 위반 줄만 보고한다", () => {
    const root = makeFixture({
      "src/clean.ts": "export const total = (a: number, b: number) => a + b;\n",
      "src/pages/Dirty.tsx": '// 헤더\nexport {};\nexport const s = { background: "#FFFFFF" };\n',
    });

    const { status, out } = audit(root);

    expect(status).toBe(1);
    expect(out).toMatch(/pages\/Dirty\.tsx:3\b/);
    expect(out).not.toMatch(/clean\.ts:\d+/);
  });

  it("AC-2[P0]: fullFlow 테스트가 광고 env 두 개를 빈 값으로 두고 전체 경로를 훑는다", () => {
    expect(existsSync(FULL_FLOW)).toBe(true);
    const src = readFileSync(FULL_FLOW, "utf8");

    expect(src).toMatch(/vi\.stubEnv\(\s*["']VITE_TOSS_AD_SLOT_ID["']\s*,\s*["']["']\s*\)/);
    expect(src).toMatch(/vi\.stubEnv\(\s*["']VITE_TOSS_AD_GROUP_ID["']\s*,\s*["']["']\s*\)/);
    for (const path of ["/plan", "/result", "/history", "/does-not-exist"]) {
      expect(src, `${path} 경로를 방문해야 한다`).toContain(path);
    }
    expect(src).toContain("4/4 완료 · 100%");
    expect(src).toMatch(/free-tier/);
    expect(src).toMatch(/locked-tier/);
  });

  it("AC-3[P0]: fullFlow 테스트가 console.error 0회·'No routes matched' console.warn 0회를 단언한다", () => {
    expect(existsSync(FULL_FLOW)).toBe(true);
    const src = readFileSync(FULL_FLOW, "utf8");

    expect(src).toMatch(/vi\.spyOn\(\s*console\s*,\s*["']error["']/);
    expect(src).toMatch(/vi\.spyOn\(\s*console\s*,\s*["']warn["']/);
    expect(src).toContain("No routes matched");
    expect(src).toMatch(/(toHaveBeenCalledTimes\(\s*0\s*\)|not\.toHaveBeenCalled\(\s*\))/);
  });

  it("AC-2·AC-3[P0]: fullFlow 테스트를 실제로 돌리면 통과한다(exit 0)", () => {
    expect(existsSync(FULL_FLOW)).toBe(true);

    const r = spawnSync("npx", ["vitest", "run", "src/__tests__/fullFlow.test.tsx"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 240_000,
      env: { ...process.env, VITE_TOSS_AD_SLOT_ID: "", VITE_TOSS_AD_GROUP_ID: "" },
    });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;

    expect(out).toMatch(/Tests\s+\d+ passed/);
    expect(r.status).toBe(0);
  }, 300_000);

  it("AC-1[P0]: App.tsx와 main.tsx는 이 패킷에서 수정되지 않았다(diff 0줄)", () => {
    const diff = execSync("git diff HEAD -- src/App.tsx src/main.tsx", { cwd: ROOT, encoding: "utf8" });
    const app = readFileSync(join(ROOT, "src", "App.tsx"), "utf8");

    expect(diff).toBe("");
    expect((app.match(/<Route\b/g) ?? []).length).toBe(5);
  });
});
