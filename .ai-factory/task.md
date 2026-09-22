# TASK — PaySplitPlan

> 가정
> - 테스트 러너는 vitest와 @testing-library/react입니다. 템플릿에 없으면 Task 2.1에서 devDependency로 추가합니다.
> - 날짜는 `vi.useFakeTimers({ now: new Date(2026, 8, 23) })`로 고정해서 검증합니다.
>
> 템플릿 제공물은 다시 만들지 않고 템플릿 경로 그대로 import만 합니다.
> - `ScreenScaffold`, `PageShell`, `SubmitFooter`, `SummaryHero`, `Sparkline`, `MiniBar`
> - `FloatingTabBar`, `AdSlot`, `TossRewardAd`
> - `logClick`, `logImpression`, `shareApp`, `requestReviewOnce`

---

## Epic 1. Types

**Risk**
- **Complexity**: Low
- **Risk factors**:
  - RouteState가 빠지면 페이지마다 state 모양이 달라집니다(`draft` 또는 `plan`, `justSaved` 또는 `saved`).
  - 그러면 `/ratio`와 `/result`가 새로고침될 때 크래시가 납니다.
- **Mitigation**:
  - 모든 페이지 태스크보다 먼저 타입 하나로 계약을 고정합니다.
  - 페이지 태스크 DoD에 "RouteState import와 null 가드"를 필수로 넣습니다.

### Task 1.1 엔티티 타입과 RouteState 정의
- **Description**: `src/lib/types.ts`에 런타임 코드 없이 타입만 정의합니다.
  - `BucketKey`, `PresetId`, `FixedCost`, `Plan`, `PlanDraft`, `MonthRecord`, `MonthRecordMap`, `Allocation`
  - `IncomeScenario { salary; remaining; saving; yearlySaving }`
  - `SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unknown' }`
  - `SetupErrors` (필드별 에러 문자열: `salary?`, `payday?`, `fixedTotal?`)
  - RouteState:
    ```ts
    export type RouteState = {
      "/": undefined;
      "/setup": undefined;
      "/ratio": { draft: PlanDraft } | undefined;
      "/result": { justSaved: boolean } | undefined;
      "/history": undefined;
    };
    ```
- **DoD**:
  - `tsc --noEmit`가 통과합니다.
  - 파일 안에 `export const`, `function`, `class`가 0건입니다(타입과 interface만 있음).
  - `RouteState["/ratio"]`와 `RouteState["/result"]`가 `undefined`를 포함하는 union입니다.
- **Covers**: [F1-AC4, F1-AC7, F3-AC6, F4-AC4] (타입 계약 부분)
- **Files**: `src/lib/types.ts`
- **Depends on**: none

---

## Epic 2. Data Layer

**Risk**
- **Complexity**: Medium
- **Risk factors**:
  - 1,000원 내림과 끝전 처리가 틀리면 모든 화면 금액이 틀어집니다.
  - D-day를 UTC로 계산하면 자정 전후로 하루가 어긋나고, 말일 처리도 틀리기 쉽습니다.
  - `QuotaExceededError`나 JSON 파싱 예외가 화면까지 전파되면 크래시합니다.
  - 36개월 정리를 빠뜨리면 기록이 계속 늘어납니다(현실적으로 5MB에는 닿지 않음).
- **Mitigation**:
  - 순수 함수(계산·날짜)를 저장소와 분리해 태스크 단위로 단위 테스트로 고정합니다.
  - storage는 절대 throw하지 않고 `SaveResult`만 반환하게 해서 UI 태스크 전에 계약을 확정합니다.
  - 상태 관리(2.7)는 이 함수들만 조합하므로 가장 마지막에 둡니다.

### Task 2.1 상수와 포맷·입력 헬퍼
- **Description**: 다른 모듈이 공통으로 쓰는 상수와 헬퍼를 만듭니다.
  - `src/lib/constants.ts`
    - 칸 순서와 라벨: `BUCKET_ORDER = ['living','saving','emergency','leisure']`, `BUCKET_LABEL`(생활비/저축/비상금/여가)
    - 프리셋: `PRESETS`(basic_5311 50/30/10/10, saving_4411 40/40/10/10, living_6211 60/20/10/10, custom 라벨 "직접 조정")
    - 저장 키: `STORAGE_KEYS = { plan: 'psp.plan.v1', records: 'psp.records.v1' }`
    - 한도: `LIMITS`(salary 100,000~100,000,000, fixedCost 최대 20개, 금액 1~100,000,000, 이름 1~20자, 기록 36개월)
    - 토스트 문구: `MSG.quota = "저장 공간이 부족해 저장하지 못했어요"`, `MSG.planLoadFail = "저장된 계획을 불러오지 못했어요"`, `MSG.saved = "계획을 저장했어요"`
  - `src/lib/format.ts`
    - `formatWon(n)`: `toLocaleString('ko-KR') + '원'`
    - `formatComma(n)`
    - `parseDigits(str)`: 숫자 외 문자(`-`, `.`, `,` 포함)를 제거하고, 빈 값이면 `null`
    - `clampRatio(n)`: 0~100
    - `genId()`: `Date.now().toString(36)+Math.random().toString(36).slice(2,6)`, `crypto.randomUUID`를 쓰지 않음
- **DoD**:
  - `formatWon(2300000) === "2,300,000원"`
  - `parseDigits("-1.5")`는 `15`를 반환합니다. `-`와 `.`를 무시하고 남은 숫자로 만듭니다.
  - `parseDigits("")`는 `null`, `clampRatio(120)`은 `100`입니다.
  - `genId()`를 1,000회 호출해 중복이 0건입니다.
  - 위 항목이 `src/lib/__tests__/format.test.ts`에서 통과합니다.
- **Covers**: [F3-AC5 (헬퍼), F7-AC7 (randomUUID 폴백)]
- **Files**: `src/lib/constants.ts`, `src/lib/format.ts`, `src/lib/__tests__/format.test.ts`, (필요 시) `package.json`, `vitest.config.ts`
- **Depends on**: Task 1.1

### Task 2.2 배분·이행률·소득 구간 계산 함수
- **Description**: `src/lib/calc.ts`에 순수 함수를 만듭니다.
  - `calcAllocation(plan: Pick<Plan,'salary'|'fixedCosts'|'ratios'>): Allocation`
    - saving, emergency, leisure는 `Math.floor(remaining*r/100/1000)*1000`입니다.
    - living은 나머지 금액입니다.
  - `calcRate(checked, total)`: `total===0`이면 0, 그 외에는 `Math.round(checked/total*100)`입니다.
  - `activeBuckets(allocation)`: 배분액이 0보다 큰 BucketKey를 BUCKET_ORDER 순서로 반환합니다.
  - `buildIncomeScenarios(plan)`
    - 구간은 `[s-1e6, s-5e5, s, s+5e5, s+1e6]`입니다.
    - `salary < 100000`이거나 `remaining ≤ 0`인 구간은 제외합니다.
    - 각 구간은 `{salary, remaining, saving, yearlySaving: saving*12}`입니다.
  - `sumRatios(ratios)`
  - `matchPreset(ratios): PresetId`: 일치하는 프리셋이 없으면 `'custom'`을 반환합니다.
- **DoD**: `src/lib/__tests__/calc.test.ts`에서 아래가 통과합니다.
  - F1-AC1 입력의 결과가 `{fixedTotal:700000, remaining:2300000, buckets:{living:1150000, saving:690000, emergency:230000, leisure:230000}}`입니다.
  - F1-AC2 입력의 결과가 `{saving:703000, emergency:234000, leisure:234000, living:1174670}`이고, 네 값의 합은 2345670입니다.
  - `calcRate(3,4)===75`
  - salary 3,000,000과 고정비 700,000이면 구간 5개가 나오고, saving은 `[390000,540000,690000,840000,990000]`, 첫 구간 yearlySaving은 4680000입니다.
  - salary 1,200,000과 고정비 600,000이면 구간 salary가 `[700000,1200000,1700000,2200000]`(4개)입니다.
  - ratios 60/40/0/0이면 `activeBuckets`가 `['living','saving']`입니다.
- **Covers**: [F1-AC1, F1-AC2, F1-AC5 (calcRate), F4-AC2 (계산), F4-AC6 (계산), F5-AC6 (계산)]
- **Files**: `src/lib/calc.ts`, `src/lib/__tests__/calc.test.ts`
- **Depends on**: Task 2.1

### Task 2.3 날짜·D-day 함수
- **Description**: `src/lib/date.ts`에 기기 로컬 시간 기준 날짜 함수를 만듭니다.
  - `lastDayOfMonth(y, m)`
  - `getNextPayday(payday, today)`: 이번 달의 `min(payday, 말일)`이 오늘 이후(오늘 포함)면 그 날짜를, 아니면 다음 달의 `min(payday, 다음 달 말일)`을 반환합니다.
  - `getDday(payday, today)`: 두 날짜를 `new Date(y,m,d)` 자정으로 맞춘 뒤 `Math.round(diff/86400000)`로 계산합니다.
  - `formatDday(n)`: 0이면 `"D-DAY"`, 그 외에는 `"D-n"`입니다.
  - `toMonthKey(date)`는 `"YYYY-MM"`을 반환합니다.
  - `monthRange(fromKey, toKey)`는 오름차순 배열을 반환합니다.
  - `formatMonthLabel("2026-09")`는 `"2026년 9월"`을 반환합니다.
- **DoD**:
  - `today = new Date(2026,8,23)`일 때 `getDday(25)=2`, `getDday(23)=0`, `getDday(20)=27`, `getDday(31)=7`입니다.
  - `monthRange('2026-07','2026-09')`는 `['2026-07','2026-08','2026-09']`입니다.
  - 연도를 넘는 경우에도 동작합니다: `monthRange('2025-12','2026-01')`의 길이는 2입니다.
  - `Array.prototype.at`을 쓰지 않습니다.
  - 위 항목이 `src/lib/__tests__/date.test.ts`에서 통과합니다.
- **Covers**: [F1-AC3, F5-AC1 (계산)]
- **Files**: `src/lib/date.ts`, `src/lib/__tests__/date.test.ts`
- **Depends on**: Task 1.1

### Task 2.4 localStorage 저장소
- **Description**: `src/lib/storage.ts`를 만듭니다. 템플릿 localStorage helper를 내부에서 써도 되지만, 예외 처리는 이 모듈이 맡습니다.
  - `loadPlan(): { plan: Plan | null; corrupted: boolean }`
    - 키가 없으면 `{plan:null, corrupted:false}`입니다.
    - JSON 파싱에 실패하거나 필수 필드가 없으면 `{plan:null, corrupted:true}`입니다.
    - 공개용으로 `loadPlanOrNull(): Plan | null`을 추가로 export합니다. AC의 `loadPlan()` 기대값이 null이므로 `loadPlan`은 Plan | null을 반환하고, `isPlanCorrupted()`를 별도 함수로 둡니다. 둘 중 하나로 통일하고, 테스트는 `loadPlan()`이 `null`을 반환하는지 확인합니다.
  - `savePlan(plan): SaveResult`: `QuotaExceededError`(name 또는 code 22/1014)를 잡아 `{ok:false, reason:'quota'}`를 반환합니다.
  - `loadRecords(): MonthRecordMap`: 파싱에 실패하거나 객체가 아니면(배열 포함) `{}`입니다.
  - `saveRecords(map): SaveResult`: 키를 정렬해 최신 36개만 남기고 저장합니다.
- **DoD**: `src/lib/__tests__/storage.test.ts`에서 아래가 통과합니다.
  - `savePlan(p)` 뒤 `JSON.parse(localStorage['psp.plan.v1'])`가 p와 deepEqual이고, `loadPlan()`도 p와 deepEqual입니다.
  - `"{broken"`이면 `loadPlan()`은 `null`을 반환하고 throw하지 않습니다.
  - records에 `"[bad"`가 들어 있으면 `loadRecords()`는 `{}`입니다.
  - `setItem`이 `DOMException('','QuotaExceededError')`를 던지게 mock하면 `savePlan`은 `{ok:false, reason:'quota'}`를 반환하고 throw하지 않습니다.
  - 37개월 map을 저장하면 저장된 키가 36개이고, 가장 오래된 키는 없습니다.
- **Covers**: [F1-AC4, F1-AC6, F1-AC7 (반환값), F1-AC8]
- **Files**: `src/lib/storage.ts`, `src/lib/__tests__/storage.test.ts`
- **Depends on**: Task 2.1

### Task 2.5 월 기록 로직 (빈 달 채우기, 체크 토글)
- **Description**: `src/lib/records.ts`에 순수 함수를 만듭니다. 저장은 하지 않습니다.
  - `ensureMonthRecords(plan, today, existing: MonthRecordMap): { map; changed: boolean }`
    - `createdAt` 달부터 이번 달까지 없는 달을 `{checked:[], total: activeBuckets.length, rate:0, updatedAt}`로 채웁니다.
    - 이번 달 레코드는 현재 plan 기준으로 `total`을 다시 계산하고, 0원이 된 칸은 `checked`에서 제거한 뒤 rate를 다시 계산합니다(Open Question 3의 SPEC 결정).
    - 과거 달은 건드리지 않습니다.
  - `toggleTransfer(map, monthKey, bucket, on, total): MonthRecordMap`: 새 객체를 반환합니다. checked는 BUCKET_ORDER 순서로 정렬합니다.
  - `trendStats(map, today)`: 최근 6개월(이번 달 포함)을 `{points:number[], avg:number, fullCount:number}`로 반환합니다. 기록이 없는 달은 제외합니다.
- **DoD**: `src/lib/__tests__/records.test.ts`에서 아래가 통과합니다.
  - createdAt 2026-07-10, today 2026-09-23, 기록 `{}`이면 3개월이 모두 `{checked:[], total:4, rate:0}`입니다.
  - 기록이 `2026-09`만 있으면 `2026-07`과 `2026-08`이 추가되고 `2026-09`의 checked는 보존됩니다.
  - 빈 달에서 saving을 켜면 `{checked:['saving'], total:4, rate:25}`입니다.
  - 3개 체크 상태에서 1개를 더 켜면 rate는 100입니다.
  - total 2(60/40/0/0)에서 둘 다 켜면 `{total:2, rate:100}`입니다.
  - rates `[50,75,100,100,75,100]`이면 `{avg:83, fullCount:3, points.length:6}`입니다.
- **Covers**: [F1-AC5, F5-AC2 (로직), F5-AC3 (로직), F5-AC6 (로직), F6-AC2 (계산), F6-AC3 (로직)]
- **Files**: `src/lib/records.ts`, `src/lib/__tests__/records.test.ts`
- **Depends on**: Task 2.2, Task 2.3

### Task 2.6 setup 입력 검증 함수
- **Description**: `src/lib/validation.ts`에 검증 함수를 만듭니다.
  - `validateSetup({salary: number|null, payday: number|null, fixedCosts}): SetupErrors`
    - 월급이 비었으면 "월급을 입력해주세요"
    - 10만원 미만이면 "월급은 10만원 이상 입력해주세요"
    - 1억원 초과면 "월급은 1억원 이하로 입력해주세요"
    - 월급날이 1~31 밖이면 "월급날은 1일부터 31일 사이로 입력해주세요"
    - 고정비 합계가 월급 이상이면 "고정비 합계가 월급보다 크거나 같아요"
  - `validateFixedCostInput(name, amount, count)`: `{name?, amount?, limit?}`를 반환합니다.
    - 이름은 trim한 뒤 비었으면 "항목 이름을 입력해주세요"
    - 금액이 비었거나 0이면 "금액을 입력해주세요"
    - 이미 20개면 limit "고정비는 최대 20개까지 추가할 수 있어요"
- **DoD**:
  - 위 문구가 모두 각 입력에 대해 정확히 반환됩니다.
  - 정상 입력(3,000,000, 25, 700,000)이면 빈 객체를 반환합니다.
  - 위 항목이 `src/lib/__tests__/validation.test.ts`에서 통과합니다.
- **Covers**: [F2-AC3 (로직), F2-AC4 (로직), F2-AC5 (로직)]
- **Files**: `src/lib/validation.ts`, `src/lib/__tests__/validation.test.ts`
- **Depends on**: Task 2.1

### Task 2.7 상태 관리 (PlanStore Context)
- **Description**: `src/lib/PlanStore.tsx`에 `PlanProvider`와 `usePlanStore()`를 만들고 `src/main.tsx`의 App을 Provider로 감쌉니다.
  - 상태: `plan: Plan | null`, `planLoadFailed: boolean`, `records: MonthRecordMap`
  - 액션
    - `commitPlan(input: Omit<Plan,'version'|'createdAt'|'updatedAt'>): SaveResult`
      - 기존 plan이 있으면 createdAt을 유지하고, 없으면 새로 만듭니다.
      - 성공하면 state를 갱신하고, 이어서 ensureMonthRecords를 실행해 기록도 저장합니다.
    - `syncRecords(today)`: ensure를 실행하고 changed이면 saveRecords를 호출합니다.
    - `setTransfer(bucket, on): SaveResult`
      - toggleTransfer 뒤 saveRecords를 호출합니다.
      - 실패하면 state를 바꾸지 않습니다(롤백).
    - `consumeLoadError(): boolean`: 손상 토스트는 1회만 띄우도록 ref로 한 번만 true를 반환합니다.
- **DoD**: `src/lib/__tests__/PlanStore.test.tsx`에서 renderHook으로 아래를 검증합니다.
  - 손상된 plan이면 `plan===null`, `planLoadFailed===true`이고, `consumeLoadError()`가 두 번째 호출에서 false를 반환합니다.
  - saveRecords가 quota를 반환하도록 mock하면 `setTransfer`는 `{ok:false}`를 반환하고 records state가 변하지 않습니다.
  - commitPlan 성공 뒤 `localStorage['psp.plan.v1']`에 값이 있고 `plan.version===1`입니다.
  - 앱이 빌드됩니다.
- **Covers**: [F1-AC7 (호출측 계약), F5-AC7 (롤백 로직), F5-AC8 (손상 감지), F6-AC7 (손상 기록 재생성)]
- **Files**: `src/lib/PlanStore.tsx`, `src/main.tsx`, `src/lib/__tests__/PlanStore.test.tsx`
- **Depends on**: Task 2.4, Task 2.5

---

## Epic 3. UI Pages

**Risk**
- **Complexity**: Medium~High(setup, result)
- **Risk factors**:
  - `location.state`를 null 확인 없이 구조분해하면 새로고침할 때 크래시합니다.
  - 리워드 게이트가 무료 층까지 감싸면 무료 층이 가려지고 검수에서 반려됩니다.
  - TDS에 인라인 여백을 덮어쓰면 검수에서 반려됩니다.
  - 숫자 필드에서 콤마를 처리하다 커서가 튈 수 있습니다.
  - Switch 롤백이 누락될 수 있습니다.
- **Mitigation**:
  - 페이지 1개당 태스크 1개로 나눕니다.
  - 잠금 층은 별도 컴포넌트 태스크로 분리해 `<TossRewardAd>` 자식 경계를 코드 구조로 강제합니다.
  - 모든 계산과 검증은 Epic 2에서 테스트를 끝냈으므로, 페이지는 조립과 렌더만 합니다.
  - state를 받는 화면(/ratio, /result)에는 "state 없이 직접 진입" 테스트를 DoD에 필수로 넣습니다.

**공통 DoD (모든 페이지 태스크)**
- `ScreenScaffold`로 감싸고, 1차 액션은 `SubmitFooter` 안에 둡니다.
- 여백은 `Spacing size={n}`만 씁니다.
- 파일에 `style={{ padding`나 `margin`이 0건이고, HEX가 0건입니다.
- 테스트는 `MemoryRouter`와 `PlanProvider`로 감싸서 렌더합니다.

### Task 3.1 고정비 추가 BottomSheet 컴포넌트
- **Description**: `src/components/FixedCostSheet.tsx`를 만듭니다. props는 `{ open, count, onClose, onAdd(cost: FixedCost), onLimit() }`입니다.
  - TDS `BottomSheet` 안에 TextField 2개와 `Button` "추가"를 둡니다.
    - 이름 필드
    - 금액 필드: `inputMode="numeric"`, 콤마 표시
  - 금액 필드에서 Enter를 누르면 추가를 실행합니다.
  - 검증에는 `validateFixedCostInput`을 씁니다.
  - 이미 20개면 `onLimit()`만 호출하고 시트는 추가하지 않습니다.
- **DoD**: `src/components/__tests__/FixedCostSheet.test.tsx`에서 아래가 통과합니다.
  - 이름이 빈 채로 추가하면 "항목 이름을 입력해주세요"가 표시되고 onAdd는 0회 호출됩니다.
  - 금액이 0이면 "금액을 입력해주세요"가 표시됩니다.
  - count=20이면 onLimit이 1회 호출됩니다.
  - 금액 필드에서 Enter를 누르면 onAdd가 `{name:'월세', amount:500000, id: string}`로 호출됩니다.
  - 금액 input의 `inputmode` 속성이 `numeric`입니다.
- **Covers**: [F2-AC5, F2-AC7 (금액 필드)]
- **Files**: `src/components/FixedCostSheet.tsx`, `src/components/__tests__/FixedCostSheet.test.tsx`
- **Depends on**: Task 2.6

### Task 3.2 SetupPage (`/setup`)
- **Description**: `src/pages/SetupPage.tsx`를 만듭니다.
  - `Top` "월급과 고정비를 알려주세요"
  - 월급 TextField: numeric, 콤마 포맷, 보조문구는 `Math.floor(salary/10000)+"만원"`
  - 월급날 TextField: numeric, 기본값 25
  - 고정비 `ListRow` 목록: 각 행에 삭제 `Button size="small" variant="weak"`
  - 고정비가 0개면 `data-testid="fixed-empty"` Paragraph.Text를 보여줍니다.
  - "고정비 추가" `Button variant="weak" display="block"`: FixedCostSheet를 엽니다. 한도에 걸리면 Toast를 띄웁니다.
  - `data-testid="remaining-preview"`: "쪼갤 수 있는 돈 {formatWon}"
  - TextField 포커스 시 `scrollIntoView({block:'center'})`
  - SubmitFooter "다음"
    - `validateSetup`을 통과하면 `logClick('setup_next')`를 호출하고 `navigate('/ratio', { state: { draft } satisfies RouteState["/ratio"] })`로 이동합니다.
    - 실패하면 해당 필드에 `hasError`와 문구를 표시합니다.
  - 프리필: `usePlanStore().plan`이 있으면 salary, payday, fixedCosts를 채웁니다.
  - Incoming state는 쓰지 않습니다.
- **DoD**: `src/pages/__tests__/SetupPage.test.tsx`에서 아래가 통과합니다.
  - 3,000,000, 25, 고정비 3개를 입력하고 "다음"을 누르면 mock navigate가 `('/ratio', {state:{draft:{salary:3000000, payday:25, fixedCosts: length 3}}})`로 호출됩니다.
  - 같은 입력에서 remaining-preview 텍스트가 "쪼갤 수 있는 돈 2,300,000원"입니다.
  - 월급이 빈 값, 50000, 150000000일 때 각 문구가 표시되고 navigate는 0회 호출됩니다.
  - 월급 2,000,000에 고정비 2,000,000이면 "고정비 합계가 월급보다 크거나 같아요"가 표시되고 navigate는 0회 호출됩니다.
  - 월급날이 0이나 32이면 월급날 문구가 표시됩니다.
  - 20개 상태에서 추가하면 Toast "고정비는 최대 20개까지 추가할 수 있어요"가 표시됩니다.
  - plan이 없으면 fixed-empty에 "아직 고정비가 없어요"가 포함됩니다.
  - plan `{salary:3000000,payday:25}`를 미리 저장하면 필드 값이 "3,000,000"과 "25"입니다.
  - 숫자 필드 3개가 `inputmode="numeric"`입니다.
  - 삭제 버튼과 추가 버튼에 `min-height` 44px 이상이 보장됩니다. TDS 기본 크기가 44px 미만이면 flex 래퍼의 `min-height:44px`로만 보정합니다.
- **Covers**: [F2-AC1, F2-AC2, F2-AC3, F2-AC4, F2-AC5, F2-AC6, F2-AC7]
- **Files**: `src/pages/SetupPage.tsx`, `src/pages/__tests__/SetupPage.test.tsx`
- **Depends on**: Task 2.7, Task 3.1

### Task 3.3 RatioPage (`/ratio`)
- **Description**: `src/pages/RatioPage.tsx`를 만듭니다.
  - Incoming 처리
    ```ts
    const state = (useLocation().state as RouteState["/ratio"]) ?? null;
    const base = state?.draft ?? (plan ? {salary, fixedCosts, payday} : null);
    if (!base) return <Navigate to="/setup" replace />;
    ```
  - 초기 비율: 저장된 plan이 있으면 그 presetId와 ratios를, 없으면 basic_5311(50/30/10/10)을 씁니다.
  - `Chip` 4개: 프리셋을 누르면 ratios를 채웁니다.
  - 필드를 직접 수정하면 presetId를 `matchPreset` 결과로 바꿉니다. 예를 들어 45/35/10/10이면 custom입니다.
  - `ListRow` 4개: 라벨, `TextField`(numeric, 접미사 %, `parseDigits` 뒤 `clampRatio`), `Paragraph.Text` 금액(calcAllocation)
  - 포커스 시 해당 행에 `scrollIntoView({block:'center'})`
  - `data-testid="ratio-sum"`: "합계 N%"
  - 합계가 100이 아니면 Badge를 경고색으로 바꾸고, 에러 "비율 합계가 100%가 되어야 해요 (현재 N%)"를 표시하며, 저장 버튼을 disabled로 둡니다.
  - SubmitFooter "이 비율로 저장"
    - `logClick('plan_save')` 뒤 `commitPlan`을 호출합니다.
    - 성공하면 `navigate('/result', { state: { justSaved: true } })`로 이동합니다.
    - quota가 반환되면 Toast `MSG.quota`를 띄우고 이동하지 않습니다.
- **DoD**: `src/pages/__tests__/RatioPage.test.tsx`에서 아래가 통과합니다.
  - draft(3,000,000, 700,000)에서 "저축 집중" Chip을 누르면 필드가 40/40/10/10이고, 금액이 920,000원, 920,000원, 230,000원, 230,000원입니다.
  - 기본에서 저축을 35, 생활비를 45로 바꾸면 "직접 조정" Chip이 선택되고, 저장하면 `psp.plan.v1`의 presetId는 custom, ratios는 45/35/10/10이며 navigate('/result')가 호출됩니다.
  - plan이 없을 때 draft로 진입하면 "기본 5:3:1:1"이 선택되고 50/30/10/10입니다.
  - plan이 saving_4411이면 해당 Chip이 선택됩니다.
  - 50/30/10/5를 입력하면 ratio-sum이 "합계 95%"이고, 에러 문구가 표시되며, 버튼이 disabled입니다.
  - 저축에 "120"을 입력하면 값이 "100"이고, "-5." 입력은 "5"가 됩니다.
  - **state 없이 직접 진입(state=null, plan 없음)해도 크래시하지 않고 `/setup`으로 replace 이동합니다.**
  - state=null이고 plan이 있으면 plan 값으로 정상 렌더합니다.
  - savePlan이 quota를 반환하도록 mock하면 Toast 문구가 표시되고 `/result` navigate는 0회입니다.
- **Covers**: [F3-AC1, F3-AC2, F3-AC3, F3-AC4, F3-AC5, F3-AC6, F3-AC7, F1-AC7 (Toast)]
- **Files**: `src/pages/RatioPage.tsx`, `src/pages/__tests__/RatioPage.test.tsx`
- **Depends on**: Task 2.7

### Task 3.4 ResultPage 무료 층·빈 상태·저장 직후 처리 (`/result`)
- **Description**: `src/pages/ResultPage.tsx`를 만듭니다. 잠금 층 자리는 비워 두고 Task 3.5에서 삽입합니다.
  - Incoming: `const state = (useLocation().state as RouteState["/result"]) ?? null;` 이후 `state?.justSaved === true`로만 판단합니다.
  - plan이 null이거나 `remaining ≤ 0`이면 `data-testid="result-empty"`를 렌더합니다.
    - `Asset.ContentIcon`, "아직 계획이 없어요"
    - `Button` "계획 만들기" → `navigate('/setup')`
  - 무료 층 `data-testid="free-tier"`
    - `Top` "월급을 이렇게 나눠요"
    - `SummaryHero`(data-testid="summary-hero", remaining, 라벨 "쪼갤 수 있는 돈")
    - `Card` ×4(data-testid="bucket-card"): Paragraph.Text t3 금액, Badge "50%", MiniBar
    - 고정비 합계 `ListRow`
    - 마운트 시 `logImpression('allocation_result')`
  - `justSaved`이면 Toast "계획을 저장했어요"를 띄우고 `requestReviewOnce()`를 호출합니다. useEffect와 ref 가드로 1회만 실행합니다.
  - SubmitFooter "홈으로" → `navigate('/', {replace:true})`
- **DoD**: `src/pages/__tests__/ResultPage.test.tsx`에서 아래가 통과합니다.
  - plan(3,000,000, 700,000, 50/30/10/10)이면 free-tier 안에 "2,300,000원", "1,150,000원", "690,000원", "230,000원"(2개)이 있습니다.
  - summary-hero가 1개, bucket-card가 4개이고, 각 카드에 "%" Badge가 있습니다.
  - "홈으로"가 SubmitFooter 안에 있습니다.
  - state `{justSaved:true}`이면 Toast 문구가 표시되고 `requestReviewOnce`가 1회 호출됩니다.
  - **state 없이 직접 진입(null)해도 크래시하지 않고 결과를 렌더합니다.** Toast와 리뷰 요청은 0회입니다.
  - plan이 없으면 result-empty에 "아직 계획이 없어요"가 표시되고, "계획 만들기"를 누르면 navigate('/setup')가 호출됩니다.
- **Covers**: [F4-AC1 (무료 층), F4-AC3, F4-AC4, F4-AC5]
- **Files**: `src/pages/ResultPage.tsx`, `src/pages/__tests__/ResultPage.test.tsx`
- **Depends on**: Task 2.7

### Task 3.5 소득 구간 비교(잠금 층)와 Result 광고·공유 연결
- **Description**: 잠금 층 컴포넌트를 만들고 ResultPage 하단에 붙입니다.
  - `src/components/IncomeCompareCard.tsx`
    - `data-testid="locked-tier"` `Card` 안에 `buildIncomeScenarios(plan)` 행을 `ListRow`로 나열합니다.
    - 행 형식: "2,000,000원 → 월 저축 390,000원 / 연 4,680,000원"
    - 각 행에 `MiniBar`(최대 saving 대비)를 둡니다.
  - ResultPage 배치 순서
    1. free-tier
    2. `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}><IncomeCompareCard/></TossRewardAd>`: 게이트 노출 시 `logImpression('income_compare_gate')`
    3. `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID}/>`: `logImpression('result_banner_ad')`
    4. "공유하기" `Button variant="weak" display="block"` → `logClick('result_share')` 후 `shareApp()`
  - free-tier는 TossRewardAd 바깥, 즉 형제 노드여야 합니다.
- **DoD**:
  - slotId가 undefined인 환경(fail-open)에서 locked-tier 행 5개의 텍스트가 F4-AC2 값과 일치합니다.
  - salary 1,200,000과 고정비 600,000이면 행이 4개이고 "200,000원" 행이 없습니다.
  - free-tier 요소의 조상 중에 TossRewardAd 루트가 없습니다. DOM `closest`로 검증합니다.
  - 공유를 누르면 mock 호출 순서가 `logClick('result_share')` → `shareApp`입니다.
  - 위 항목을 ResultPage 테스트에 추가하고 통과합니다.
- **Covers**: [F4-AC1 (게이트 비의존), F4-AC2, F4-AC6, F4-AC7]
- **Files**: `src/components/IncomeCompareCard.tsx`, `src/pages/ResultPage.tsx`, `src/pages/__tests__/ResultPage.test.tsx`
- **Depends on**: Task 3.4, Task 2.2

### Task 3.6 HomePage (`/`)
- **Description**: `src/pages/HomePage.tsx`를 만듭니다.
  - 마운트 시 처리
    - `syncRecords(today)`를 실행합니다.
    - `consumeLoadError()`가 true면 Toast "저장된 계획을 불러오지 못했어요"를 띄웁니다.
  - plan이 없으면 `data-testid="home-empty"`를 렌더합니다.
    - `Asset.ContentIcon`, "월급을 어떻게 나눌지 계획해볼까요?"
    - SubmitFooter "계획 만들기" → `logClick('plan_create_start')` 후 `navigate('/setup')`
  - plan이 있으면 아래를 렌더합니다.
    - `Top` "PaySplitPlan"
    - `SummaryHero`(data-testid="dday-hero", `formatDday(getDday(payday))`, 보조 "매달 N일 월급")
    - `Card` 안에 `data-testid="month-rate"` Paragraph.Text t2 "N%". rate가 100이면 Badge "이번 달 완료"를 붙입니다.
    - activeBuckets마다 `ListRow`(data-testid="transfer-item"): "저축 690,000원" + `Switch`
      - 켜면 `logClick('transfer_check')`를 호출합니다.
      - `setTransfer`가 실패하면 Switch를 이전 값으로 되돌리고 Toast `MSG.quota`를 띄웁니다.
    - "배분 결과 보기" → `navigate('/result')`(state 없음)
    - "계획 수정" → `navigate('/setup')`
  - Incoming state는 쓰지 않습니다.
- **DoD**: `src/pages/__tests__/HomePage.test.tsx`에서 today를 2026-09-23으로 고정하고 아래가 통과합니다.
  - payday가 25, 23, 31이면 dday-hero가 각각 "D-2", "D-DAY", "D-7"입니다.
  - 저축 Switch를 켜면 `psp.records.v1['2026-09']`가 `{checked:['saving'], total:4, rate:25}`이고 month-rate가 "25%"입니다.
  - 3개 체크 뒤 4번째를 켜면 rate가 100이고 "이번 달 완료" Badge가 있습니다.
  - dday-hero 1개, month-rate 1개, transfer-item 4개가 있습니다.
  - ratios 60/40/0/0이면 transfer-item이 2개이고, 모두 켜면 `{total:2, rate:100}`입니다.
  - saveRecords가 quota를 반환하도록 mock하고 Switch를 켜면 Switch가 unchecked이고 Toast 문구가 표시됩니다.
  - plan이 "{broken"이면 크래시 없이 home-empty가 표시되고, Toast "저장된 계획을 불러오지 못했어요"가 정확히 1회 표시됩니다(StrictMode 이중 effect 포함).
  - plan이 없으면 home-empty 문구가 표시되고, "계획 만들기"를 누르면 navigate('/setup')가 호출됩니다.
- **Covers**: [F5-AC1, F5-AC2, F5-AC3, F5-AC4, F5-AC5, F5-AC6, F5-AC7, F5-AC8]
- **Files**: `src/pages/HomePage.tsx`, `src/pages/__tests__/HomePage.test.tsx`
- **Depends on**: Task 2.7

### Task 3.7 HistoryPage 무료 층과 빈 상태 (`/history`)
- **Description**: `src/pages/HistoryPage.tsx`를 만듭니다.
  - 마운트 시 `syncRecords(today)`를 실행합니다. 손상된 기록이 `{}`로 들어와도 createdAt 달부터 다시 채워집니다.
  - plan이 없으면 `data-testid="history-empty"`를 렌더합니다.
    - `Asset.ContentIcon`, "계획을 만들면 매달 이행률이 여기에 쌓여요"
    - `Button` "계획 만들기" → `navigate('/setup')`
  - 무료 층 `data-testid="free-tier"`
    - `Top` "월별 이행 기록"
    - `SummaryHero`(data-testid="summary-hero", 이번 달 rate, 접미사 "%")
    - 월별 `ListRow`(data-testid="month-row"): 최신순으로 정렬하고, 왼쪽에 `formatMonthLabel`, 오른쪽에 "N%"를 둡니다. rate가 100이면 Badge "완료"를 붙입니다.
    - Switch 같은 편집 컨트롤은 두지 않습니다.
  - 잠금 층 자리는 Task 3.8에서 채웁니다.
  - Incoming state는 쓰지 않습니다.
- **DoD**: `src/pages/__tests__/HistoryPage.test.tsx`에서 아래가 통과합니다.
  - 기록 07:50, 08:100, 09:75이면 hero가 "75%"이고, month-row 텍스트 순서가 "2026년 9월/75%", "2026년 8월/100%/완료", "2026년 7월/50%"입니다.
  - 기록이 2026-09만 있고 createdAt이 07-10이면 8월과 7월 행이 "0%"이고, localStorage에 3개월이 저장됩니다.
  - summary-hero는 1개이고, month-row 개수는 기록 개월 수와 같습니다.
  - `role="switch"`가 0건입니다.
  - plan이 없으면 history-empty 문구가 표시됩니다.
  - records가 "[bad"이고 plan이 있으면 오류 화면 없이 07~09월이 "0%"로 표시됩니다.
- **Covers**: [F6-AC1 (무료 층), F6-AC3, F6-AC4, F6-AC5, F6-AC7]
- **Files**: `src/pages/HistoryPage.tsx`, `src/pages/__tests__/HistoryPage.test.tsx`
- **Depends on**: Task 2.7

### Task 3.8 6개월 추이(잠금 층)와 History 광고 연결
- **Description**: 잠금 층 컴포넌트를 만들고 HistoryPage에 붙입니다.
  - `src/components/TrendCard.tsx`
    - `data-testid="locked-tier"` Card 안에 `trendStats` 결과를 보여줍니다.
    - points가 2개 이상이면 `Sparkline`과 Paragraph.Text "6개월 평균 N%", "100% 달성 N개월"을 보여줍니다.
    - points가 2개 미만이면 "2개월 이상 기록되면 추이를 보여드려요"를 보여줍니다.
  - HistoryPage 배치 순서
    1. free-tier
    2. `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}><TrendCard/></TossRewardAd>`: `logImpression('history_trend_gate')`
    3. `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID}/>`: `logImpression('history_banner_ad')`
- **DoD**:
  - 기록 04~09월이 `[50,75,100,100,75,100]`이면 fail-open 상태에서 locked-tier에 Sparkline 1개, "6개월 평균 83%", "100% 달성 3개월"이 표시됩니다.
  - 기록이 1개월뿐이면 Sparkline이 0개이고 안내 문구가 표시됩니다.
  - free-tier가 TossRewardAd 바깥에 있습니다(`closest`로 검증).
- **Covers**: [F6-AC1 (게이트 비의존), F6-AC2, F6-AC6]
- **Files**: `src/components/TrendCard.tsx`, `src/pages/HistoryPage.tsx`, `src/pages/__tests__/HistoryPage.test.tsx`
- **Depends on**: Task 3.7, Task 2.5

---

## Epic 4. Integration + Polish

**Risk**
- **Complexity**: Medium
- **Risk factors**:
  - 스택 화면에 탭바가 노출되면 검수에서 지적됩니다.
  - env가 undefined인 빌드에서 광고 래퍼가 콘솔 에러를 낼 수 있습니다.
  - 기본 빌드 타겟이 es2017보다 높아 구형 Android WebView에서 문법 오류가 날 수 있습니다.
  - 금지 문자열과 HEX가 섞여 들어올 수 있습니다.
- **Mitigation**:
  - 라우팅은 페이지가 모두 테스트된 뒤 한 번에 연결합니다.
  - 검수 규칙은 grep 스크립트로 자동화해서 이후 변경에도 회귀를 막습니다.
  - 콘솔 에러는 실제 빌드 산출물로 전 경로를 순회해 검증합니다.

### Task 4.1 라우터, 탭바, redirect 연결
- **Description**: `src/App.tsx`에 라우트를 연결합니다.
  - 라우트: `/` Home, `/setup` Setup, `/ratio` Ratio, `/result` Result, `/history` History
  - 그 밖의 경로는 `<Navigate to="/" replace />`로 보냅니다.
  - 각 페이지는 `PageShell`로 감쌉니다.
  - `FloatingTabBar`(홈 `/`, 기록 `/history`)는 pathname이 `/` 또는 `/history`일 때만 렌더합니다.
  - 탭 전환은 `navigate`로만 합니다.
- **DoD**: `src/__tests__/App.test.tsx`에서 아래가 통과합니다.
  - `/`에서 탭 "기록"을 누르면 history 화면(Top "월별 이행 기록" 또는 history-empty)이 렌더됩니다.
  - `/setup`, `/ratio`, `/result`에서는 탭바 요소가 0개입니다.
  - `/unknown`으로 진입하면 location이 `/`입니다.
  - `vite build`가 성공합니다.
- **Covers**: [F7-AC1, F7-AC3]
- **Files**: `src/App.tsx`, `src/__tests__/App.test.tsx`
- **Depends on**: Task 3.2, Task 3.3, Task 3.5, Task 3.6, Task 3.8

### Task 4.2 광고 env 연결 검증 (fail-open)
- **Description**: 광고 env 연결을 점검하고 테스트로 고정합니다.
  - `AdSlot`과 `TossRewardAd`가 정확히 `import.meta.env.VITE_TOSS_AD_GROUP_ID`와 `VITE_TOSS_AD_SLOT_ID`를 받는지 확인합니다. 하드코딩된 ID는 0건이어야 합니다.
  - `.env.example`에 두 키를 빈 값으로 기재하고, "빌드 시점 주입이라 값을 바꾸면 재빌드가 필요하다"는 주석을 남깁니다.
  - env undefined 통합 테스트를 추가합니다.
- **DoD**:
  - `grep -rn "adGroupId=" src/pages`의 모든 매치가 `import.meta.env.VITE_TOSS_AD_GROUP_ID`입니다.
  - `slotId=`도 같은 방식으로 확인합니다.
  - `vi.stubEnv`로 두 값을 undefined로 두고 App을 렌더하면 `/result`와 `/history`에서 free-tier가 보입니다(plan 픽스처 포함).
  - 같은 테스트에서 `console.error` spy가 0회입니다.
- **Covers**: [F7-AC2, F4-AC1, F6-AC1]
- **Files**: `.env.example`, `src/__tests__/ads.integration.test.tsx`
- **Depends on**: Task 4.1

### Task 4.3 검수 준수 스크립트와 빌드 타겟
- **Description**: 검수 규칙을 자동 검사로 만들고 빌드 타겟을 맞춥니다.
  - `scripts/check-compliance.mjs`: `src/`를 스캔해 아래가 1건이라도 있으면 exit 1로 끝냅니다.
    - `window.open(`
    - `window.location.href =`
    - "앱을 설치", "다운로드"
    - `gtag`, `amplitude`, `mixpanel`, `firebase/analytics`
    - `.tsx`와 `.css`에서 `/#[0-9a-fA-F]{3,8}\b/` 매치
    - `.at(`, `structuredClone`, `crypto.randomUUID`
  - `package.json`에 `"check:compliance"` 스크립트를 추가합니다.
  - `vite.config.ts`에 `build.target: 'es2017'`을 둡니다.
  - 터치 영역을 점검합니다. Button, Switch, Chip, ListRow 중 TDS 기본 높이가 44px 미만인 곳이 있으면 flex 래퍼의 `min-height: 44px` 클래스로만 보정합니다(padding 덮어쓰기 금지).
- **DoD**:
  - `npm run check:compliance`가 exit 0입니다.
  - 일부러 `#fff`를 넣으면 exit 1이 되는지 확인한 뒤 되돌립니다.
  - `vite build` 산출 JS에 `?.`와 `??` 문법이 0건입니다(es2017로 트랜스파일됨).
  - 각 페이지 테스트에서 주요 인터랙티브 요소의 계산된 `min-height`(또는 TDS 크기 prop) 기준이 44px 이상입니다.
- **Covers**: [F7-AC4, F7-AC5, F7-AC7, F2-AC7 (터치 영역)]
- **Files**: `scripts/check-compliance.mjs`, `package.json`, `vite.config.ts`, (필요 시) `src/styles/layout.css`
- **Depends on**: Task 4.1

### Task 4.4 전체 흐름 스모크 테스트 (콘솔 에러 0)
- **Description**: `vite build`와 `vite preview` 결과에 대해 스모크 테스트를 돌립니다. Playwright가 없으면 RTL 통합 테스트로 대체합니다.
  - 순서: 홈(빈 상태) → "계획 만들기" → setup 입력 → ratio 저장 → result → 홈으로 → 기록 탭(history)
  - 순회 중 `console.error`와 `pageerror`를 수집합니다.
  - `/result`와 `/ratio`는 새로고침(직접 진입)도 한 번씩 수행합니다.
- **DoD**:
  - 순회를 마친 뒤 `console.error`가 0회입니다.
  - `/ratio`를 새로고침하면 plan이 있으니 정상 렌더되고, `/result`를 새로고침해도 크래시가 없고 Toast도 뜨지 않습니다.
  - 최종 history 화면에 이번 달 month-row가 1개 이상 있습니다.
- **Covers**: [F7-AC6]
- **Files**: `e2e/smoke.spec.ts` (또는 `src/__tests__/smoke.integration.test.tsx`)
- **Depends on**: Task 4.2, Task 4.3

---

## AC Coverage

- **SPEC의 AC 수**: 51개(F1 8, F2 7, F3 7, F4 7, F5 8, F6 7, F7 7)
- **태스크로 커버된 AC**: 51개
  - F1-AC1: 2.2
  - F1-AC2: 2.2
  - F1-AC3: 2.3
  - F1-AC4: 2.4
  - F1-AC5: 2.2, 2.5
  - F1-AC6: 2.4
  - F1-AC7: 2.4, 2.7, 3.3
  - F1-AC8: 2.4
  - F2-AC1: 3.2
  - F2-AC2: 3.2
  - F2-AC3: 2.6, 3.2
  - F2-AC4: 2.6, 3.2
  - F2-AC5: 2.6, 3.1, 3.2
  - F2-AC6: 3.2
  - F2-AC7: 3.1, 3.2, 4.3
  - F3-AC1~AC7: 3.3 (AC5는 2.1도 해당)
  - F4-AC1: 3.4, 3.5, 4.2
  - F4-AC2: 2.2, 3.5
  - F4-AC3: 3.4
  - F4-AC4: 3.4
  - F4-AC5: 3.4
  - F4-AC6: 2.2, 3.5
  - F4-AC7: 3.5
  - F5-AC1: 2.3, 3.6
  - F5-AC2: 2.5, 3.6
  - F5-AC3: 2.5, 3.6
  - F5-AC4: 3.6
  - F5-AC5: 3.6
  - F5-AC6: 2.2, 2.5, 3.6
  - F5-AC7: 2.7, 3.6
  - F5-AC8: 2.7, 3.6
  - F6-AC1: 3.7, 3.8, 4.2
  - F6-AC2: 2.5, 3.8
  - F6-AC3: 2.5, 3.7
  - F6-AC4: 3.7
  - F6-AC5: 3.7
  - F6-AC6: 3.8
  - F6-AC7: 2.7, 3.7
  - F7-AC1: 4.1
  - F7-AC2: 4.2
  - F7-AC3: 4.1
  - F7-AC4: 4.3
  - F7-AC5: 4.3
  - F7-AC6: 4.4
  - F7-AC7: 2.1, 4.3
- **커버되지 않은 AC**: 0개

**state를 받는 화면의 직접 진입 기준 (필수 추가 AC)**
- `/ratio`: Task 3.3 DoD. state와 plan이 모두 없으면 `/setup`으로 replace 이동하고, 크래시가 없어야 합니다.
- `/result`: Task 3.4 DoD. state가 null이어도 정상 렌더하고, plan이 없으면 빈 상태를 보여주며, 크래시가 없어야 합니다.
- 새로고침 상황은 Task 4.4에서 실제 빌드로 다시 검증합니다.