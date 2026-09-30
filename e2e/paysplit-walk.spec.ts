import { test, expect, type Page } from "@playwright/test";
import { IGNORED_CONSOLE } from "./console-allowlist";

/**
 * 월급쪼개기 실사용 walk — jsdom이 못 보는 것(스크롤·토스트 위치·실제 TDS 접근성 트리·네트워크·콘솔)을
 * 실제 브라우저에서 잰다. 390×844 · ko-KR · Asia/Seoul · 기준 시각 2026-09-29 09:00 KST(기존 단위 테스트와 같다).
 *
 * 시드(고도화 스펙 §3)
 *  - 시드 A: 월급 3,000,000 · 월세 600,000 · 50/30/10/10 · 월급날 25 → 1,200,000 / 720,000 / 240,000 / 240,000
 *  - 시드 B: 월급 2,850,000 · 월세 550,000·통신비 65,000·교통비 80,000 · 40/40/10/10 · 월급날 10
 *            → 862,000 / 862,000 / 215,500 / 215,500
 */

test.use({ locale: "ko-KR", timezoneId: "Asia/Seoul", viewport: { width: 390, height: 844 } });

const TS = "2026-09-01T00:00:00.000Z";
const BASE_TIME = "2026-09-29T09:00:00+09:00";
const PLAN_KEY = "paysplit:plan:v1";
const RECORDS_KEY = "paysplit:records:v1";

type Ratios = [number, number, number, number];
type Key = "living" | "saving" | "emergency" | "leisure";
const KEYS: Key[] = ["living", "saving", "emergency", "leisure"];

function fixed(id: string, name: string, amount: number) {
  return { id, name, amount, createdAt: TS, updatedAt: TS };
}

function makePlan(opts: { salary: number; fixedCosts: ReturnType<typeof fixed>[]; ratios: Ratios; payday: number; presetId?: string }) {
  return {
    version: 1,
    id: "plan_walk",
    salary: opts.salary,
    fixedCosts: opts.fixedCosts,
    presetId: opts.presetId ?? "custom",
    ratios: opts.ratios,
    payday: opts.payday,
    createdAt: TS,
    updatedAt: TS,
  };
}

const SEED_A = makePlan({ salary: 3_000_000, fixedCosts: [fixed("fc_rent", "월세", 600_000)], ratios: [50, 30, 10, 10], payday: 25, presetId: "p532" });
const SEED_B = makePlan({
  salary: 2_850_000,
  fixedCosts: [fixed("fc_rent", "월세", 550_000), fixed("fc_phone", "통신비", 65_000), fixed("fc_bus", "교통비", 80_000)],
  ratios: [40, 40, 10, 10],
  payday: 10,
  presetId: "p442",
});

/** 현재 계획 기준 배분(앱 plan.ts와 같은 규칙 — 저축·비상금·여가는 내림, 잔액은 생활비). */
function allocate(salary: number, fixedTotal: number, ratios: Ratios) {
  const available = salary - fixedTotal;
  const saving = Math.floor((available * ratios[1]) / 100);
  const emergency = Math.floor((available * ratios[2]) / 100);
  const leisure = Math.floor((available * ratios[3]) / 100);
  return { available, amounts: { living: available - saving - emergency - leisure, saving, emergency, leisure } };
}

function makeRecord(month: string, plan: typeof SEED_A, on: Key[]) {
  const fixedTotal = plan.fixedCosts.reduce((s, c) => s + c.amount, 0);
  const { available, amounts } = allocate(plan.salary, fixedTotal, plan.ratios);
  const eligible = KEYS.filter((k) => amounts[k] > 0);
  const checked = { living: false, saving: false, emergency: false, leisure: false };
  for (const k of on) checked[k] = true;
  const rate = Math.round((eligible.filter((k) => checked[k]).length / eligible.length) * 100);
  return {
    id: `rec_${month}`,
    planId: plan.id,
    month,
    checked,
    eligible,
    rate,
    completedAt: rate === 100 ? TS : null,
    snapshot: { salary: plan.salary, fixedTotal, available, ratios: plan.ratios, amounts },
    createdAt: TS,
    updatedAt: TS,
  };
}

// ── 헬퍼 ──

/**
 * localStorage 원문을 앱 스크립트보다 먼저 넣는다. 새로고침 때 다시 덮어쓰지 않도록 탭당 1회만(sessionStorage 표식).
 */
async function seedRaw(page: Page, entries: Record<string, string>) {
  await page.addInitScript((e: Record<string, string>) => {
    for (const [key, value] of Object.entries(e)) {
      const mark = `__walk_seeded:${key}`;
      if (sessionStorage.getItem(mark)) continue;
      localStorage.setItem(key, value);
      sessionStorage.setItem(mark, "1");
    }
  }, entries);
}

async function seedPlan(page: Page, plan: object) {
  await seedRaw(page, { [PLAN_KEY]: JSON.stringify(plan) });
}

async function seedRecords(page: Page, records: ReturnType<typeof makeRecord>[]) {
  await seedRaw(page, {
    [RECORDS_KEY]: JSON.stringify({ version: 1, records: Object.fromEntries(records.map((r) => [r.month, r])) }),
  });
}

/**
 * 기기 시각을 옮긴다(그 시각부터 실제 속도로 흐른다). setFixedTime은 쓰지 않는다 — 시계를 멈추면
 * performance.now까지 멈춰 TDS 토스트·CountUp 애니메이션이 첫 프레임(opacity 0, 화면 밖)에 굳는다(실측).
 */
async function atTime(page: Page, iso: string = BASE_TIME) {
  await page.clock.setSystemTime(new Date(iso));
}

/**
 * 콘솔 에러(알려진 브라우저 전용 에러 제외)·페이지 에러·static.toss.im 요청·실패한 요청을 모은다.
 * 테스트 끝에 `expectClean()`으로 단언한다.
 */
function consoleGuard(page: Page) {
  const errors: string[] = [];
  const tossStatic: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORED_CONSOLE.some((re) => re.test(m.text()))) {
      const loc = m.location();
      errors.push(`${m.text()} @ ${loc.url}:${loc.lineNumber}`);
    }
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("request", (r) => {
    try {
      if (new URL(r.url()).hostname === "static.toss.im") tossStatic.push(r.url());
    } catch {
      /* data: 등 */
    }
  });
  page.on("requestfailed", (r) => failed.push(`${r.url()} — ${r.failure()?.errorText ?? "?"}`));
  return {
    errors,
    tossStatic,
    failed,
    expectClean() {
      expect(errors, `콘솔 에러(실패한 요청: ${failed.join(" | ") || "없음"})`).toEqual([]);
      expect(tossStatic, "static.toss.im 요청").toEqual([]);
    },
  };
}

/** navigator.share를 가로채 공유 텍스트를 window.__shared에 담는다(SDK share는 WebView 밖에서 throw → 웹 공유 폴백). */
async function captureShare(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: { text?: string }) => {
        (window as unknown as { __shared?: string }).__shared = data?.text ?? "";
      },
    });
  });
}

const AMOUNT_RE = /\d{1,3}(,\d{3})+원|만 원/;

test.describe("phase 1", () => {
  test("N2: 계획을 바꿔 저장하면 홈과 기록이 같은 이행률(75%)을 보인다", async ({ page }) => {
    const guard = consoleGuard(page);
    const old = makePlan({ salary: 3_000_000, fixedCosts: [fixed("fc_rent", "월세", 600_000)], ratios: [60, 30, 10, 0], payday: 25 });
    await atTime(page);
    await seedPlan(page, old);
    await seedRecords(page, [makeRecord("2026-09", old, ["living", "saving", "emergency"])]);

    await page.goto("/");
    await page.getByRole("button", { name: "계획 수정" }).click();
    await page.getByRole("button", { name: "기본 5:3:1:1" }).click();
    await page.getByRole("button", { name: "배분 결과 보기" }).click();
    await page.getByRole("button", { name: "이 계획 저장하기" }).click();
    await page.getByRole("button", { name: "바꾸기" }).click();
    await page.getByRole("button", { name: "홈에서 이체 체크하기" }).click();

    await expect(page.getByTestId("progress-text")).toHaveText("3/4 완료 · 75%");

    await page.getByRole("tab", { name: "기록" }).click();
    await expect(page.getByTestId("history-hero")).toContainText("75");
    const first = page.getByTestId("month-row").first();
    await expect(first).toContainText("75%");
    await expect(first.getByText("완료", { exact: true })).toHaveCount(0);
    guard.expectClean();
  });

  test("D1: 긴 계획 화면 끝에서 결과로 가면 결과 화면은 맨 위에서 열린다", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    await seedPlan(page, SEED_B);
    await page.goto("/plan");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);

    await page.getByRole("button", { name: "배분 결과 보기" }).click();
    await page.waitForURL(/\/result$/);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    guard.expectClean();
  });

  test("N3: 공유는 월급·금액 없이 비율만 보낸다", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    await captureShare(page);
    await seedPlan(page, SEED_B);
    await page.goto("/result");
    await page.getByRole("button", { name: "비율 공유하기" }).click();

    await expect.poll(() => page.evaluate(() => (window as unknown as { __shared?: string }).__shared ?? null)).not.toBeNull();
    const shared = await page.evaluate(() => (window as unknown as { __shared?: string }).__shared ?? "");
    expect(shared).toContain("생활비 40 · 저축 40 · 비상금 10 · 여가 10");
    expect(shared).not.toMatch(AMOUNT_RE);
    guard.expectClean();
  });

  test("N9: 월급날 당일 홈은 'D-0' 대신 '오늘은 월급날이에요'를 보인다", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page, "2026-10-25T09:00:00+09:00");
    await seedPlan(page, SEED_A);
    await page.goto("/");
    await expect(page.getByTestId("dday-hero")).toContainText("오늘은 월급날이에요");
    expect(await page.locator("body").innerText()).not.toMatch(/D-0(?!\d)/);
    guard.expectClean();
  });

  test("N10: 3/4에서 마지막 스위치를 켜면 완료 토스트가 하단 탭 바 위에 뜬다", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    await seedPlan(page, SEED_A);
    await seedRecords(page, [makeRecord("2026-09", SEED_A, ["living", "saving", "emergency"])]);
    await page.goto("/");

    await page.getByRole("switch", { name: "여가 통장 이체 완료" }).click();
    // 토스트는 TDS 포털의 aria-live 영역에 뜬다(같은 포털에 TDS가 글자 폭을 재는 화면 밖 복사본(y≈-9985)이 하나 더 있다).
    const toast = page.locator('#tds-mobile-portal-container [aria-live="polite"]').getByText("9월 이체를 모두 체크했어요");
    const tabTop = (await page.getByRole("tablist").boundingBox())!.y;
    await expect
      .poll(
        async () => {
          const box = await toast.boundingBox();
          return box ? box.y + box.height <= tabTop : false;
        },
        { timeout: 1000 },
      )
      .toBe(true);
    await expect(page.getByTestId("dday-hero")).toContainText("9월 이체 완료");
    guard.expectClean();
  });

  test("N5: 체크리스트 스위치는 버튼 안에 있지 않다", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    await seedPlan(page, SEED_A);
    await page.goto("/");
    await expect(page.getByRole("switch")).toHaveCount(4);
    expect(await page.locator("[role=button] [role=switch]").count()).toBe(0);
    guard.expectClean();
  });

  test("N4: 계획 화면 월급 칸의 접근성 이름은 '월급'이다", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    await page.goto("/plan");
    await expect(page.getByRole("textbox", { name: "월급", exact: true })).toHaveCount(1);
    await expect(page.getByRole("textbox", { name: "월급날", exact: true })).toHaveCount(1);
    guard.expectClean();
  });

  test("N16: 확대를 막지 않는다(viewport에 user-scalable·maximum-scale 없음)", async ({ page }) => {
    await page.goto("/");
    const content = (await page.locator("meta[name=viewport]").getAttribute("content")) ?? "";
    expect(content).toContain("width=device-width");
    expect(content).not.toContain("user-scalable");
    expect(content).not.toContain("maximum-scale");
  });

  test("walk: 모든 화면에서 콘솔 에러 0 · static.toss.im 요청 0", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    await seedPlan(page, SEED_A);
    await seedRecords(page, [makeRecord("2026-08", SEED_A, KEYS), makeRecord("2026-09", SEED_A, ["saving", "emergency"])]);

    for (const path of ["/", "/plan", "/result", "/history", "/does-not-exist"]) {
      await page.goto(path);
      await page.waitForTimeout(800);
      const rootText = (await page.locator("#root").innerText()).trim();
      expect(rootText.length, `${path}: 흰 화면`).toBeGreaterThan(0);
    }
    // 404 → 홈 복귀까지
    await page.getByRole("button", { name: "홈으로 가기" }).click();
    await expect(page.getByTestId("dday-hero")).toBeVisible();
    guard.expectClean();
  });
});

// ── phase 2: 은행 세팅표 · 비상금 목표 · 받은 비율 착지 ──

const GOAL_KEY = "paysplit:goal:v1";
const SEED_B_SHEET = [
  "월급쪼개기 세팅표 · 매달 11일 이체",
  "생활비 통장 862,000원",
  "저축 통장 862,000원",
  "비상금 통장 215,500원",
  "여가 통장 215,500원",
].join("\n");

/** TDS 토스트는 포털의 aria-live 영역에 뜬다(같은 포털에 글자 폭을 재는 화면 밖 복사본이 하나 더 있다). */
function toast(page: Page, text: string) {
  return page.locator('#tds-mobile-portal-container [aria-live="polite"]').getByText(text);
}

async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

test.describe("phase 2", () => {
  test("F1-1·2·3: 결과 화면 세팅표 — 통장 4행, 저축 복사, 전체 복사가 클립보드에 그대로 들어간다", async ({ page, context }) => {
    const guard = consoleGuard(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await atTime(page);
    await seedPlan(page, SEED_B);
    await page.goto("/result");

    const rows = page.locator("[data-testid=setup-sheet] [data-testid=allocation-card]");
    await expect(rows).toHaveCount(4);
    const expected: Array<[string, string]> = [
      ["생활비 통장", "862,000원"],
      ["저축 통장", "862,000원"],
      ["비상금 통장", "215,500원"],
      ["여가 통장", "215,500원"],
    ];
    for (const [i, [label, amount]] of expected.entries()) {
      await expect(rows.nth(i)).toContainText(label);
      await expect(rows.nth(i)).toContainText(amount);
    }

    await page.getByRole("button", { name: "저축 통장 금액 복사" }).click();
    await expect(toast(page, "저축 통장 862,000원을 복사했어요")).toBeVisible();
    expect(await readClipboard(page)).toBe("862000");

    await page.getByRole("button", { name: "세팅표 전체 복사" }).click();
    await expect(toast(page, "세팅표를 복사했어요")).toBeVisible();
    expect(await readClipboard(page)).toBe(SEED_B_SHEET);
    guard.expectClean();
  });

  test("F1-4: 클립보드 권한이 없으면 실패 토스트가 뜨고 콘솔 에러는 0건이다", async ({ page }) => {
    const guard = consoleGuard(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")) },
      });
    });
    await atTime(page);
    await seedPlan(page, SEED_B);
    await page.goto("/result");
    await page.getByRole("button", { name: "저축 통장 금액 복사" }).click();
    await expect(toast(page, "복사하지 못했어요. 금액을 길게 눌러 복사해 주세요")).toBeVisible();
    guard.expectClean();
  });

  test("F1-5: 월급날 31일이면 이체일은 '월급날 다음 날'이고 '32일'은 없다", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    await seedPlan(page, { ...SEED_B, payday: 31 });
    await page.goto("/result");
    const sheet = page.getByTestId("setup-sheet");
    await expect(sheet).toContainText("이체는 월급날 다음 날");
    expect(await page.locator("body").innerText()).not.toContain("32일");
    guard.expectClean();
  });

  test("F1-6: 홈 넛지 — 복사 전 '은행 세팅 전', 전체 복사 뒤 사라지고, 계획을 바꿔 저장하면 '계획이 바뀌었어요'", async ({ page, context }) => {
    const guard = consoleGuard(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await atTime(page);
    await seedPlan(page, SEED_B);
    await page.goto("/");
    await expect(page.getByTestId("setup-nudge")).toContainText("은행 세팅 전이에요");

    await page.getByRole("button", { name: "세팅표 보기" }).click();
    await page.waitForURL(/\/result$/);
    await page.getByRole("button", { name: "세팅표 전체 복사" }).click();
    await expect(toast(page, "세팅표를 복사했어요")).toBeVisible();
    await page.getByRole("button", { name: "홈에서 이체 체크하기" }).click();
    await expect(page.getByTestId("dday-hero")).toBeVisible();
    await expect(page.getByTestId("setup-nudge")).toHaveCount(0);

    await page.getByRole("button", { name: "계획 수정" }).click();
    await page.getByRole("button", { name: "여유 6:2:1:1" }).click();
    await page.getByRole("button", { name: "배분 결과 보기" }).click();
    await page.getByRole("button", { name: "이 계획 저장하기" }).click();
    await page.getByRole("button", { name: "바꾸기" }).click();
    await page.getByRole("button", { name: "홈에서 이체 체크하기" }).click();
    await expect(page.getByTestId("setup-nudge")).toContainText("계획이 바뀌었어요");
    guard.expectClean();
  });

  test("F1-7·8: 세팅표 금액은 한 줄이고 가로 스크롤이 없으며, 끝까지 내리면 마지막 콘텐츠가 저장 버튼에 가리지 않는다", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    await seedPlan(page, SEED_B);
    await page.goto("/result");

    const amounts = page.locator("[data-testid=allocation-card]").getByText(/^\d{1,3}(,\d{3})*원$/);
    await expect(amounts).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const box = (await amounts.nth(i).boundingBox())!;
      expect(box.height, `금액 ${i} 높이`).toBeLessThanOrEqual(26);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const last = (await page.getByTestId("locked-tier").boundingBox())!;
    const save = (await page.getByRole("button", { name: "홈에서 이체 체크하기" }).boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(save.y);
    guard.expectClean();
  });

  test("F2-1·2·3: 비상금 목표 — 6개월치 설정·새로고침 유지·체크 반영·잔액 맞추기", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    await seedPlan(page, SEED_B);
    await page.goto("/");

    const card = page.getByTestId("emergency-goal");
    await expect(card).toContainText("1,557,000원");
    await card.getByRole("button", { name: "6개월치" }).click();
    await expect(card).toContainText("목표 9,342,000원");

    await page.reload();
    await expect(card.getByRole("radio", { name: "6개월" })).toBeChecked();

    await page.getByRole("switch", { name: "비상금 통장 이체 완료" }).click();
    await expect(card).toContainText("0.1개월치 모았어요");
    await expect(card).toContainText("이번 달 +215,500원");
    await expect(card).toContainText("2030년 4월쯤");

    await card.getByRole("button", { name: "잔액 맞추기" }).click();
    await page.getByRole("textbox", { name: "비상금 통장 잔액" }).fill("3000000");
    await expect(page.getByRole("textbox", { name: "비상금 통장 잔액" })).toHaveValue("3,000,000");
    await page.getByRole("button", { name: "잔액 저장" }).click();
    await expect(card).toContainText("1.9개월치 모았어요");
    await expect(card).toContainText("2029년 3월쯤");
    guard.expectClean();
  });

  test("F2-4: 목표 원문이 깨졌으면 크래시 없이 '목표 없음' 상태이고, 새로고침 뒤에도 원문이 남아 있다", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    await seedPlan(page, SEED_B);
    await seedRaw(page, { [GOAL_KEY]: "{bad" });
    await page.goto("/");
    await expect(page.getByTestId("emergency-goal").getByRole("button", { name: "6개월치" })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("dday-hero")).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), GOAL_KEY)).toBe("{bad");
    guard.expectClean();
  });

  test("F3-1: 받은 비율 링크 — 빈 저장소에서 배너와 '저축 집중 4:4:1:1', 월급을 넣으면 결과 저축이 40%", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    await page.goto("/plan?r=40-40-10-10");
    await expect(page.getByTestId("shared-ratio-banner")).toBeVisible();
    await expect(page.getByTestId("shared-ratio-banner")).toContainText("생활비 40 · 저축 40 · 비상금 10 · 여가 10");
    await expect(page.getByRole("button", { name: "저축 집중 4:4:1:1" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("textbox", { name: "월급", exact: true }).fill("3000000");
    await page.getByRole("button", { name: "배분 결과 보기" }).click();
    await page.waitForURL(/\/result$/);
    const saving = page.locator("[data-testid=allocation-card]").filter({ hasText: "저축 통장" });
    await expect(saving).toContainText("나눌 돈의 40%");
    guard.expectClean();
  });

  test("F3-2: 무효한 비율 링크(합 110 · 문자)는 조용히 무시한다 — 배너 없음 · 기본 5:3:1:1", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    for (const path of ["/plan?r=90-20-0-0", "/plan?r=abc"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "기본 5:3:1:1" })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("shared-ratio-banner")).toHaveCount(0);
    }
    guard.expectClean();
  });

  test("F3-3: 계획이 있는 사람이 받은 비율로 들어와도 저장 전까지 기존 계획은 그대로다", async ({ page }) => {
    const guard = consoleGuard(page);
    await atTime(page);
    await seedPlan(page, SEED_B);
    await page.goto("/plan?r=60-20-10-10");
    await expect(page.getByTestId("shared-ratio-banner")).toContainText("저장하기 전까지 기존 계획은 그대로예요");
    await expect(page.getByRole("textbox", { name: "월급", exact: true })).toHaveValue("2,850,000");
    await expect(page.getByRole("button", { name: "여유 6:2:1:1" })).toHaveAttribute("aria-pressed", "true");

    await page.goto("/");
    await expect(page.getByTestId("checklist-card")).toContainText("저축 통장 · 862,000원");
    guard.expectClean();
  });
});
