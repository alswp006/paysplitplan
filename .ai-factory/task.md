# TASK — PaySplitPlan (월급 쪼개기)

## 작업 전제 (모든 Task 공통)

- **테스트 도구**
  - 단위·컴포넌트 테스트는 Vitest + jsdom + @testing-library/react로 작성한다.
  - 템플릿에 이 도구가 없으면 Task 2.1에서 **devDependency로만** 추가한다. 런타임 의존성은 추가하지 않는다.
- **시간 고정**
  - `getToday()`나 `nowIso()`를 쓰는 테스트는 `vi.useFakeTimers(); vi.setSystemTime(...)`으로 시각을 고정한다.
  - 같은 모듈 안에서 부르는 함수는 ESM 모듈 mock으로 가로챌 수 없기 때문이다.
  - 특별한 말이 없으면 기준 시각은 `new Date('2026-09-29T01:00:00.000Z')`이다.
  - 날짜 경계를 따지는 테스트(월 전환, D-day)는 `new Date(2026, 9, 1, 12)`처럼 로컬 생성자로 시각을 만든다.
- **API Routes**: 해당 없음. 서버·외부 API가 없다(SPEC P-1). 그래서 템플릿의 "Epic 2. API Routes" 자리에 데이터 계층을 둔다.
- **컴파일 유지**: Task를 하나 끝낼 때마다 `npx tsc --noEmit`과 `npx vitest run`이 통과해야 한다. 페이지는 Epic 4에서 라우터에 연결하므로, 그 전까지는 `MemoryRouter` 컴포넌트 테스트로 검증한다.
- **사용하지 않는 것**
  - 템플릿이 이미 제공하는 것(`AdSlot`, `TossRewardAd`, `FloatingTabBar`, `PageShell`/`ScreenScaffold`, `SubmitFooter`, `Card`, `SummaryHero`, `Sparkline`, `MiniBar`)은 다시 설계하지 않는다.
  - 로그인·TDS 설정 작업은 만들지 않는다.
  - `useTossAd`, `useTossLogin`, `useTossPayment` 훅은 만들지 않는다.

---

## Epic 1. 타입 정의

> **Risk**
> - **Complexity**: Low
> - **Risk factors**
>   - SPEC은 타입을 `src/lib/plan.ts`에 두는데, 과업 규칙은 `src/lib/types.ts`를 요구한다. 두 곳에 정의하면 서로 어긋날 수 있다.
>   - `/result` state의 모양이 보내는 쪽과 받는 쪽에서 다르면 결과 화면이 크래시한다.
> - **Mitigation**
>   - 타입은 `types.ts` 한 곳에만 정의한다. `plan.ts`는 Task 2.3에서 `export type {…} from './types'`로 다시 내보내기만 한다.
>   - `RouteState`를 가장 먼저 확정해서, 이후 모든 페이지가 같은 계약을 import하게 한다.

### Task 1.1 엔티티 타입 + RouteState (`src/lib/types.ts`)

- **Description**
  - SPEC Data Models의 타입을 모두 옮겨 적는다. 런타임 코드는 넣지 않는다.
    - `CategoryKey`, `Ratios`, `PresetId`, `Preset`
    - `FixedCost`, `SalaryPlan`, `PlanDraft`
    - `Allocation`
    - `MonthRecord`, `RecordsStore`
    - `ReviewPromptState`
    - `BracketScenario`, `TrendPoint`, `TrendSummary`
    - `ParsedAmount`, `SaveError`
  - 결과 타입도 정의한다.
    ```ts
    export type SavePlanResult = { ok: true; plan: SalaryPlan } | { ok: false; error: SaveError };
    export type ToggleResult  = { ok: true; record: MonthRecord } | { ok: false; error: 'QUOTA' | 'NO_PLAN' };
    export interface NextPayday { date: Date; dday: number; label: string }
    ```
  - 라우트 계약을 정의한다.
    ```ts
    export type ResultRouteState = { draft: PlanDraft };
    export type RouteState = {
      '/': undefined;            // state 사용 안 함
      '/plan': undefined;        // state 사용 안 함
      '/result': ResultRouteState | null | undefined; // /plan → /result 만 전달
      '/history': undefined;     // state 사용 안 함
    };
    ```
  - 받는 쪽 필수 패턴을 JSDoc 주석으로 파일에 적어 둔다. 캐스팅한 뒤에도 반드시 null과 형태를 검증해야 한다.
    ```ts
    const raw = (useLocation().state as RouteState['/result']) ?? null;
    const incoming = raw !== null && typeof raw === 'object' && isValidDraft(raw.draft) ? raw.draft : null;
    ```
- **DoD**
  - `npx tsc --noEmit`이 통과한다.
  - `grep -E "^export (const|function|let|class)" src/lib/types.ts`의 결과가 0건이다. 순수 타입만 있어야 한다.
  - `RouteState['/result']`에 `{ draft: PlanDraft }`, `null`, `undefined`를 넣으면 컴파일된다. `{ plan: ... }`를 넣으면 컴파일 에러가 난다(`// @ts-expect-error`로 확인하는 타입 테스트 1개).
  - `PlanDraft`에는 `version`, `id`, `createdAt`, `updatedAt` 키가 없다. `keyof PlanDraft` 타입 테스트로 확인한다.
- **Covers**: 없음. 기반 작업이며 F2-AC-2와 F4-AC-6이 쓰는 RouteState 계약을 제공한다.
- **Files**: `src/lib/types.ts`, `src/lib/__tests__/types.test-d.ts`
- **Depends on**: 없음

---

## Epic 2. 데이터 계층 (유틸 → 도메인 로직 → 저장소 → 상태 → 화면용 셀렉터)

> **Risk**
> - **Complexity**: High. 이 앱에서 가장 복잡한 Epic이다.
> - **Risk factors**
>   1. `setItem` 예외가 나면 기존 값이 일부만 덮어써질 수 있다(507 규칙 위반).
>   2. 레거시 정규화를 하다가 읽기만 해도 저장값을 다시 쓰는 부작용이 생길 수 있다(F1 AC-15·16·17, F6 AC-10, F7 AC-8 위반).
>   3. 멱등 토글에서 `updatedAt`이 바뀔 수 있다(F1 AC-11).
>   4. 금액을 내림한 잔액이 생활비로 가는 규칙과 "금액 > 0일 때만 표시" 규칙이 화면마다 다르게 구현될 수 있다.
>   5. `/plan` 폼의 에러 우선순위와 disabled 조건이 복잡해 페이지 Task에서 시간을 넘길 수 있다.
>   6. 404 화면이 앱 루트에서 `loadPlan()`을 실행하면 손상된 키가 지워져 F8 AC-1 규칙을 어긴다.
> - **Mitigation**
>   - 쓰기는 "새 JSON 문자열을 모두 만든 뒤 `setItem` 1회"로 한다. 읽기 함수는 `setItem`을 호출하지 않는다는 테스트를 넣는다(1, 2).
>   - 멱등 비교를 전용 테스트로 고정한다(3).
>   - 표시 규칙은 `getEligibleKeys` 함수 하나로 모으고 모든 화면이 그 함수를 쓴다(4).
>   - 폼 검증과 비율 로직을 순수 함수 모듈로 먼저 만들고 단위 테스트로 고정한다(5).
>   - 상태 훅은 전역 Provider 없이 **페이지가 마운트될 때만** 읽는다(6).

### Task 2.1 공용 유틸 — 날짜·ID·금액 포맷

- **Description**
  - `date.ts`
    - `getToday()`, `nowIso()`, `isIsoTimestamp(x)`를 만든다.
    - 보조 함수 `toMonthKey(d: Date): string`을 만든다. 로컬 기준 `'YYYY-MM'`을 반환한다.
    - 보조 함수 `laterIso(a: string, b: string): string`을 만든다. `Date.parse`가 더 큰 쪽을 반환하며, `updatedAt = max(nowIso(), createdAt)` 불변식을 구현하는 데 쓴다.
  - `id.ts`: `createId()`를 만든다. `crypto.randomUUID`는 쓰지 않는다.
  - `format.ts`
    - `formatManwon(n)`과 `parseAmountInput(raw)`를 SPEC P-2a 규칙 1~6 그대로 구현한다.
    - 보조 함수 `formatWon(n)`은 `n.toLocaleString('ko-KR') + '원'`을 반환한다.
    - 보조 함수 `formatDigits(n)`은 콤마만 붙인다.
- **DoD** (`src/lib/__tests__/utils.test.ts`)
  - `parseAmountInput`의 결과가 다음과 같다.

    | 입력 | 결과 |
    |---|---|
    | `''` | `empty` |
    | `'007'` | `ok 7` |
    | `' 3000000 '` | `ok 3000000` |
    | `'3,000,000'` | `ok 3000000` |
    | `'-500000'` | `negative` |
    | `'-1.5'` | `negative` |
    | `'3000000.5'` | `decimal` |
    | `'abc'`, `'-'`, `'3e6'`, `'3,000원'` | 모두 `invalid` |

    예외를 던지는 입력은 0건이다.
  - `formatManwon`의 결과가 다음과 같다.

    | 입력 | 결과 |
    |---|---|
    | `3000000` | `"300만 원"` |
    | `3450000` | `"345만 원"` |
    | `5000` | `"5,000원"` |
    | `0` | `''` |
    | `-1` | `''` |

  - `isIsoTimestamp`
    - `"2026-09-01T00:00:00.000Z"`이면 `true`다.
    - `"not-a-date"`, `"yesterday"`, `""`, `null`, `123`이면 `false`다.
  - 시각을 2026-09-29T01:00Z로 고정했을 때 `nowIso()`는 `"2026-09-29T01:00:00.000Z"`다.
  - `toMonthKey(new Date(2026, 8, 29))`는 `"2026-09"`다.
  - `laterIso("2026-09-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z")`는 앞의 값을 반환한다.
  - `createId()`를 1,000회 호출하면 빈 문자열이 0건이고 중복이 0건이다.
- **Covers**: AC-C6(부분: randomUUID 미사용), F2-AC-10(해석 규칙 부분), F2-AC-1(보조 문구 포맷 부분)
- **Files**: `src/lib/date.ts`, `src/lib/id.ts`, `src/lib/format.ts`, `src/lib/__tests__/utils.test.ts`
- **Depends on**: Task 1.1

### Task 2.2 계측·공유·리뷰 유틸

- **Description**
  - `analytics.ts`
    - `logClick(name)`과 `logImpression(name)`을 만든다. 템플릿의 Toss 내부 로깅 헬퍼에 위임하고, 헬퍼가 없거나 예외가 나면 try/catch로 no-op 처리한다.
    - `useImpressionOnce(name)` 훅을 만든다. `useRef` 플래그로 한 번 마운트된 화면 안에서 1회만 기록한다(StrictMode에서도 1회).
  - `share.ts`: `shareApp()`을 만든다.
    - 설치된 `@apps-in-toss/web-framework` 버전이 공유 API를 export하는지 확인해서 쓴다.
    - 없으면 `navigator.share`, 그것도 없으면 no-op다.
    - 항상 resolve한다.
  - `review.ts`: `requestReviewOnce()`를 만든다.
    - `paysplit:review:v1` 키가 **없을 때만** SDK의 리뷰 요청을 1회 호출한다. SDK에 export가 없으면 no-op다.
    - 호출 후 `ReviewPromptState { version:1, id:'review-prompt', createdAt: nowIso(), updatedAt: 같은 값 }`을 저장한다.
    - 키가 있으면 값과 상관없이 no-op다. `setItem` 예외는 삼킨다.
- **DoD** (`src/lib/__tests__/review.test.ts`, `analytics.test.ts`)
  - 키가 없는 상태에서 `requestReviewOnce()`를 2회 호출하면 리뷰 API mock이 1회 호출된다.
  - 이때 저장값을 `JSON.parse`한 결과가 `{version:1,id:'review-prompt',createdAt:"2026-09-29T01:00:00.000Z",updatedAt:"2026-09-29T01:00:00.000Z"}`와 같다.
  - 키 값이 `'1'`이면 리뷰 API가 0회 호출되고 저장값은 `'1'` 그대로다.
  - `setItem`이 예외를 던지게 mock해도 `requestReviewOnce()`는 예외를 던지지 않는다.
  - 로깅 헬퍼가 예외를 던지게 mock해도 `logClick('x')`는 예외를 던지지 않는다.
  - `useImpressionOnce('a')`를 쓰는 컴포넌트를 3회 리렌더해도 `logImpression`은 1회 호출된다.
  - `shareApp()`은 공유 API와 `navigator.share`가 모두 없어도 resolve한다.
  - `grep -rE "react-ga|@amplitude|firebase/analytics|googletagmanager|mixpanel" src package.json`의 결과가 0건이다.
- **Covers**: F1-AC-19, AC-C5, F4-AC-8(함수 부분)
- **Files**: `src/lib/analytics.ts`, `src/lib/share.ts`, `src/lib/review.ts`, `src/lib/__tests__/review.test.ts`, `src/lib/__tests__/analytics.test.ts`
- **Depends on**: Task 2.1

### Task 2.3 도메인 상수 + 배분 계산 (`plan.ts` 1부)

- **Description**
  - `types.ts`의 타입을 `export type {…}`로 다시 내보낸다.
  - 상수를 정의한다.
    - `CATEGORY_LABEL`, `CATEGORY_ORDER`, `PRESETS`
    - `DEFAULT_RATIOS = {50,30,10,10}`, `DEFAULT_PAYDAY = 25`, `DEFAULT_PRESET_ID = 'p532'`
  - `calculateAllocation(p)`를 만든다.
    - `saving`, `emergency`, `leisure`는 각각 `floor(available * ratio / 100)`로 구한다.
    - `living`은 `available`에서 나머지 셋의 합을 뺀 값이다.
  - `getRatioRowAmount(available, ratio)`를 만든다. `available ≤ 0`이면 `null`, 아니면 `floor(available * ratio / 100)`을 반환한다.
  - `getEligibleKeys(amounts): CategoryKey[]`를 만든다. `amounts[key] > 0`인 키를 `CATEGORY_ORDER` 순서로 반환한다. 이 함수가 표시·집계 규칙의 **유일한 구현**이다.
  - `resolvePresetId(ratios): PresetId`를 만든다. 4개 값이 모두 같은 프리셋이 있으면 그 id를, 없으면 `'custom'`을 반환한다.
- **DoD** (`src/lib/__tests__/allocation.test.ts`)
  - 예시 A를 넣으면 `{fixedTotal:600000, available:2400000, amounts:{living:1200000, saving:720000, emergency:240000, leisure:240000}}`가 나온다.
  - salary 1234567, 고정비 없음, 50:30:10:10을 넣으면 amounts가 `{617285, 370370, 123456, 123456}`이고 합계가 1234567이다.
  - salary 1234567, 비율 0:50:30:20을 넣으면 amounts가 `{living:1, saving:617283, emergency:370370, leisure:246913}`이다. `getEligibleKeys`는 4개를 반환한다.
  - available 5, 50:30:10:10이면 amounts가 `{4,1,0,0}`이고 `getEligibleKeys`는 `['living','saving']`이다.
  - 예시 A 월급·고정비에 60:30:10:0을 넣으면 `getEligibleKeys`는 `['living','saving','emergency']`다.
  - `getRatioRowAmount`
    - `(2400000, 35)`는 `840000`이다.
    - `(2400000, 100)`은 `2400000`이다.
    - `(0, 50)`과 `(-100000, 50)`은 `null`이다.
    - available 2400000으로 55:35:10:10(합 110)을 넣으면 네 행이 `1320000 / 840000 / 240000 / 240000`이다.
  - `resolvePresetId({50,30,10,10})`은 `'p532'`, `({35,35,10,20})`은 `'custom'`이다.
- **Covers**: F1-AC-1, F1-AC-2, F3-AC-7(판정 로직), F3-AC-8(행 금액 로직), F6-AC-9(계산 부분)
- **Files**: `src/lib/plan.ts`, `src/lib/__tests__/allocation.test.ts`
- **Depends on**: Task 1.1

### Task 2.4 검증·비교·레거시 정규화 (`plan.ts` 2부)

- **Description**: SPEC의 규칙 그대로 네 함수를 `plan.ts`에 추가한다. 모두 예외를 던지지 않는다.
  - `isValidDraft`: FixedCost `id`가 배열 안에서 유일한지, 타임스탬프가 `isIsoTimestamp`를 통과하는지, `Σ amount < salary`인지까지 검사한다.
  - `isValidPlan`
  - `isSamePlan`: `presetId`와 고정비의 `id`·타임스탬프는 비교하지 않는다.
  - `normalizeLegacyPlan`: `=== undefined`인 필드만 채운다. `Object.hasOwn`은 쓰지 않는다.
- **DoD** (`src/lib/__tests__/validate.test.ts`)
  - 예시 A 계획(`id:"plan_a"`, 타임스탬프 `"2026-09-01T00:00:00.000Z"`)이면 `isValidPlan`은 `true`다.
  - F1-AC-12의 (a)~(h) 여덟 경우는 모두 `isValidPlan(normalizeLegacyPlan(x))`가 `false`다.
    - (g) `id:123`은 채우지 않고 그대로 두므로 `false`다.
    - (h) `fixedCosts[0].updatedAt: null`도 채우지 않으므로 `false`다.
  - F4-AC-6의 (a)~(f)는 모두 `isValidDraft`가 `false`다. (d)에서 `null`을 넣어도 `false`이고 예외가 없다.
  - F1-AC-15처럼 `id`, `createdAt`, 고정비 타임스탬프가 없는 입력을 `normalizeLegacyPlan`에 넣으면 다음과 같다.
    - `id`는 `'legacy-' + Date.parse("2026-09-01T00:00:00.000Z").toString(36)`이다. 두 번 호출해도 같다.
    - `createdAt`과 고정비의 두 타임스탬프는 `"2026-09-01T00:00:00.000Z"`다.
    - 입력 객체를 변형하지 않는다(얕은 복사본을 반환).
  - `isSamePlan`
    - 예시 A와, 거기서 `presetId:'custom'`과 고정비 id만 바꾼 초안을 비교하면 `true`다.
    - `salary`만 3500000으로 바꾼 초안과 비교하면 `false`다.
    - 고정비 `name`에 앞뒤 공백만 추가한 경우는 `true`다.
  - `grep "Object.hasOwn" src/lib/plan.ts`의 결과가 0건이다.
- **Covers**: F1-AC-12(검증), F1-AC-15(정규화), F4-AC-6(검증 함수), F4-AC-10(isSamePlan)
- **Files**: `src/lib/plan.ts`, `src/lib/__tests__/validate.test.ts`
- **Depends on**: Task 2.1, Task 2.3

### Task 2.5 localStorage 저장소 — 계획 (`loadPlan`, `savePlan`)

- **Description**
  - `storage.ts`에 키 상수 `PLAN_KEY='paysplit:plan:v1'`, `RECORDS_KEY='paysplit:records:v1'`, `REVIEW_KEY='paysplit:review:v1'`을 둔다.
  - 저수준 함수 `safeGet(key)`와 `safeSet(key, value): boolean`을 만든다. 템플릿 localStorage 헬퍼가 `setItem` 예외를 삼켜서 성공 여부를 알려주지 않으면 `window.localStorage`를 직접 try/catch로 감싼다.
  - `loadPlan()`
    - `JSON.parse` → `normalizeLegacyPlan` → `isValidPlan` 순서로 처리한다.
    - 하나라도 실패하면 키를 `removeItem`하고 `null`을 반환한다.
    - 레거시 정규화는 메모리에서만 하고 `setItem`하지 않는다.
  - `savePlan(draft)`: SPEC 1~6단계 그대로 구현한다.
    - `id`와 `createdAt`은 기존 값을 유지하고, `updatedAt = laterIso(nowIso(), createdAt)`이다.
    - 고정비는 draft 값을 그대로 저장한다.
    - `setItem`이 실패하면 `{ok:false, error:'QUOTA'}`를 반환한다.
- **DoD** (`src/lib/__tests__/storage.plan.test.ts`)
  - F1-AC-3
    - 키가 없을 때 저장하면 `version:1`, 빈 문자열이 아닌 `id`, `createdAt === updatedAt === "2026-09-29T01:00:00.000Z"`가 저장된다.
    - `fixedCosts[0]`은 `{id:"fc_rent", createdAt:"2026-09-28T00:00:00.000Z"}` 그대로다.
    - `loadPlan()`은 저장한 필드와 같은 값을 반환한다.
  - F1-AC-5: 저장값이 `'{broken'`이면 `null`을 반환하고, 키가 삭제되고, `console.error` 스파이가 0회다.
  - F1-AC-6: `setItem`이 `QuotaExceededError`를 던지게 mock하면 `{ok:false,error:'QUOTA'}`를 반환하고, 기존 문자열은 호출 전과 `===`로 같다.
  - F1-AC-7(계획 쪽): 키가 없으면 `loadPlan()`은 `null`이다.
  - F1-AC-12: (a)~(h) 저장값마다 `null`을 반환하고 키가 삭제된다.
  - F1-AC-13: 시각을 `02:00Z`로 고정하고 salary 3500000으로 다시 저장하면 다음이 유지·갱신된다.
    - `id:"plan_a"`, `createdAt:"2026-09-01T00:00:00.000Z"`는 유지된다.
    - `updatedAt`은 `"2026-09-29T02:00:00.000Z"`다.
    - 고정비 2건의 id와 타임스탬프는 변하지 않는다.
  - 시계 역행: 기존 `createdAt`이 `"2026-10-01…"`이고 현재 시각이 9/29이면 `updatedAt === createdAt`이다.
  - F1-AC-15
    - 레거시 저장값에 `loadPlan()`을 2회 호출하면 같은 id를 반환하고, `setItem` 스파이는 0회, 저장 문자열은 그대로다.
    - 이어서 `savePlan`을 호출하면 저장 JSON에 그 id와 createdAt이 들어간다.
  - F1-AC-18(앞부분): 계획이 `'{broken'`이고 기록이 있을 때 `loadPlan()`을 호출하면 계획 키만 삭제되고 `paysplit:records:v1` 문자열은 그대로다.
- **Covers**: F1-AC-3, F1-AC-5, F1-AC-6, F1-AC-7, F1-AC-12, F1-AC-13, F1-AC-15, F1-AC-18(앞부분)
- **Files**: `src/lib/storage.ts`, `src/lib/__tests__/storage.plan.test.ts`
- **Depends on**: Task 2.4

### Task 2.6 localStorage 저장소 — 기록 읽기 (`loadRecords`)

- **Description**
  - `loadRecords()`를 만든다.
    - 스토어 전체를 검증한다. 파싱 실패, `null`, 객체 아님, `version !== 1`, `records`가 객체 아님 중 하나라도 해당하면 `{version:1, records:{}}`로 취급한다.
    - 레코드마다 레거시 정규화를 한다. `undefined`인 필드만 채운다: `id`는 `'legacy-'+month`, `planId`는 `null`, `createdAt`은 `updatedAt`(ISO일 때만).
    - 정규화한 뒤 레코드별 검증을 통과하지 못한 레코드는 결과에서만 뺀다. 키와 `month`가 같아야 한다.
    - `setItem`과 `removeItem`은 절대 호출하지 않는다.
  - 공용 헬퍼 `sortedMonthKeys(store, dir: 'asc'|'desc')`를 둔다.
- **DoD** (`src/lib/__tests__/storage.records-read.test.ts`)
  - F1-AC-7: 키가 없으면 `{version:1, records:{}}`를 반환한다.
  - `'null'`, `'{broken'`, `'{"version":2,"records":{}}'`, `'{"version":1,"records":[]}'`는 모두 빈 스토어를 반환한다. `console.error`는 0회다.
  - F1-AC-16(앞): 레거시 `2026-08` 레코드가 포함되고, `id:"legacy-2026-08"`, `planId:null`, `createdAt:"2026-08-31T12:00:00.000Z"`로 채워진다. 저장 문자열은 그대로다.
  - F1-AC-17: 6·7·8·9월 중 결과 키는 `['2026-09']` 하나다.
  - F7-AC-8: `"rate":"50"`인 8월만 빠진다.
  - F7-AC-9: `planId:"plan_deleted"`인 레코드와 레거시 레코드가 모두 포함된다.
  - 키 `'2026-09'` 아래 `month:'2026-08'`인 레코드는 빠진다.
  - 모든 테스트에서 `setItem`과 `removeItem` 스파이가 0회다.
- **Covers**: F1-AC-7, F1-AC-16(읽기 부분), F1-AC-17, F5-AC-7(데이터), F7-AC-5(데이터), F7-AC-8(데이터), F7-AC-9(데이터)
- **Files**: `src/lib/storage.ts`, `src/lib/__tests__/storage.records-read.test.ts`
- **Depends on**: Task 2.5

### Task 2.7 localStorage 저장소 — 기록 토글 (`toggleRecordItem`)

- **Description**: SPEC 1~7단계 그대로 구현한다.
  - 계획이 없으면 `NO_PLAN`을 반환한다.
  - 이번 달 키는 `toMonthKey(getToday())`로 구한다.
  - `eligible`은 `getEligibleKeys`로 구하고, `rate`는 반올림한다.
  - `completedAt`은 세 가지 전이 규칙을 따른다.
  - `snapshot`과 `planId`는 현재 계획 값으로 넣는다.
  - **멱등**: 6개 필드가 모두 같으면 `setItem`을 호출하지 않고 기존 레코드를 반환한다.
  - 새 레코드를 만들 때는 `id`와 `createdAt`을 유지하고 `updatedAt`을 `laterIso`로 구한다.
  - 25번째 월이 생기면 가장 오래된 키를 삭제한다.
  - 저장은 `JSON.stringify` 1회 후 `safeSet` 1회로 한다. 이때 다른 레코드도 정규화된 형태로 함께 저장된다.
- **DoD** (`src/lib/__tests__/storage.toggle.test.ts`)
  - F1-AC-4: 결과가 `checked.saving=true`, eligible 4개, `rate:25`, `completedAt:null`, `planId:"plan_a"`, `month:"2026-09"`이고, `createdAt`과 `updatedAt`은 모두 `"2026-09-29T01:00:00.000Z"`다.
  - F1-AC-14: 이어서 시각을 `03:00Z`로 두고 living을 켜면 `id`와 `createdAt`은 같고, `updatedAt`은 `"…T03:00:00.000Z"`, `rate`는 50이다.
  - 완료 전이: 4개를 모두 켜면 `rate` 100에 `completedAt`이 ISO 값이다. 하나를 끄면 `rate` 75에 `completedAt`은 `null`이다.
  - F1-AC-8: 24개월 기록이 있을 때 2026-10-05에 토글하면 키가 24개이고, `'2024-10'`은 없고 `'2026-10'`이 있다. 남은 23개의 `id`와 `createdAt`은 그대로다.
  - F1-AC-9: `setItem`이 예외를 던지면 `{ok:false,error:'QUOTA'}`를 반환하고 저장 문자열은 그대로다.
  - F1-AC-10: 계획이 없으면 `NO_PLAN`을 반환하고, `paysplit:records:v1` 키는 생기지 않는다.
  - F1-AC-11: 완료된 `rec_0901` 상태에서 `('saving', true)`를 호출하면 `{ok:true}`를 반환하고, `setItem` 스파이는 0회, 문자열·`updatedAt`·키 개수는 모두 그대로다.
  - F1-AC-16(뒤): 레거시 8월이 있는 상태에서 9월을 토글하면, 저장된 8월에 `id`, `planId:null`, `createdAt`이 채워진다.
  - F1-AC-18(뒤): 계획이 삭제된 뒤 새로 저장하고 living을 토글하면, `records['2026-09'].planId`가 새 id가 된다(`"plan_old"` 아님). `id` `"rec_0901"`과 `createdAt`은 그대로다.
  - F6-AC-10(데이터): 계획을 60:30:10:0으로 다시 저장하고 emergency를 켜면 `eligible`은 `['living','saving','emergency']`, `rate`는 100이다.
- **Covers**: F1-AC-4, F1-AC-8, F1-AC-9, F1-AC-10, F1-AC-11, F1-AC-14, F1-AC-16, F1-AC-18
- **Files**: `src/lib/storage.ts`, `src/lib/__tests__/storage.toggle.test.ts`
- **Depends on**: Task 2.6

### Task 2.8 파생 인사이트 — 소득 구간 비교·6개월 추이 (`insights.ts`)

- **Description**
  - `getBracketScenarios(p)`를 만든다.
    - 후보 월급은 현재 월급의 −100만, −50만, 0, +50만, +100만이다.
    - 후보가 `fixedTotal` 이하이거나 1억을 넘으면 제외한다.
    - 결과는 월급 오름차순이다.
    - `saving`은 `calculateAllocation(...).amounts.saving`, `savingYear`는 `saving * 12`다.
  - `getTrend(today, store)`를 만든다.
    - `points`는 이번 달을 포함한 최근 6개월을 오래된 순으로 담는다. 기록 없는 달의 rate는 `null`이다.
    - `average`는 null이 아닌 달의 평균을 반올림한다.
    - `streak`은 이번 달이 100이면 이번 달부터, 아니면 지난달부터 거꾸로 센다.
  - `hasEnoughTrend(summary)`를 만든다. null이 아닌 point가 2개 이상이면 `true`다.
- **DoD** (`src/lib/__tests__/insights.test.ts`)
  - F5-AC-2: 예시 A의 결과가 다음과 같다.

    | 월급 | 저축 | isCurrent |
    |---|---|---|
    | 2,000,000 | 420,000 | |
    | 2,500,000 | 570,000 | |
    | 3,000,000 | 720,000 | true |
    | 3,500,000 | 870,000 | |
    | 4,000,000 | 1,020,000 | |

    월급 3,000,000 행의 `savingYear`는 8,640,000이다.
  - F5-AC-3: 월급 1,000,000, 고정비 600,000이면 결과 월급이 `[1000000, 1500000, 2000000]`이다.
  - F5-AC-4: 기준일 2026-09-29, 기록 `07:100, 08:50, 09:75`이면 다음과 같다.
    - `points`의 월이 `2026-04`부터 `2026-09`까지 6개다.
    - 4·5·6월 rate는 `null`이다.
    - `average`는 75, `streak`은 0이다.
  - F5-AC-5: 기록 `07:100, 08:100, 09:40`이면 `streak`은 2다.
  - 기록 `08:100, 09:100`이면 `streak`은 2다(이번 달부터 셈).
  - F5-AC-6: 기록이 1개월뿐이면 `hasEnoughTrend`는 `false`, 빈 스토어이면 `average`는 `null`이다.
- **Covers**: F5-AC-2, F5-AC-3, F5-AC-4, F5-AC-5, F5-AC-6(판정)
- **Files**: `src/lib/insights.ts`, `src/lib/__tests__/insights.test.ts`
- **Depends on**: Task 2.3, Task 2.6

### Task 2.9 D-day 유틸 (`dday.ts`)

- **Description**
  - `getNextPayday(today, payday)`를 만든다.
    - 이번 달 월급일을 구한다. payday가 그 달 말일보다 크면 말일로 보정한다.
    - 그 날이 오늘 이상이면 이번 달, 아니면 다음 달이다. 다음 달에도 같은 보정을 한다.
    - `dday`는 날짜 단위 차이다. 시각을 무시하고 `Date.UTC(y,m,d)` 차이 ÷ 86,400,000으로 구한다.
    - `label`은 `dday`가 0이면 `'D-DAY'`, 아니면 `'D-{n}'`이다.
  - `formatPaydayText(date)`를 만든다. `"{M}월 {D}일 월급날"`을 반환한다.
- **DoD** (`src/lib/__tests__/dday.test.ts`)
  - SPEC 표의 5행과 일치한다. 날짜는 모두 로컬 생성자로 만든다.

    | 오늘 | payday | 결과 |
    |---|---|---|
    | 2026-09-29 | 25 | 2026-10-25, D-26 |
    | 2026-09-29 | 30 | D-1 |
    | 2026-09-29 | 31 | 2026-09-30, D-1 |
    | 2026-09-25 | 25 | D-DAY |
    | 2027-02-01 | 31 | 2027-02-28, D-27 |

  - 오늘이 2026-09-29 23:59이고 payday가 30일 때도 D-1이다(시각 무시).
  - `formatPaydayText(new Date(2026,9,25))`는 `"10월 25일 월급날"`이다.
- **Covers**: F6-AC-1(계산)
- **Files**: `src/lib/dday.ts`, `src/lib/__tests__/dday.test.ts`
- **Depends on**: Task 2.1

### Task 2.10 상태 관리 — 페이지 마운트 시 읽는 가벼운 훅

- **Description**
  - 전역 Provider와 앱 부트 시점의 읽기는 두지 않는다. 404 화면에서 저장소에 접근하지 않기 위해서다(F8-AC-1).
  - `usePlanState()`를 만든다.
    - `const [plan, setPlan] = useState(() => loadPlan())`로 마운트할 때 한 번 읽는다.
    - `save(draft)`는 `savePlan`을 호출하고, `ok`이면 `setPlan(result.plan)` 후 결과를 반환한다.
  - `useRecordsState()`를 만든다.
    - `const [store, setStore] = useState(() => loadRecords())`로 마운트할 때 한 번 읽는다.
    - `toggle(key, value)`는 `toggleRecordItem`을 호출한다. `ok`이면 `setStore(loadRecords())`로 갱신하고, 실패하면 상태를 바꾸지 않는다.
    - 실패 시 상태가 그대로이므로 Switch가 원래 값으로 되돌아간다.
  - 페이지는 이 훅으로만 저장소를 읽고 쓴다.
- **DoD** (`src/state/__tests__/hooks.test.tsx`, renderHook 사용)
  - 훅 모듈을 import만 했을 때 `getItem` 스파이가 0회다(lazy).
  - 예시 A가 저장된 상태에서 `usePlanState().plan.id`는 `"plan_a"`다. 저장값이 `'{broken'`이면 `plan`은 `null`이고 키가 삭제된다.
  - `save(draft)`가 성공하면 리렌더 후 `plan.salary`가 새 값이다. QUOTA로 실패하면 `plan`은 이전 객체 그대로다.
  - `toggle('saving', true)`가 성공하면 `store.records['2026-09'].checked.saving`은 `true`다.
  - `setItem`이 예외를 던지면 `toggle`은 `{ok:false,error:'QUOTA'}`를 반환하고 `store`는 이전 참조와 `===`로 같다.
- **Covers**: F6-AC-6(상태 유지), F6-AC-11(로드 시 손상 처리), F8-AC-1(저장소 미접근 전제)
- **Files**: `src/state/usePlanState.ts`, `src/state/useRecordsState.ts`, `src/state/__tests__/hooks.test.tsx`
- **Depends on**: Task 2.7

### Task 2.11 계획 폼 로직 — 월급·월급날·고정비 (`planForm.ts`)

- **Description**: `/plan` 화면에서 쓸 순수 함수 모듈을 만든다.
  - 상태 타입
    ```ts
    interface PlanFormState {
      salaryRaw: string;
      paydayRaw: string;
      fixedCosts: FixedCost[];
      ratios: Ratios;
      presetId: PresetId;
      submitAttempted: boolean;
    }
    ```
  - `initPlanForm(plan: SalaryPlan | null)`
    - 계획이 없으면 `salaryRaw ''`, `paydayRaw '25'`, 고정비 `[]`, `DEFAULT_RATIOS`, `'p532'`로 시작한다.
    - 계획이 있으면 `salaryRaw`는 `String(salary)`, 고정비는 id·타임스탬프를 포함해 그대로 가져오고, `presetId`는 `resolvePresetId(ratios)`로 정한다.
  - `displayAmount(raw)`: 해석 결과가 `ok`면 콤마 포맷을, 아니면 원문을 반환한다. 월급날은 원문 그대로 보여준다.
  - `getSalaryError(state): string | null`: SPEC S2 우선순위 1~5를 따르고 에러 문구는 하나만 반환한다.
    - `"월급을 입력해주세요"`: empty 또는 0이면서 `submitAttempted`일 때만
    - `"0보다 큰 금액을 입력해주세요"`
    - `"원 단위로 입력해주세요"`
    - `"숫자만 입력해주세요"`
    - `"1억 원 이하로 입력해주세요"`
  - `getFixedTotalError(state)`: 월급이 `ok`이고 0보다 클 때만 판단한다. `Σ ≥ salary`이면 `"고정비가 월급보다 많아요. 금액을 확인해주세요"`를 반환한다.
  - `getPaydayError(state)`: 해석 결과가 `ok`이고 1~31이 아니면 `"1~31 사이 날짜를 입력해주세요"`를 반환한다. 빈 값에도 즉시 표시한다.
  - `getAvailablePreview(state)`: 월급이 정상이고 `available > 0`이면 숫자, 아니면 `null`을 반환한다.
  - `formatAvailablePreview(n | null)`: `"남는 돈 2,400,000원"` 또는 `"남는 돈 -원"`을 반환한다.
  - `isSubmitDisabled(state)`: 다음 중 하나라도 해당하면 `true`다.
    - 비율 합계가 100이 아님
    - 월급 에러가 negative, decimal, invalid, 1억 초과 중 하나
    - 고정비 합계 에러
    - 월급날 에러

    월급이 비어 있거나 0이면 **enabled**다. 탭하면 AC-3 에러가 표시된다.
  - `toDraft(state): PlanDraft | null`: 결과는 `isValidDraft`를 통과한다. `presetId`는 `resolvePresetId`로 정하고, `id`, `version`, `createdAt`, `updatedAt` 키는 넣지 않는다.
  - `validateFixedCostEntry(nameRaw, amountRaw)`: 이름·금액 에러 문구, 또는 `{name: trim, amount}`를 반환한다.
    - 이름: 비어 있으면(공백만 포함) `"항목 이름을 입력해주세요"`, 21자 이상이면 `"항목 이름은 20자 이내로 입력해주세요"`
    - 금액: 빈 값이나 0이면 `"금액을 입력해주세요"`, negative·decimal·invalid·1억 초과는 월급과 같은 문구
  - `createFixedCost(name, amount)`: `{id: createId(), name, amount, createdAt: nowIso(), updatedAt: 같은 값}`을 만든다.
  - `canAddFixedCost(list)`: 길이가 10 미만이면 `true`다. `MAX_FIXED_COST_TOAST = "고정비는 최대 10개까지 추가할 수 있어요"`도 정의한다.
- **DoD** (`src/lib/__tests__/planForm.test.ts`)
  - 초기값
    - `initPlanForm(null)`이면 `salaryRaw ''`, `paydayRaw '25'`, `presetId 'p532'`다.
    - 예시 A로 초기화하면 `displayAmount`가 `'3,000,000'`이고, 고정비 id는 `["fc_rent","fc_phone"]`, 타임스탬프는 원본 그대로다.
  - 월급 에러
    - `abc`와 `3,000원`은 `"숫자만 입력해주세요"`, `-500000`은 `"0보다 큰 금액을 입력해주세요"`, `3000000.5`는 `"원 단위로 입력해주세요"`다.
    - 네 경우 모두 `isSubmitDisabled`는 `true`이고 preview는 `null`이다. `displayAmount`는 원문 그대로다.
    - `100000001`은 `"1억 원 이하로 입력해주세요"`이고 disabled다.
    - `''` 또는 `'0'`이면 `submitAttempted=false`일 때 에러가 `null`이고 disabled는 `false`다. `true`이면 `"월급을 입력해주세요"`다.
  - 고정비 합계
    - 월급 1000000, 고정비 1000000이면 고정비 합계 에러가 나고 disabled다.
    - 월급 400000, 고정비 500000이면 preview는 `null`이고 같은 에러가 난다.
  - 월급날
    - `'32'`, `'0'`, `''`, `'2.5'`, `'-'`, `'abc'`는 모두 `"1~31 사이 날짜를 입력해주세요"`이고 disabled다.
    - `'10'`이면 에러가 `null`이고 `toDraft().payday`는 10이다.
  - 제출 초안: 예시 A 입력이면 `toDraft`의 `salary`는 3000000, `payday`는 25이고, `isValidDraft`는 `true`다. `'id' in draft`는 `false`다.
  - `formatAvailablePreview(2400000)`은 `"남는 돈 2,400,000원"`, `(null)`은 `"남는 돈 -원"`이다.
  - 고정비 입력 검증
    - `('', '50000')`, `('   ', '50000')`, `('가'.repeat(21), '1')`은 이름 에러다.
    - `('보험','0')`, `('보험','')`, `('보험','abc')`, `('보험','-50000')`, `('보험','50000.5')`, `('보험','100000001')`은 각각 SPEC 문구의 금액 에러다.
    - `('보험','50,000')`은 `{name:'보험', amount:50000}`이다.
  - `createFixedCost`를 2회 호출하면 id가 서로 다르다. `createdAt`과 `updatedAt`은 `"2026-09-29T01:00:00.000Z"`다.
  - `canAddFixedCost`는 길이 10인 배열에서 `false`다.
- **Covers**: F2-AC-3, F2-AC-4, F2-AC-5, F2-AC-6(검증), F2-AC-7, F2-AC-7a, F2-AC-8(초기값), F2-AC-9, F2-AC-10, F2-AC-11(검증)
- **Files**: `src/lib/planForm.ts`, `src/lib/__tests__/planForm.test.ts`
- **Depends on**: Task 2.4

### Task 2.12 비율 조정 로직 (`ratioForm.ts`)

- **Description**
  - `applyPreset(id)`: 해당 프리셋의 ratios 복사본을 반환한다.
  - `stepRatio(ratios, key, dir: 1 | -1)`: `±5`씩 바꾸고 0~100으로 자른다. 결과는 `{ ratios, presetId: 'custom' }`이다.
  - `canStep(ratios, key, dir)`: `-1`은 값이 0보다 클 때만, `+1`은 값이 100보다 작을 때만 `true`다.
  - `ratioSum(ratios)`
  - `ratioSumText(sum)`: `"합계 {n}%"`를 반환한다.
  - `ratioSumError(sum)`: 합계가 100이 아니면 `"비율 합계를 100%로 맞춰주세요 (현재 {n}%)"`, 100이면 `null`을 반환한다.
  - `formatRatioRow(key, ratio, amount | null)`: `"{라벨} {n}% · {금액}원"`을 반환한다. `null`이면 금액 자리가 `-`다.
- **DoD** (`src/lib/__tests__/ratioForm.test.ts`)
  - `applyPreset('p442')`는 `{40,40,10,10}`이다. available 2400000이면 저축 행이 `"저축 40% · 960,000원"`이다.
  - `p532`에서 저축을 `+1` 하면 저축 35, `presetId 'custom'`, `ratioSumText`는 `"합계 105%"`다. 네 행은 `"생활비 50% · 1,200,000원"`, `"저축 35% · 840,000원"`, `"비상금 10% · 240,000원"`, `"여가 10% · 240,000원"`이다.
  - `{50,30,10,0}`이면 에러가 `"비율 합계를 100%로 맞춰주세요 (현재 90%)"`다.
  - `canStep(여가 0, -1)`과 `canStep(생활비 100, +1)`은 `false`다. 어떤 연속 호출에서도 값이 0 미만이나 100 초과가 되지 않는다(0에서 `-1` 20회, 100에서 `+1` 20회 확인).
  - `{100,30,10,10}`, available 2400000이면 네 행이 `2,400,000 / 720,000 / 240,000 / 240,000원`이고 `-` 부호가 붙은 숫자가 없다. 에러 문구에는 `(현재 150%)`가 들어간다.
  - `formatRatioRow('living', 50, null)`에는 `"50% · -원"`이 들어간다.
- **Covers**: F3-AC-1, F3-AC-2, F3-AC-3(텍스트), F3-AC-4, F3-AC-5, F3-AC-6(포맷), F3-AC-8
- **Files**: `src/lib/ratioForm.ts`, `src/lib/__tests__/ratioForm.test.ts`
- **Depends on**: Task 2.3

### Task 2.13 홈 체크리스트 셀렉터 (`homeView.ts`)

- **Description**
  - `getHomeView(plan, store, today)`를 만든다. 반환값은 다음과 같다.
    ```ts
    {
      monthKey: string;
      rows: { key, bankLabel: '{라벨} 통장', amountText, checked }[];
      checkedCount: number;
      total: number;
      percent: number;
      progressText: string;
    }
    ```
    - `rows`는 `getEligibleKeys(calculateAllocation(plan).amounts)`로 만든다(liveEligible).
    - `checked`는 이번 달 기록이 있으면 `record.checked[key]`, 없으면 `false`다.
    - 저장된 `record.eligible`, `rate`, `planId`는 쓰지 않는다.
    - `progressText`는 `"{c}/{m} 완료 · {p}%"`다.
  - `isCompletionTransition(prevPercent, nextPercent)`: 이전 값이 100 미만이고 다음 값이 100이면 `true`다.
- **DoD** (`src/lib/__tests__/homeView.test.ts`)
  - 예시 A에 기록이 없으면 rows는 4개이고 저축 행은 `bankLabel '저축 통장'`, `amountText '720,000원'`이다. `progressText`는 `"0/4 완료 · 0%"`다.
  - 60:30:10:0이면 rows는 3개이고 여가가 없다. 3개가 모두 체크되어 있으면 `"3/3 완료 · 100%"`다.
  - F6-AC-10: 저장 기록이 `{T,T,F,T}`이고 rate가 75, 계획이 60:30:10:0이면 rows는 3개(`[T,T,F]`)이고 `"2/3 완료 · 67%"`다.
  - F6-AC-7: 9월이 완료된 상태에서 today가 `new Date(2026,9,1)`이면 모든 `checked`가 `false`이고 `"0/4 완료 · 0%"`다.
  - F6-AC-9 계획이면 rows 4개 중 `'생활비 통장'`의 `amountText`가 `'1원'`이다.
  - `isCompletionTransition(75,100)`은 `true`, `(100,100)`과 `(50,75)`는 `false`다.
- **Covers**: F6-AC-2(진행률), F6-AC-4, F6-AC-7, F6-AC-9, F6-AC-10(표시 규칙)
- **Files**: `src/lib/homeView.ts`, `src/lib/__tests__/homeView.test.ts`
- **Depends on**: Task 2.3, Task 2.6

---

## Epic 3. UI 페이지 (화면 하나, 또는 화면 블록 하나당 Task 하나)

> **Risk**
> - **Complexity**: Medium~High. `/plan`과 `/result`가 크다.
> - **Risk factors**
>   1. `/result`에서 `location.state`를 캐스팅만 하고 검증하지 않으면 새로고침이나 직접 진입 때 크래시한다.
>   2. TossRewardAd로 화면 전체를 감싸면 무료 층이 광고 뒤로 숨는다.
>   3. TDS 컴포넌트에 인라인 margin/padding을 넣으면 검수에서 반려된다.
>   4. ListRow onClick과 Switch onChange가 한 번의 탭에 둘 다 실행돼 토글이 두 번 일어날 수 있다.
>   5. `/plan`을 한 Task로 만들면 10분을 넘긴다.
> - **Mitigation**
>   - 모든 로직은 Epic 2의 순수 함수로 끝냈다. 페이지 Task는 조립과 렌더 테스트만 한다.
>   - `/plan`은 BottomSheet, RatioBlock, 페이지 조립 3개로 나눈다. `/result`는 잠금 층 블록, 화면 표시, 저장 흐름 3개로 나눈다. 홈은 체크리스트 카드와 페이지로 나눈다.
>   - 받는 쪽 null 방어는 `/result` Task의 DoD에 별도 테스트로 둔다.
>   - 여백은 `Spacing size`로만 둔다. 각 Task DoD에 `style=` grep 확인을 넣는다.

### Task 3.1 홈 이체 체크리스트 카드 (`ChecklistCard`)

- **Description**
  - props는 `plan: SalaryPlan`이다. 내부에서 `useRecordsState()`를 쓴다.
  - `Card` 안에 다음을 둔다.
    - 제목 "이번 달 이체 체크"
    - `data-testid="progress-text"`
    - `ListRow`를 `data-testid="checklist-row"`로 행마다 하나씩 둔다. 왼쪽 위는 통장명, 아래는 금액이고, 오른쪽은 `Switch`(aria-label `"{통장명} 이체 완료"`)다.
  - 행을 탭하면 토글한다. 이중 토글을 막기 위해 Switch의 이벤트는 `stopPropagation`하고, 처리 함수는 하나로 통일한다.
  - 토글 처리 순서
    1. `logClick('checklist_toggle')`을 호출한다.
    2. `toggle()`을 호출한다.
    3. `ok:false`이면 TDS Toast `"저장하지 못했어요. 다시 시도해주세요"`를 띄운다. 상태가 바뀌지 않았으므로 Switch는 원래 값으로 돌아간다.
    4. `ok:true`이고 `isCompletionTransition(이전 percent, 새 percent)`이면 Toast `"이번 달 통장 쪼개기 완료!"`를 띄우고 `requestReviewOnce()`를 호출한다.
  - 표시는 `getHomeView`만 쓴다.
- **DoD** (`src/components/home/__tests__/ChecklistCard.test.tsx`)
  - F6-AC-2
    - 예시 A에서 저축 Switch를 켜면 `records['2026-09'].checked.saving`은 `true`, `rate`는 25, `planId`는 `"plan_a"`다.
    - `progress-text`는 `"1/4 완료 · 25%"`이고 `logClick('checklist_toggle')`은 1회다.
  - F6-AC-3
    - 4개를 켜면 완료 Toast가 1회, `requestReviewOnce`가 1회다.
    - 하나를 끄면 `rate`는 75, `completedAt`은 `null`이다. 처음 켰을 때의 `id`와 `createdAt`이 끝까지 그대로다.
    - 다시 켜서 100이 되면 Toast가 또 1회 뜬다. 이미 100인 상태에서의 토글에서는 뜨지 않는다.
  - F6-AC-4: 60:30:10:0이면 행이 3개이고 여가 행이 없다. 모두 켜면 `"3/3 완료 · 100%"`이고 `eligible`은 `['living','saving','emergency']`다.
  - F6-AC-6: `setItem`이 예외를 던지면 저축 Switch는 `checked=false`이고, `progress-text`는 토글 전 값이며, 저장 실패 Toast가 표시된다.
  - F6-AC-7: 시스템 시각이 2026-10-01이면 모두 꺼져 있고 `"0/4 완료 · 0%"`다. `records['2026-09']` 문자열은 그대로다.
  - F6-AC-9: 행 4개 중 `"생활비 통장"`과 `"1원"`이 있다. 모두 켜면 `"4/4 완료 · 100%"`이고 `eligible` 길이는 4다.
  - F6-AC-10: 마운트만 했을 때 `"2/3 완료 · 67%"`이고 `setItem`은 0회다. 비상금을 켜면 `"3/3 완료 · 100%"`이고 완료 Toast가 1회다.
  - 행 영역을 1회 탭하면 `toggleRecordItem`이 정확히 1회 호출된다.
  - `grep -n "style=" src/components/home/ChecklistCard.tsx`는 레이아웃용 flex 외에 0건이다.
- **Covers**: F6-AC-2, F6-AC-3, F6-AC-4, F6-AC-6, F6-AC-7, F6-AC-9, F6-AC-10
- **Files**: `src/components/home/ChecklistCard.tsx`, `src/components/home/__tests__/ChecklistCard.test.tsx`
- **Depends on**: Task 2.2, Task 2.10, Task 2.13

### Task 3.2 홈 페이지 (`/`)

- **Description**
  - 구조는 `PageShell > ScreenScaffold`, `Top` 제목 `월급 쪼개기`, 하단 `FloatingTabBar`(홈 `/`, 기록 `/history`)다. FloatingTabBar는 템플릿의 기존 props 규약대로 쓴다.
  - `usePlanState()`로 계획을 읽는다. `location.state`는 읽지 않는다.
  - 계획이 없으면(손상되어 삭제된 경우 포함) 빈 상태를 보여준다.
    - `Asset.ContentIcon`
    - 문구 `"월급을 어디에 얼마씩 나눌지 정해볼까요?"`
    - `Button display="block"` `"월급 계획 짜기"`: `logClick('home_start_plan')` 후 `navigate('/plan')`
  - 계획이 있으면 다음을 보여준다.
    - `data-testid="dday-hero"` SummaryHero: `getNextPayday(getToday(), plan.payday).label`과 `formatPaydayText`
    - `ChecklistCard`
    - Button `"배분 결과 보기"`: state 없이 `navigate('/result')`
    - Button `"계획 수정"`: `navigate('/plan')`
- **DoD** (`src/pages/__tests__/HomePage.test.tsx`, MemoryRouter)
  - F6-AC-1: payday 25, 시각 2026-09-29이면 `dday-hero`에 `"D-26"`과 `"10월 25일 월급날"`이 있다. payday 31이면 `"D-1"`과 `"9월 30일 월급날"`이다.
  - F6-AC-5: 계획이 없으면 빈 상태 문구와 버튼이 있고, `dday-hero`와 `checklist-row`는 0개다. 버튼을 탭하면 `logClick('home_start_plan')` 다음에 `navigate('/plan')`이 호출된다(호출 순서 확인).
  - F6-AC-8: `"계획 수정"`을 탭하면 `/plan`, `"배분 결과 보기"`를 탭하면 `/result`로 간다. 이때 `location.state`는 `null`이다.
  - F6-AC-11: 저장값이 `'{broken'`이거나 `"salary":"3000000"`이면 빈 상태가 표시되고, 계획 키가 삭제되고, `console.error`는 0회다. `paysplit:records:v1` 문자열(`planId` 포함)은 그대로다.
  - `location.state`에 임의의 값을 넣어 진입해도 크래시하지 않는다(state 무시).
- **Covers**: F6-AC-1, F6-AC-5, F6-AC-8, F6-AC-11
- **Files**: `src/pages/HomePage.tsx`, `src/pages/__tests__/HomePage.test.tsx`
- **Depends on**: Task 2.9, Task 3.1

### Task 3.3 고정비 추가 BottomSheet (`FixedCostSheet`)

- **Description**
  - props는 `open`, `onClose`, `onAdd(fc: FixedCost)`다.
  - TDS `BottomSheet` 안에 이름 `TextField`(열리면 자동 포커스)와 금액 `TextField`(`inputMode="numeric"`, `displayAmount`로 표시)를 둔다. 하단에 Button `"추가"`를 둔다.
  - `"추가"`를 탭하면 `validateFixedCostEntry`로 검사한다.
    - 에러가 있으면 해당 필드에 문구를 표시하고 시트를 닫지 않는다.
    - 성공하면 `onAdd(createFixedCost(...))` 후 입력을 초기화하고 닫는다.
  - 키보드가 열리면 시트가 키보드 위로 올라간다. TDS BottomSheet의 기본 동작을 쓰고, 부족하면 `visualViewport` resize에 맞춰 flex 컨테이너 bottom을 조정한다.
- **DoD** (`src/components/plan/__tests__/FixedCostSheet.test.tsx`)
  - F2-AC-6 표 4행과 F2-AC-11 표 5행을 입력하면 각 필드에 정확한 문구가 표시된다. `onAdd`는 0회이고 시트는 열려 있다.
  - 이름 `보험`, 금액 `50,000`이면 `onAdd`가 1회 호출된다. 인자의 `id`는 빈 문자열이 아니고, `createdAt`과 `updatedAt`은 `"2026-09-29T01:00:00.000Z"`이며, `onClose`가 호출된다.
  - 같은 값으로 2회 추가하면 두 `id`가 다르다.
  - 열린 직후 `document.activeElement`가 이름 input이다.
- **Covers**: F2-AC-6(입력 오류 표), F2-AC-11
- **Files**: `src/components/plan/FixedCostSheet.tsx`, `src/components/plan/__tests__/FixedCostSheet.test.tsx`
- **Depends on**: Task 2.11

### Task 3.4 비율 블록 (`RatioBlock`)

- **Description**
  - props는 `ratios`, `presetId`, `available: number | null`, `onChange(ratios, presetId)`다.
  - `Chip` 그룹 안에 `ChipItem` 4개를 둔다: 프리셋 3개와 `"직접 조정"`. `presetId`와 같은 칩을 선택 상태로 표시한다. `"직접 조정"`을 탭하면 ratios는 그대로 두고 presetId만 `'custom'`으로 바꾼다.
  - 비율 행 4개를 `ListRow`로 둔다.
    - 텍스트는 `formatRatioRow(key, ratio, getRatioRowAmount(available ?? 0, ratio))`다.
    - 오른쪽에 −/+ `Button`을 둔다. aria-label은 `"{라벨} 비율 줄이기"`, `"{라벨} 비율 늘리기"`이고, `canStep`이 `false`이면 disabled다.
  - `data-testid="ratio-sum"`에 `ratioSumText`를 표시한다. 합계 에러가 있으면 에러 문구를 `Paragraph.Text`로 표시하되, 색은 TDS 에러 색이나 `var(--adaptive*)` 변수만 쓴다.
- **DoD** (`src/components/plan/__tests__/RatioBlock.test.tsx`)
  - F3-AC-1: `"4:4:2 저축 집중"`을 탭하면 `onChange`가 `{40,40,10,10}`, `'p442'`로 호출된다. 그 값으로 렌더하면 `"저축 40% · 960,000원"`이 보인다.
  - F3-AC-2: `p532` 상태에서 저축 `+`를 탭하면 `onChange`가 저축 35, `'custom'`으로 호출된다. 그 값으로 렌더하면 `"직접 조정"`이 선택되고, `"합계 105%"`와 네 행 문구가 SPEC과 일치한다.
  - F3-AC-3: `ratio-sum`이 항상 렌더된다.
  - F3-AC-4: `{50,30,10,0}`이면 `"비율 합계를 100%로 맞춰주세요 (현재 90%)"`가 보인다.
  - F3-AC-5: 여가가 0이면 여가 `-`가 disabled, 생활비가 100이면 생활비 `+`가 disabled다.
  - F3-AC-6: `available=null`이면 네 행 모두 `"· -원"`을 포함한다.
  - F3-AC-7: `presetId='p532'`로 렌더하면 `"5:3:2 기본"` 칩이 선택 상태다(`aria-selected` 또는 TDS 선택 prop 확인).
  - F3-AC-8: `{100,30,10,10}`, available 2400000이면 네 행 문구와 `"합계 150%"`, 에러 문구가 SPEC과 일치한다. `/-\d/` 패턴이 0건이다.
  - `grep -nE "#[0-9a-fA-F]{3,8}\b" src/components/plan/RatioBlock.tsx`의 결과가 0건이다.
- **Covers**: F3-AC-1, F3-AC-2, F3-AC-3, F3-AC-4, F3-AC-5, F3-AC-6, F3-AC-7, F3-AC-8
- **Files**: `src/components/plan/RatioBlock.tsx`, `src/components/plan/__tests__/RatioBlock.test.tsx`
- **Depends on**: Task 2.12

### Task 3.5 계획 짜기 페이지 (`/plan`)

- **Description**
  - 구조는 `PageShell > ScreenScaffold`, `Top` `계획 짜기`, 하단 고정 `SubmitFooter` `"배분 결과 보기"`다. FloatingTabBar는 두지 않는다.
  - 상태는 `useState(() => initPlanForm(usePlanState().plan))`로 만든다. `location.state`는 읽지 않는다.
  - 위에서 아래로 다음을 둔다.
    1. 월급 `TextField`
       - `inputMode="numeric"`, 값은 `displayAmount(salaryRaw)`다.
       - 보조 문구 `formatManwon`은 월급이 `ok`이고 에러가 없을 때만 표시한다.
       - 에러는 `getSalaryError`로 표시한다.
       - Enter를 누르면 월급날 필드로 포커스한다.
    2. 월급날 `TextField`: 접미사 `"일"`, 에러는 `getPaydayError`다.
    3. 고정비 섹션
       - 고정비가 0개면 안내 문구 `"월세·통신비처럼 매달 나가는 돈을 추가해보세요"`를 표시한다.
       - 고정비 행은 `ListRow`로 `"{이름} · {금액}원"`을 표시한다. 오른쪽 삭제 Button은 44×44px 이상이고, React key는 `FixedCost.id`, 삭제는 id로 필터한다.
       - `"고정비 추가"` Button: 10개면 Toast로 최대 개수 문구를 띄우고 시트를 열지 않는다. 아니면 `FixedCostSheet`를 연다.
       - `data-testid="available-preview"`
       - `getFixedTotalError` 문구
    4. `RatioBlock`
  - 모든 숫자 필드는 포커스될 때 `scrollIntoView({block:'center'})`한다.
  - SubmitFooter는 `disabled={isSubmitDisabled(state)}`다. 탭하면 다음 순서로 처리한다.
    1. `logClick('plan_submit')`을 호출한다.
    2. `submitAttempted`를 `true`로 바꾼다.
    3. `toDraft`가 `null`이면 멈춘다.
    4. 아니면 `const state: RouteState['/result'] = { draft }; navigate('/result', { state })`를 호출한다.
- **DoD** (`src/pages/__tests__/PlanPage.test.tsx`, MemoryRouter로 `/result` 도착 화면에서 `location.state`를 읽어 확인)
  - F2-AC-1: 월급 `3000000`에 고정비 2개를 추가하면 `"300만 원"`과 `"남는 돈 2,400,000원"`이 보인다.
  - F2-AC-2: 제출하면 도착 state의 `draft.salary`는 3000000, `payday`는 25다. `id`, `createdAt`, `updatedAt`, `version` 키가 없고 `isValidDraft`는 `true`다. `logClick('plan_submit')`은 1회다.
  - F2-AC-3: 월급이 빈 값이면 버튼은 enabled이고, 탭하면 `"월급을 입력해주세요"`가 보이며 이동하지 않는다.
  - F2-AC-4: `100000001`이면 에러가 보이고 버튼이 disabled다.
  - F2-AC-5: 월급 1000000에 고정비 1000000이면 에러가 보이고 disabled다.
  - F2-AC-6(개수 제한): 고정비가 10개면 `"고정비 추가"`를 탭했을 때 Toast `"고정비는 최대 10개까지 추가할 수 있어요"`가 뜨고 BottomSheet가 렌더되지 않는다.
  - F2-AC-7: 월급날 `32`나 `0`이면 에러가 보이고 disabled다.
  - F2-AC-7a
    - 월급날을 지우면 에러와 disabled가 유지되고, blur한 뒤에도 값은 `''`다.
    - `2.5`, `-`, `abc`는 원문 그대로 남는다.
    - `10`을 입력하면 에러가 사라지고, 제출한 draft의 `payday`는 10이다.
  - F2-AC-8
    - 저장된 계획이 없으면 월급은 빈 값, 월급날은 `25`, `"5:3:2 기본"`이 선택되고, 안내 문구와 `"고정비 추가"` 버튼이 보인다.
    - 예시 A가 저장되어 있으면 `3,000,000`과 고정비 2행이 채워진다. 바로 제출한 draft의 고정비 id는 `["fc_rent","fc_phone"]`이고 타임스탬프는 원본 그대로다.
  - F2-AC-9: 월급이 빈 값이거나 `0`이거나 `400000`이면 `"남는 돈 -원"`이다. `400000`일 때는 고정비 합계 에러도 함께 보인다.
  - F2-AC-10
    - 표 4행을 입력하면 각 에러가 보이고, disabled이며, `"남는 돈 -원"`이고, 보조 문구가 없고, 원문이 유지된다.
    - 다시 `3000000`을 입력하면 `3,000,000`, `"300만 원"`, `"남는 돈 2,500,000원"`이다.
    - `3,000,000`이나 ` 3000000 `을 붙여넣어도 에러가 없다.
  - F3-AC-3(연동): 비율 합계가 105이면 SubmitFooter가 disabled이고, 100으로 돌아가면 enabled다.
  - 월급 필드에서 Enter를 누르면 `document.activeElement`가 월급날 input이다.
- **Covers**: F2-AC-1, F2-AC-2, F2-AC-3, F2-AC-4, F2-AC-5, F2-AC-6, F2-AC-7, F2-AC-7a, F2-AC-8, F2-AC-9, F2-AC-10, F3-AC-3
- **Files**: `src/pages/PlanPage.tsx`, `src/pages/__tests__/PlanPage.test.tsx`
- **Depends on**: Task 2.2, Task 2.10, Task 3.3, Task 3.4

### Task 3.6 결과 잠금 층 블록 (`LockedTierSection`)

- **Description**
  - props는 `source: Pick<PlanDraft,'salary'|'fixedCosts'|'ratios'>`다. 기록은 `useRecordsState().store`로 읽기만 한다.
  - 이 컴포넌트는 광고 게이트를 모른다. 감싸는 일은 Task 3.7이 한다.
  - `data-testid="bracket-compare"` Card
    - 제목은 `"월급이 달라지면 저축은?"`이다.
    - `data-testid="bracket-row"` ListRow를 구간마다 둔다. 월급, 월 저축액, 연 저축액을 표시하고, MiniBar는 최대 저축액 대비 비율로 그린다. `isCurrent`인 행에는 Badge `"내 월급"`을 붙인다.
  - `data-testid="trend-block"` Card
    - `hasEnoughTrend`이면 다음을 표시한다.
      - `data-testid="trend-sparkline"` Sparkline(6포인트). 템플릿 Sparkline이 `null`을 지원하지 않으면 기록 없는 달은 빈 점 마커로 따로 렌더한다.
      - `data-testid="trend-average"`: `"6개월 평균 이행률 {n}%"`
      - `data-testid="trend-streak"`: `"연속 완료 {n}개월"`
    - 아니면 안내 문구 `"이행 기록이 2개월 이상 쌓이면 추이를 보여드려요"`를 표시한다.
  - `useImpressionOnce('result_locked_tier')`를 호출한다.
- **DoD** (`src/components/result/__tests__/LockedTierSection.test.tsx`)
  - F5-AC-2: 예시 A이면 `bracket-row`가 5개다. 순서와 금액이 SPEC과 같고, 3번째 행에만 `"내 월급"`이 있다. `"8,640,000원"` 텍스트가 있다.
  - F5-AC-3: 월급 1000000, 고정비 600000이면 행이 3개다.
  - F5-AC-4: 시각 2026-09-29, 기록 `07:100/08:50/09:75`이면 다음과 같다.
    - Sparkline에 넘긴 포인트가 6개이고 4·5·6월은 빈 점이다.
    - `trend-average`는 `"6개월 평균 이행률 75%"`, `trend-streak`은 `"연속 완료 0개월"`이다.
  - F5-AC-5: 기록 `07:100/08:100/09:40`이면 `"연속 완료 2개월"`이다.
  - F5-AC-6: 기록이 1개월이면 안내 문구가 보이고 `trend-sparkline`은 0개이며 `bracket-compare`는 렌더된다.
  - F5-AC-7: `paysplit:records:v1 = 'null'`이면 안내 문구가 보이고 `console.error`는 0회다.
  - 3회 리렌더해도 `logImpression('result_locked_tier')`는 1회다.
- **Covers**: F5-AC-2, F5-AC-3, F5-AC-4, F5-AC-5, F5-AC-6, F5-AC-7
- **Files**: `src/components/result/LockedTierSection.tsx`, `src/components/result/__tests__/LockedTierSection.test.tsx`
- **Depends on**: Task 2.2, Task 2.8, Task 2.10

### Task 3.7 배분 결과 페이지 — 표시·진입 분기 (`/result`)

- **Description**
  - 구조는 `PageShell > ScreenScaffold`, `Top` `배분 결과`다. FloatingTabBar는 두지 않는다.
  - **받는 쪽 null 방어 (필수)**
    ```ts
    const raw = (useLocation().state as RouteState['/result']) ?? null;
    const incoming = raw !== null && typeof raw === 'object' && isValidDraft((raw as ResultRouteState).draft)
      ? (raw as ResultRouteState).draft : null;
    const { plan } = usePlanState();
    const source = incoming ?? plan; // 둘 다 null → 빈 상태
    ```
    - 금지: `useLocation().state as X`를 곧바로 구조 분해하거나 `.draft.salary`에 접근하는 코드.
  - **빈 상태** (`source`가 `null`)
    - `Asset.ContentIcon`, `"아직 계획이 없어요"`, Button `"월급 계획 짜기"`(`navigate('/plan')`)를 표시한다.
    - `free-tier`와 `locked-tier`는 렌더하지 않는다.
  - **무료 층** (`data-testid="free-tier"`, TossRewardAd **바깥**)
    - `data-testid="available-hero"` SummaryHero: 라벨 `"남는 돈"`, CountUp 값 `available`, 보조 문구 `"월급 {formatWon} − 고정비 {formatWon}"`
    - `getEligibleKeys` 결과만큼 `data-testid="allocation-card"` Card를 둔다. 각 카드는 통장명, 금액(t3 강조 타이포), `{n}%`, MiniBar를 표시한다.
    - Button `"친구에게 공유하기"`: `logClick('result_share')`와 `shareApp()`을 호출한다.
    - `useImpressionOnce('result_free_tier')`를 호출한다.
  - **잠금 층**
    ```tsx
    <TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>
      <div data-testid="locked-tier"><LockedTierSection source={source} /></div>
    </TossRewardAd>
    ```
  - SubmitFooter는 이 Task에서 표시만 한다(저장 동작은 Task 3.8).
    - `incoming`이 있으면 `"이 계획 저장하기"`다. 이 Task에서는 onClick을 no-op으로 둔다.
    - 저장된 계획 모드이면 `"홈에서 이체 체크하기"`이고 `navigate('/')`를 호출한다.
- **DoD** (`src/pages/__tests__/ResultPage.view.test.tsx`, TossRewardAd는 children을 즉시 렌더하도록 mock)
  - F4-AC-1: 예시 A 초안이 state로 오면 `free-tier` 안에 `"남는 돈"`, `2,400,000원`, `생활비 1,200,000원`, `저축 720,000원`, `비상금 240,000원`, `여가 240,000원`이 있다.
  - F4-AC-2
    - `available-hero`가 `free-tier` 안에 있고, SummaryHero의 value prop은 2400000이다.
    - 예시 A이면 `allocation-card`가 4개다.
    - available 5 초안이면 카드가 2개(생활비, 저축)다.
    - 카드마다 MiniBar가 렌더된다.
  - F4-AC-4: state 없이 저장된 예시 A로 진입하면 같은 금액이 표시되고 라벨은 `"홈에서 이체 체크하기"`다. 탭하면 `/`로 간다.
  - F4-AC-5: state도 계획도 없으면 `"아직 계획이 없어요"`가 표시된다. 버튼을 누르면 `/plan`으로 간다. `free-tier`와 `locked-tier`는 0개다.
  - F4-AC-6: (a)~(f) 초안마다 저장된 계획이 있으면 AC-4 화면, 없으면 AC-5 화면이다. `console.error`는 0회다.
  - **추가 AC (state 직접 진입)**: `location.state`가 `undefined`, `null`, `"garbage"`, `123`, `{}`, `{draft: undefined}`인 6가지로 `/result`에 직접 진입해도 크래시하지 않는다. 저장된 계획이 있으면 결과를, 없으면 빈 상태를 보여준다.
  - F4-AC-8: 공유를 탭하면 `logClick('result_share')` 1회, `shareApp` 1회가 호출된다.
  - F5-AC-1: `locked-tier`는 TossRewardAd mock의 children 안에서만 렌더되고, `bracket-compare`와 `trend-block`을 포함한다. `free-tier`는 TossRewardAd의 자손이 아니다(DOM 조상 검사).
  - `src/pages/ResultPage.tsx`에서 `<TossRewardAd`는 1건이고, 그 자식에 `free-tier`가 없다(코드 리뷰 체크).
- **Covers**: F4-AC-1, F4-AC-2, F4-AC-4, F4-AC-5, F4-AC-6, F4-AC-8, F5-AC-1
- **Files**: `src/pages/ResultPage.tsx`, `src/pages/__tests__/ResultPage.view.test.tsx`
- **Depends on**: Task 2.10, Task 3.6

### Task 3.8 배분 결과 페이지 — 저장 흐름·덮어쓰기 확인

- **Description**
  - `useSavePlanFlow(incoming, planState)` 훅을 만든다. 반환값은 `{ saved, dialogOpen, onSaveTap, onConfirm, onCancel }`이다.
    - `onSaveTap`
      1. `logClick('plan_save')`를 호출한다.
      2. `current = loadPlan()`을 읽는다.
      3. `current`가 `null`이거나 `isSamePlan(current, draft)`이면 `doSave()`를 호출한다.
      4. 아니면 `dialogOpen`을 `true`로 바꾼다. 이 시점에는 저장하지 않는다.
    - `onConfirm`: `logClick('plan_overwrite_confirm')` 후 `doSave()`를 호출한다.
    - `doSave`
      - `save(draft)`가 `ok`이면 Toast `"계획을 저장했어요"`, `requestReviewOnce()`, `saved=true` 순서로 처리한다.
      - 실패하면 Toast `"저장 공간이 부족해 저장하지 못했어요"`를 띄운다. `saved`는 그대로이고 리뷰는 호출하지 않는다.
    - `onCancel`: Dialog를 닫는다. 저장, Toast, 리뷰는 하지 않는다.
  - TDS `AlertDialog`
    - 제목: `"저장된 계획을 바꿀까요?"`
    - 설명: `"지금 계획으로 바뀌고, 이전 계획은 되돌릴 수 없어요. 이체 체크 기록은 그대로 남아요."`
    - 버튼: `"바꾸기"`, `"취소"`
    - 딤을 탭하거나 `onClose`가 호출되면 `onCancel`한다. 뒤로가기(popstate)를 하면 Dialog가 열려 있을 때 닫기만 한다.
  - SubmitFooter 라벨
    - `incoming`이 있고 `!saved`이면 `"이 계획 저장하기"`다.
    - 그 외에는 `"홈에서 이체 체크하기"`이고 `navigate('/')`를 호출한다.
- **DoD** (`src/pages/__tests__/ResultPage.save.test.tsx`)
  - F4-AC-3
    - 저장된 계획이 없을 때 저장하면 Dialog가 0회 열리고, Toast `"계획을 저장했어요"`가 뜨고, 저장된 `id`는 빈 문자열이 아니며 `createdAt === updatedAt`이다.
    - `requestReviewOnce`는 1회이고, 라벨은 `"홈에서 이체 체크하기"`가 된다. 탭하면 `/`로 간다.
  - F4-AC-7: `savePlan`이 QUOTA를 반환하면 실패 Toast가 뜨고, 라벨은 `"이 계획 저장하기"` 그대로이며, 리뷰는 0회다. 덮어쓰기 경우에는 `"바꾸기"`를 탭한 뒤에도 같다.
  - F4-AC-9
    - 예시 A가 저장된 상태에서 salary 3500000 초안을 저장하면 Dialog의 제목·설명·버튼 문구가 일치한다. Dialog가 열린 동안 계획 문자열은 탭 전과 같다.
    - `"취소"`를 탭해도, 딤을 탭해도(`onClose`) 문자열은 그대로이고, 라벨도 그대로이며, Toast와 리뷰는 0회다.
    - 시각 `02:00Z`에서 `"바꾸기"`를 탭하면 다음과 같다.
      - `logClick('plan_overwrite_confirm')`이 1회 호출된다.
      - `loadPlan()`의 `salary`는 3500000, `id`는 `"plan_a"`, `createdAt`은 `"2026-09-01T00:00:00.000Z"`, `updatedAt`은 `"2026-09-29T02:00:00.000Z"`다.
      - Toast가 뜨고 라벨이 바뀐다.
      - `paysplit:records:v1` 문자열은 그대로다.
  - F4-AC-10: 초안이 예시 A와 `isSamePlan`이면(고정비 id와 presetId만 다름) Dialog가 0회 열리고 바로 저장된다. `id`와 `createdAt`은 저장 전과 같다.
- **Covers**: F4-AC-3, F4-AC-7, F4-AC-9, F4-AC-10
- **Files**: `src/pages/useSavePlanFlow.ts`, `src/pages/ResultPage.tsx`, `src/pages/__tests__/ResultPage.save.test.tsx`
- **Depends on**: Task 2.2, Task 3.7

### Task 3.9 이행 기록 페이지 (`/history`)

- **Description**
  - 구조는 `PageShell > ScreenScaffold`, `Top` `이행 기록`, 하단 `FloatingTabBar`다. `location.state`는 읽지 않는다.
  - 기록은 `useRecordsState().store`로 읽기만 한다. `planId`로 계획을 조회하지 않는다.
  - 기록이 0개면 빈 상태를 보여준다.
    - `Asset.ContentIcon`, `"아직 기록이 없어요"`
    - Button `"이번 달 체크하러 가기"`: `navigate('/')`
  - 기록이 있으면 다음을 보여준다.
    - `data-testid="history-hero"` SummaryHero: 라벨 `"이번 달 이행률"`, 단위 `%`, 값은 이번 달 레코드의 `rate`이고 없으면 0이다. 0일 때는 보조 문구 `"이번 달은 아직 체크 전이에요"`를 표시한다.
    - `Card` 안에 `data-testid="month-row"` ListRow를 월 내림차순으로 둔다. onClick은 없다.
      - 왼쪽은 `"{YYYY}년 {M}월"`이다.
      - 오른쪽은 `"{rate}%"`와 MiniBar다.
      - rate가 100이면 Badge `"완료"`를 붙인다.
      - React key는 `record.id`다.
    - 목록 끝에 `Spacing size={80}`을 둔다. AdSlot 자리는 Task 4.2에서 이 Spacing 바로 앞에 넣는다.
  - 가상 스크롤은 쓰지 않는다.
- **DoD** (`src/pages/__tests__/HistoryPage.test.tsx`)
  - F7-AC-1: 기록 `07:100/08:50/09:75`이면 `month-row`가 3개이고 텍스트 순서가 `2026년 9월 → 8월 → 7월`이다. 오른쪽은 `75%`, `50%`, `100%`이고 `"완료"` Badge는 7월 행에만 있다.
  - F7-AC-2: 시각이 2026-09-29이면 hero의 value prop은 75이고 라벨은 `"이번 달 이행률"`이다.
  - F7-AC-3: 기록이 0개이면 빈 상태 문구와 버튼이 있고 `month-row`는 0개다. 버튼을 누르면 `/`로 간다.
  - F7-AC-4: 8월 기록만 있으면 hero는 0이고 `"이번 달은 아직 체크 전이에요"`가 보인다.
  - F7-AC-5: `'{broken'`이면 빈 상태가 보이고 `console.error`는 0회다.
  - F7-AC-6: 마지막 요소가 `Spacing size={80}`이다. 목록 컨테이너에 `overflow`나 가상 스크롤 라이브러리가 없다(grep).
  - F7-AC-8: 8월 `"rate":"50"`이면 행이 2개(`9월 75%`, `7월 100%`)이고 hero는 75다. 마운트 후 `setItem`은 0회이고 문자열은 그대로다.
  - F7-AC-9: `planId:"plan_deleted"`인 레코드와 레거시 레코드가 행 2개로 `50%`, `100%`를 표시한다. `console.error`는 0회다.
- **Covers**: F7-AC-1, F7-AC-2, F7-AC-3, F7-AC-4, F7-AC-5, F7-AC-6, F7-AC-8, F7-AC-9
- **Files**: `src/pages/HistoryPage.tsx`, `src/pages/__tests__/HistoryPage.test.tsx`
- **Depends on**: Task 2.10

### Task 3.10 404 페이지 (`*`)

- **Description**
  - 구조는 `PageShell > ScreenScaffold`, `Top` `월급 쪼개기`다. FloatingTabBar, SubmitFooter, AdSlot은 두지 않는다.
  - 상태 훅이나 storage를 import하지 않는다.
  - `data-testid="not-found"` 영역 안에 다음 순서로 둔다.
    1. `Asset.ContentIcon`
    2. `Spacing size={16}`
    3. `"페이지를 찾을 수 없어요"`
    4. `"주소가 바뀌었거나 없는 화면이에요"`
    5. `Spacing size={24}`
    6. `Button display="block"` `"홈으로 가기"`: `navigate('/', { replace: true })`
  - `useImpressionOnce('not_found')`를 호출한다.
- **DoD** (`src/pages/__tests__/NotFoundPage.test.tsx`)
  - F8-AC-1(화면 부분)
    - 제목·보조 문구·버튼이 모두 있다.
    - FloatingTabBar, SubmitFooter, AdSlot 렌더가 0개다(mock 확인).
    - `logImpression('not_found')`는 1회다.
    - `getItem`, `setItem`, `removeItem` 스파이가 모두 0회다.
  - F8-AC-2: MemoryRouter `initialEntries=['/', '/unknown']`에서 `"홈으로 가기"`를 탭하면 홈이 렌더되고 history 길이가 2 그대로다(replace). `navigate(-1)`을 하면 `/`로 가고 `/unknown`으로 가지 않는다.
  - `grep -nE "storage|usePlanState|useRecordsState" src/pages/NotFoundPage.tsx`의 결과가 0건이다.
- **Covers**: F8-AC-1(화면), F8-AC-2
- **Files**: `src/pages/NotFoundPage.tsx`, `src/pages/__tests__/NotFoundPage.test.tsx`
- **Depends on**: Task 2.2

---

## Epic 4. 통합 + 마감 (라우팅, 광고 배치, 검수 대응)

> **Risk**
> - **Complexity**: Medium
> - **Risk factors**
>   1. 템플릿의 Router 종류(Browser/Hash)나 basename과 충돌해 끝 슬래시나 해시 경로가 404가 될 수 있다.
>   2. 광고 ID가 비어 있는 빌드에서 게이트가 열리지 않으면 잠금 층에서 사용자가 막힌다.
>   3. `AdSlot`이 로드에 실패해도 높이를 차지해 빈 공간이 남을 수 있다.
>   4. 검수 grep 항목(HEX, 외부 URL, 호환 API)이 나중에 다시 들어올 수 있다.
>   5. 콘솔 경고(`No routes matched`, key 경고)가 남을 수 있다.
> - **Mitigation**
>   - 라우팅은 페이지가 모두 테스트된 뒤 마지막에 한 번 연결하고, 템플릿 Router 종류는 바꾸지 않는다(1).
>   - 광고 ENV를 비운 상태의 전체 흐름 통합 테스트를 둔다(2, 5).
>   - AdSlot은 감싸기만 하고 min-height를 주지 않는다(3).
>   - 검수 grep을 `npm run check:compliance` 스크립트로 고정한다(4).

### Task 4.1 라우터 연결 (5개 Route, `*`는 마지막)

- **Description**
  - `src/AppRoutes.tsx`에 `<Routes>`를 둔다. 순서는 `/` → `HomePage`, `/plan` → `PlanPage`, `/result` → `ResultPage`, `/history` → `HistoryPage`, `*` → `NotFoundPage`다.
  - 테스트에서 `MemoryRouter`로 감쌀 수 있도록 Router와 분리한다.
  - `src/App.tsx`는 템플릿의 기존 Router(종류와 basename 유지)로 `AppRoutes`를 감싼다.
  - 앱 안의 이동은 모두 `navigate()`로만 한다. `window.open`이나 `location.href`에 외부 URL을 넣지 않는다.
- **DoD** (`src/__tests__/routes.test.tsx`)
  - F8-AC-3: `grep -rnE "path=\"\*\"|path: '\*'" src`의 결과가 1건이다. AppRoutes의 `<Route>`는 5개이고 마지막이 `*`다.
  - F8-AC-4
    - `/plan/`과 `/plan?from=home`은 `Top` `계획 짜기`, `/history#top`은 `이행 기록`을 렌더한다.
    - 세 경우 모두 `not-found`는 0개다.
    - Hash 라우터 템플릿이면 해시 쪽 경로는 템플릿 규칙에 맞춰 검증한다.
  - F8-AC-1(라우팅): `/unknown`, `/history/2026-09`, `/plan/edit`는 `not-found`를 렌더한다. `console.warn`에 `No routes matched`가 0회다.
  - F8-AC-2: `/unknown`에서 `"홈으로 가기"`를 탭하면 홈이 렌더되고, 뒤로가기를 해도 404로 돌아가지 않는다.
  - AC-C1: `grep -rnE "window\.open\(|window\.location\.href\s*=" src`에서 `http`로 시작하는 URL 매치가 0건이다.
- **Covers**: F8-AC-1, F8-AC-2, F8-AC-3, F8-AC-4, AC-C1
- **Files**: `src/AppRoutes.tsx`, `src/App.tsx`, `src/__tests__/routes.test.tsx`
- **Depends on**: Task 3.2, Task 3.5, Task 3.8, Task 3.9, Task 3.10

### Task 4.2 광고 배치 + fail-open 확인

- **Description**
  - `/result`: 잠금 층 아래, SubmitFooter 위에 `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` 1개를 둔다. `useImpressionOnce('result_banner')`를 호출한다.
  - `/history`: 마지막 `month-row` Card 아래, `Spacing size={80}` 앞에 AdSlot 1개를 둔다. `useImpressionOnce('history_banner')`를 호출한다. 빈 상태에서는 두지 않는다.
  - AdSlot을 감싸는 요소에 `min-height`나 고정 높이를 주지 않는다.
  - 템플릿 `TossRewardAd`가 `slotId`가 빈 값·`undefined`이거나 로드 실패·타임아웃일 때 children을 자동으로 여는지 확인한다(템플릿 동작 검증, 재설계 금지).
- **DoD** (`src/__tests__/ads.test.tsx`)
  - F7-AC-7
    - `/history`의 AdSlot은 1개이고 DOM 순서가 `마지막 month-row` < `AdSlot` < `Spacing(80)`이다.
    - AdSlot mock이 아무것도 렌더하지 않으면 감싸는 요소의 inline style에 height·min-height가 없다.
  - `/result`의 AdSlot은 1개이고 `locked-tier` 뒤, SubmitFooter 앞에 있다.
  - F5-AC-1, F4-AC-1, AC-C8
    - **mock 없는 실제 템플릿** `TossRewardAd`에 `slotId=""`와 `undefined`를 넣으면 `locked-tier`가 렌더된다. 타이머를 끝까지 진행해도 된다.
    - `free-tier`는 광고 상태와 관계없이 첫 렌더부터 보인다.
  - `/`, `/plan`, `*`에는 AdSlot이 0개다.
- **Covers**: F7-AC-7, F5-AC-1, F4-AC-1, AC-C8
- **Files**: `src/pages/ResultPage.tsx`, `src/pages/HistoryPage.tsx`, `src/__tests__/ads.test.tsx`
- **Depends on**: Task 4.1

### Task 4.3 검수 규칙 자동 점검 + 터치 영역 QA

- **Description**
  - `scripts/check-compliance.sh`를 만들고 `package.json`에 `"check:compliance"`로 등록한다. 템플릿 파일은 제외 목록으로 관리하고, 매치가 1건 이상이면 exit 1이다.
    - AC-C1: `window.open(` 또는 `window.location.href =`에 `http`로 시작하는 URL
    - AC-C3: 템플릿 외 `src/**/*.{ts,tsx,css}`에서 `#[0-9a-fA-F]{3,8}\b`
    - AC-C4: `설치하세요|다운로드|앱 받기`
    - AC-C5: `package.json`과 `src`에서 외부 분석 SDK 5종
    - AC-C6: `structuredClone|\.at\(|Object\.hasOwn|\.findLast\(|\.toSorted\(|randomUUID`
    - F8-AC-3: `path="*"`가 정확히 1건
  - `docs/qa-checklist.md`에 AC-C7 수동 측정 절차를 적는다.
    - 기기 프레임 375×812에서 DevTools로 측정한다.
    - 대상 요소 높이가 44px 이상이어야 통과다: 모든 `Button`, `Switch`, onClick이 있는 `ListRow`, `ChipItem`, −/+ 버튼과 고정비 삭제 버튼(44×44px 이상).
    - 홈 checklist ListRow는 56px 이상, 주요 버튼은 48px 이상이어야 통과다.
  - 코드 규칙: 위 요소들에 `style={{ height` 같은 높이 축소 코드가 없어야 한다.
- **DoD**
  - `npm run check:compliance`가 exit 0이다.
  - HEX 문자열 1개를 일부러 넣으면 exit 1이 되는지 확인한 뒤 되돌린다.
  - `docs/qa-checklist.md`에 요소별 측정값 표가 채워져 있고 모두 기준 이상이다.
  - `grep -rnE "style=\{\{[^}]*(height|padding|margin)" src/pages src/components/home src/components/plan src/components/result`의 결과가 0건이다. flex/grid 배치용 스타일은 CSS 클래스로 분리한다.
- **Covers**: AC-C1, AC-C3, AC-C4, AC-C5, AC-C6, AC-C7
- **Files**: `scripts/check-compliance.sh`, `package.json`, `docs/qa-checklist.md`
- **Depends on**: Task 4.2

### Task 4.4 전체 흐름 통합 테스트 (콘솔 에러 0, 광고 없이 완주)

- **Description**
  - `src/__tests__/app-flow.test.tsx`
    - `MemoryRouter` + `AppRoutes`를 쓰고, 광고 ENV 두 개를 빈 문자열로 stub한다(`vi.stubEnv`).
    - `console.error`와 `console.warn`에 스파이를 건다.
    - 흐름은 다음 순서다.
      1. `/`의 빈 상태에서 `"월급 계획 짜기"`를 탭한다.
      2. `/plan`에서 예시 A를 입력하고 `"배분 결과 보기"`를 탭한다.
      3. `/result`에서 `"이 계획 저장하기"`를 탭한 뒤 `"홈에서 이체 체크하기"`를 탭한다.
      4. `/`에서 Switch 4개를 켠다.
      5. 탭바로 `/history`에 간다.
      6. `/does-not-exist`로 이동한다.
      7. `"홈으로 가기"`를 탭한다.
  - `docs/qa-checklist.md`에 프로덕션 확인 절차를 추가한다. `vite build && vite preview`에서 같은 흐름을 수동으로 수행하고 DevTools 콘솔의 error·warn 개수를 적는다.
- **DoD**
  - 통합 테스트가 통과한다.
    - 모든 단계가 막히지 않는다. 각 단계의 기대 testid(`available-preview`, `free-tier`, `locked-tier`, `progress-text="4/4 완료 · 100%"`, `month-row` 1개, `not-found`, `dday-hero`)가 보인다.
    - `console.error`는 0회, `No routes matched`를 포함한 `console.warn`도 0회다.
  - 404 진입 직전과 직후의 localStorage 세 키 문자열이 같다(F8-AC-1).
  - `docs/qa-checklist.md`의 프로덕션 콘솔 기록이 error 0, warn 0이다.
- **Covers**: AC-C2, AC-C8, F8-AC-1, F8-AC-2, F4-AC-1
- **Files**: `src/__tests__/app-flow.test.tsx`, `docs/qa-checklist.md`
- **Depends on**: Task 4.3

---

## Task 순서 요약

- 먼저 할 작업: `1.1` → `2.1` → `2.2` → `2.3` → `2.4` → `2.5` → `2.6` → `2.7` → `2.8` → `2.9` → `2.10`
- 그다음 병렬로 할 수 있는 작업: `2.11`, `2.12`, `2.13`
- 그다음 할 작업: `3.1` → `3.2` → `3.3` → `3.4` → `3.5` → `3.6` → `3.7` → `3.8` → `3.9` → `3.10` → `4.1` → `4.2` → `4.3` → `4.4`

Task는 모두 31개다(Epic 1: 1개, Epic 2: 13개, Epic 3: 10개, Epic 4: 4개).

---

## AC Coverage

- **SPEC의 AC 총수: 88개**
  - 공통 8개(AC-C1~C8)
  - F1 19개
  - F2 12개(AC-1~7, 7a, 8~11)
  - F3 8개
  - F4 10개
  - F5 7개
  - F6 11개
  - F7 9개
  - F8 4개
- **Task에 포함된 AC: 88개 (100%)**

| AC | 담당 Task |
|---|---|
| AC-C1 | 4.1, 4.3 |
| AC-C2 | 4.4 |
| AC-C3 | 4.3 |
| AC-C4 | 4.3 |
| AC-C5 | 2.2, 4.3 |
| AC-C6 | 2.1, 4.3 |
| AC-C7 | 4.3 |
| AC-C8 | 4.2, 4.4 |
| F1-AC-1, 2 | 2.3 |
| F1-AC-3 | 2.5 |
| F1-AC-4 | 2.7 |
| F1-AC-5, 6 | 2.5 |
| F1-AC-7 | 2.5, 2.6 |
| F1-AC-8, 9, 10, 11 | 2.7 |
| F1-AC-12 | 2.4, 2.5 |
| F1-AC-13 | 2.5 |
| F1-AC-14 | 2.7 |
| F1-AC-15 | 2.4, 2.5 |
| F1-AC-16 | 2.6, 2.7 |
| F1-AC-17 | 2.6 |
| F1-AC-18 | 2.5, 2.7 |
| F1-AC-19 | 2.2 |
| F2-AC-1 | 2.1, 3.5 |
| F2-AC-2 | 3.5 |
| F2-AC-3, 4, 5, 7, 7a, 9 | 2.11, 3.5 |
| F2-AC-6 | 2.11, 3.3, 3.5 |
| F2-AC-8 | 2.11, 3.5 |
| F2-AC-10 | 2.1, 2.11, 3.5 |
| F2-AC-11 | 2.11, 3.3 |
| F3-AC-1, 2, 4, 5, 6 | 2.12, 3.4 |
| F3-AC-3 | 2.12, 3.4, 3.5 |
| F3-AC-7 | 2.3, 3.4 |
| F3-AC-8 | 2.3, 2.12, 3.4 |
| F4-AC-1 | 3.7, 4.2, 4.4 |
| F4-AC-2, 4, 5 | 3.7 |
| F4-AC-6 | 2.4, 3.7 |
| F4-AC-3, 7, 9 | 3.8 |
| F4-AC-8 | 2.2, 3.7 |
| F4-AC-10 | 2.4, 3.8 |
| F5-AC-1 | 3.7, 4.2 |
| F5-AC-2, 3, 4, 5, 6 | 2.8, 3.6 |
| F5-AC-7 | 2.6, 3.6 |
| F6-AC-1 | 2.9, 3.2 |
| F6-AC-2, 4, 7, 9, 10 | 2.13, 3.1 |
| F6-AC-3 | 3.1 |
| F6-AC-5, 8 | 3.2 |
| F6-AC-6 | 2.10, 3.1 |
| F6-AC-11 | 2.10, 3.2 |
| F7-AC-1, 2, 3, 4, 6 | 3.9 |
| F7-AC-5, 8, 9 | 2.6, 3.9 |
| F7-AC-7 | 4.2 |
| F8-AC-1 | 2.10, 3.10, 4.1, 4.4 |
| F8-AC-2 | 3.10, 4.1, 4.4 |
| F8-AC-3, 4 | 4.1 |

- **Task에 포함되지 않은 AC: 0개**

---

참고로, 이 세션에서는 claude.ai Canva 커넥터가 인증되지 않아 쓸 수 없습니다. claude.ai 커넥터 설정에서 인증하면 쓸 수 있습니다. 이번 TASK 작성에는 필요하지 않았습니다.