#!/usr/bin/env node
// 검수 규칙 자동 점검 (SPEC P-9 공통 AC — C1·C3·C4·C5·C6).
//
//   node scripts/audit-rules.mjs [rootDir]
//
// <rootDir>/src 아래 .ts/.tsx/.js/.jsx/.css 파일을 줄 단위로 훑는다. 위반이 있으면
// 위반 줄마다 `<상대경로>:<줄번호>  [규칙] 내용`을 출력하고 exit 1, 없으면 exit 0.
// 제외: 테스트·헬퍼(__tests__/, __helpers__/, *.test.*, *.spec.*)와 주석 줄(//, *, /*로 시작).
// 의존성 0 — node 내장 모듈만 쓴다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(process.argv[2] ?? DEFAULT_ROOT);
const srcDir = join(root, "src");

const EXTENSIONS = /\.(ts|tsx|js|jsx|css)$/;
const EXCLUDED_DIRS = new Set(["__tests__", "__helpers__", "node_modules"]);
const EXCLUDED_FILE = /\.(test|spec)\.[^.]+$/;
const COMMENT_LINE = /^(\/\/|\*|\/\*)/;

// 템플릿이 깐 파일 — 이 앱 코드가 아니므로 HEX 규칙(AC-C3 "템플릿 외 src")에서만 뺀다.
const TEMPLATE_FILES = new Set(["src/styles/reward-ad.css"]);

// 순서 = 보고 순서. `skipTemplate`이면 TEMPLATE_FILES에서는 검사하지 않는다.
const RULES = [
  {
    id: "C3 HEX 색상",
    pattern: /#[0-9a-fA-F]{3,8}\b/,
    skipTemplate: true,
  },
  {
    id: "C4 설치 유도 문구",
    pattern: /설치하세요|다운로드|앱 받기/,
  },
  {
    id: "C6 외부 분석 SDK",
    pattern:
      /["'](react-ga4?|@amplitude\/[^"']*|amplitude-js|mixpanel(-browser)?|firebase\/analytics|@firebase\/analytics|@segment\/[^"']*|react-gtm-module|@vercel\/analytics)["']|\bgtag\s*\(|googletagmanager\.com|google-analytics\.com/,
  },
  {
    id: "C5 구형 WebView 위험 API",
    pattern: /structuredClone|\.at\(|Object\.hasOwn|\.findLast\(|\.toSorted\(|randomUUID/,
  },
  {
    id: "C1 외부 도메인 이탈",
    pattern: /window\.open\(\s*["'`]https?:|(window\.)?location\.href\s*=(?!=)\s*["'`]https?:/,
  },
];

function toPosix(p) {
  return p.split(sep).join("/");
}

function collectFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of entries.sort()) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!EXCLUDED_DIRS.has(name)) out.push(...collectFiles(full));
    } else if (EXTENSIONS.test(name) && !EXCLUDED_FILE.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const files = collectFiles(srcDir);
const violations = [];

for (const file of files) {
  const rel = toPosix(relative(root, file));
  const isTemplate = TEMPLATE_FILES.has(rel);
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || COMMENT_LINE.test(trimmed)) return;
    for (const rule of RULES) {
      if (rule.skipTemplate && isTemplate) continue;
      if (rule.pattern.test(line)) {
        violations.push({ loc: `${rel}:${i + 1}`, rule: rule.id, text: trimmed.slice(0, 120) });
      }
    }
  });
}

if (violations.length > 0) {
  console.log(`audit-rules: 위반 ${violations.length}건`);
  for (const v of violations) console.log(`${v.loc}  [${v.rule}] ${v.text}`);
  process.exit(1);
}

console.log(`audit-rules: 위반 0건 (파일 ${files.length}개 점검)`);
process.exit(0);
