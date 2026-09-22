# SPEC — PaySplitPlan

## Common Principles

- **플랫폼**: 앱인토스 미니앱. Vite, React, TypeScript, `@toss/tds-mobile`, `react-router-dom`. 서버는 없고 모든 데이터는 localStorage에 저장한다. 외부 API도 없다.
- **이미 만들어진 것(다시 설계하지 않음)**: Toss 세션, TDS 설정, `AdSlot`, `TossRewardAd`, `TossPurchase`, localStorage helper, `FloatingTabBar`, `ScreenScaffold`, `PageShell`, `SubmitFooter`, `SummaryHero`, `Sparkline`, `MiniBar`, `logClick`, `logImpression`, `shareApp`, `requestReviewOnce`.
- **UI 규칙**:
  - TDS 컴포넌트(ListRow, Button, TextField, Paragraph.Text, Chip, Switch, AlertDialog, BottomSheet, Toast, Top, Badge)를 조합해서만 화면을 만든다.
  - 간격은 `Spacing size={n}`으로만 조절한다.
  - 커스텀 CSS는 flex·grid 배치에만 쓴다.
  - HEX 색상은 금지하고 `var(--tds-color-*)`만 쓴다.
- **화면 뼈대**: 모든 화면은 `ScreenScaffold`로 감싼다. 1차 액션은 `SubmitFooter`(하단 고정)에 둔다. 핵심 수치는 Card와 강조 타이포(t2~t3)로 보여준다.
- **터치 영역**: 누를 수 있는 모든 요소는 44×44px 이상이다.
- **금액 표기**: 모든 금액은 정수(원)이다. 화면에는 `toLocaleString('ko-KR') + "원"`으로 표시한다. 예: `2,300,000원`
- **날짜 기준**: 기기 로컬 시간을 쓴다. 월 키 형식은 `"YYYY-MM"`이다.
- **스크롤**: 목록은 최대 20개(고정비) 또는 36개(월 기록)라서 가상 스크롤을 쓰지 않는다. 페이지 전체 자연 스크롤을 쓴다.
- **탭 네비게이션**: `FloatingTabBar`의 탭은 2개다. 홈 `/`, 기록 `/history`. `/setup`, `/ratio`, `/result`는 스택 화면이라 탭바를 숨긴다.
- **수익화**: 리워드 광고 게이트(`TossRewardAd`)와 배너(`AdSlot`)만 쓴다.
  - 배분 결과(무료 층)와 월별 이행률 목록(무료 층)은 광고와 상관없이 항상 보인다.
  - 슬롯 ID가 없거나, 로드에 실패하거나, 타임아웃이 나면 게이트가 자동으로 열린다(fail-open).
  - IAP, 구독, 프로모션 리워드는 쓰지 않는다.
- **생성형 AI**: 쓰지 않는다. 모든 결과는 정해진 계산식으로 만든다. 그래서 AI 고지 의무가 없다.
- **계측**: 화면 진입·체류 로그는 PageShell이 자동으로 남긴다. 각 화면 정의에는 전환 클릭과 핵심 노출 로그만 적는다.

## Data Models

### 공통 타입

```ts
type BucketKey = 'living' | 'saving' | 'emergency' | 'leisure';
// 표시 라벨: living=생활비, saving=저축, emergency=비상금, leisure=여가
// 표시·계산 순서 고정: ['living','saving','emergency','leisure']

type PresetId = 'basic_5311' | 'saving_4411' | 'living_6211' | 'custom';
```

### RatioPreset — 상수(저장하지 않음)

| id | 라벨 | living | saving | emergency | leisure |
|---|---|---|---|---|---|
| `basic_5311` | 기본 5:3:1:1 | 50 | 30 | 10 | 10 |
| `saving_4411` | 저축 집중 4:4:1:1 | 40 | 40 | 10 | 10 |
| `living_6211` | 여유 생활 6:2:1:1 | 60 | 20 | 10 | 10 |
| `custom` | 직접 조정 | 사용자 입력 | | | |

### FixedCost

```ts
interface FixedCost {
  id: string;      // crypto.randomUUID() 미지원 환경 대비: Date.now().toString(36)+Math.random().toString(36).slice(2,6)
  name: string;    // 1~20자, 앞뒤 공백 제거 후 검사
  amount: number;  // 정수, 1 ≤ amount ≤ 100,000,000
}
```

### Plan — key `psp.plan.v1`

```ts
interface Plan {
  version: 1;
  salary: number;                       // 정수, 100,000 ≤ salary ≤ 100,000,000
  fixedCosts: FixedCost[];              // 0~20개
  payday: number;                       // 1~31 (해당 월에 없는 날이면 그 달 말일로 처리)
  presetId: PresetId;
  ratios: Record<BucketKey, number>;    // 각 0~100 정수, 합계 === 100
  createdAt: string;                    // ISO 8601
  updatedAt: string;                    // ISO 8601
}
```

- 제약: `salary - Σ fixedCosts.amount > 0`
- 크기: 고정비 20개 기준 약 2KB

### PlanDraft — 네비게이션 state 전용(저장하지 않음)

```ts
interface PlanDraft { salary: number; fixedCosts: FixedCost[]; payday: number; }
```

### MonthRecord — key `psp.records.v1`

```ts
interface MonthRecord {
  month: string;          // "YYYY-MM"
  checked: BucketKey[];   // 이체 완료 체크된 항목
  total: number;          // 그 달 체크리스트 항목 수 = 배분액 > 0인 항목 수 (1~4)
  rate: number;           // Math.round(checked.length / total * 100), 0~100 정수
  updatedAt: string;      // ISO 8601
}
type MonthRecordMap = Record<string, MonthRecord>; // key = month
```

- 보관: 최신 36개월만 남기고 저장할 때 오래된 달부터 삭제한다.
- 크기: 36 × 약 160B ≈ 6KB

### Allocation — 계산 결과(저장하지 않음)

```ts
interface Allocation {
  fixedTotal: number;                  // Σ fixedCosts.amount
  remaining: number;                   // salary - fixedTotal
  buckets: Record<BucketKey, number>;  // 합계 === remaining
}
```

- 배분 계산식:
  - saving, emergency, leisure는 각각 `Math.floor(remaining × ratio / 100 / 1000) × 1000`으로 1,000원 단위 내림한다.
  - living은 `remaining - (saving + emergency + leisure)`로, 끝전을 생활비에 몰아준다.
- 전체 저장 용량은 약 10KB로, 5MB 한도 안이다.

## Feature List

### F1. 데이터 저장소와 계산 로직

- **Description**: Plan과 MonthRecord를 localStorage에 읽고 쓰는 저장소 모듈을 만든다. 배분, D-day, 이행률, 소득 구간 시나리오를 계산하는 순수 함수(`calcAllocation`, `getNextPayday`, `getDday`, `calcRate`, `buildIncomeScenarios`, `ensureMonthRecords`)도 만든다. UI는 없고, 이후 모든 기능이 이 모듈을 거친다.
- **Data**: Plan, MonthRecord, Allocation
- **API**: 없음(localStorage)
- **Requirements**:

- AC-1 [U][P0]: Scenario: 배분 계산
  - Given Plan `{ salary: 3000000, fixedCosts: [{name:"월세",amount:500000},{name:"통신비",amount:50000},{name:"보험",amount:150000}], ratios: {living:50,saving:30,emergency:10,leisure:10} }`
  - When `calcAllocation(plan)` 호출
  - Then `{ fixedTotal: 700000, remaining: 2300000, buckets: { living: 1150000, saving: 690000, emergency: 230000, leisure: 230000 } }` 반환
- AC-2 [U][P0]: Scenario: 끝전은 생활비로
  - Given `salary: 2345670`, `fixedCosts: []`, ratios `50/30/10/10`
  - When `calcAllocation` 호출
  - Then `buckets = { saving: 703000, emergency: 234000, leisure: 234000, living: 1174670 }`
  - And 네 값의 합은 `2345670`
- AC-3 [U][P0]: Scenario: 다음 월급날 D-day
  - Given 오늘이 `2026-09-23`일 때
  - When `getDday(25, today)`는 `2`, `getDday(23, today)`는 `0`, `getDday(20, today)`는 `27`(다음 월급날 2026-10-20), `getDday(31, today)`는 `7`(9월 말일 2026-09-30로 처리)을 반환
- AC-4 [E][P0]: Scenario: Plan 저장·조회
  - When `savePlan(plan)` 호출
  - Then `localStorage['psp.plan.v1']`에 JSON이 저장되고, `loadPlan()`이 같은 객체를 반환
- AC-5 [E][P0]: Scenario: 이행률 계산과 빈 달 채우기
  - Given `plan.createdAt = "2026-07-10T00:00:00.000Z"`, 오늘 `2026-09-23`, 기록 없음
  - When `ensureMonthRecords(plan, today)` 호출
  - Then `2026-07`, `2026-08`, `2026-09` 레코드가 `{ checked: [], total: 4, rate: 0 }`으로 생성됨
  - And `calcRate(3, 4) === 75`
- AC-6 [W][P1]: Scenario: 손상된 데이터
  - Given `localStorage['psp.plan.v1'] = "{broken"`
  - When `loadPlan()` 호출
  - Then 예외를 던지지 않고 `null` 반환
  - And `psp.records.v1`이 손상됐을 때 `loadRecords()`는 `{}` 반환
- AC-7 [W][P1]: Scenario: 저장 공간 부족
  - Given `localStorage.setItem`이 `QuotaExceededError`를 던질 때
  - When `savePlan(plan)` 호출
  - Then `{ ok: false, reason: 'quota' }` 반환(예외 전파 없음)
  - And 호출한 화면은 Toast "저장 공간이 부족해 저장하지 못했어요"를 표시
- AC-8 [W][P1]: Scenario: 36개월 초과 기록 정리
  - Given 기록이 37개월 있을 때
  - When `saveRecords(map)` 호출
  - Then 가장 오래된 1개월이 삭제되어 36개만 저장됨

### F2. 월급·고정비 입력 (`/setup`)

- **Description**: 월급, 월급날, 고정비 목록을 입력하는 첫 단계 화면이다. 고정비 합계를 뺀 "쪼갤 수 있는 금액"을 실시간으로 보여준다. 다음 버튼을 누르면 비율 설정 화면으로 넘어간다. 저장된 Plan이 있으면 그 값으로 미리 채운다.
- **Data**: Plan(읽기 전용 프리필), PlanDraft(state 전달)
- **API**: 없음

**Screen `/setup` — 월급 입력**

- **TDS 컴포넌트**
  - `Top`: 제목 "월급과 고정비를 알려주세요"
  - `TextField` ×2
    - 월급: `inputMode="numeric"`, 콤마 포맷, 보조문구 "300만원" 형태
    - 월급날: `inputMode="numeric"`, 기본값 25
  - 고정비 목록: `ListRow` 반복. 각 행 오른쪽에 삭제 `Button size="small" variant="weak"`
  - "고정비 추가": `Button variant="weak" display="block"`
  - 추가 입력: `BottomSheet` 안에 `TextField` 이름·금액과 `Button` "추가"
  - 가용액 미리보기: `Paragraph.Text`
  - `SubmitFooter` 안의 `Button` "다음"
  - 오류 안내: `Toast`
- **상태**
  - 로딩: 동기 localStorage 읽기라 로딩 UI 없음
  - 빈 상태: 고정비 0개면 `ListRow` 자리에 `Paragraph.Text` "아직 고정비가 없어요. 월세·통신비처럼 매달 빠지는 돈을 추가해보세요"
  - 오류: 필드 아래 TextField `hasError`와 에러 문구
- **키보드**
  - TextField 포커스 시 `scrollIntoView({ block: 'center' })`로 필드를 키보드 위로 올린다.
  - BottomSheet 안 금액 필드에서 엔터를 누르면 "추가"를 실행한다.
- **Navigation contract**
  - Incoming: `location.state = null`. 프리필은 `loadPlan()`에서 가져온다.
  - Outgoing: "다음" → `navigate('/ratio', { state: { draft: PlanDraft } })`
- **Instrumentation**: "다음" 버튼 → `logClick('setup_next')`
- **Layout**: `ScreenScaffold` 안에 입력 영역을 두고, 1차 액션은 `SubmitFooter`에 고정한다.

**Requirements**:

- AC-1 [E][P0]: Scenario: 입력 후 다음 단계
  - Given 저장된 Plan이 없을 때
  - When 월급 `3000000`, 월급날 `25`, 고정비 `{월세 500000}`, `{통신비 50000}`, `{보험 150000}` 입력 후 "다음" 탭
  - Then `navigate('/ratio', { state: { draft: { salary: 3000000, payday: 25, fixedCosts: [3개] } } })` 호출
- AC-2 [U][P0]: Scenario: 가용액 실시간 표시
  - Given 월급 `3000000`, 고정비 합계 `700000`일 때
  - Then `data-testid="remaining-preview"`에 "쪼갤 수 있는 돈 2,300,000원" 표시
- AC-3 [W][P1]: Scenario: 월급 범위 검증
  - When 월급 빈 값으로 "다음" 탭 → "월급을 입력해주세요"
  - When `50000` 입력 → "월급은 10만원 이상 입력해주세요"
  - When `150000000` 입력 → "월급은 1억원 이하로 입력해주세요"
  - Then 세 경우 모두 이동하지 않음
- AC-4 [W][P1]: Scenario: 고정비가 월급 이상
  - Given 월급 `2000000`
  - When 고정비 `{월세 2000000}` 추가 후 "다음" 탭
  - Then 에러 "고정비 합계가 월급보다 크거나 같아요" 표시, 이동하지 않음
- AC-5 [W][P1]: Scenario: 월급날·고정비 항목 검증
  - When 월급날 `0` 또는 `32` 입력 → "월급날은 1일부터 31일 사이로 입력해주세요"
  - When BottomSheet에서 이름 `""`로 추가 → "항목 이름을 입력해주세요"
  - When 금액 `0`으로 추가 → "금액을 입력해주세요"
  - When 고정비가 20개인 상태에서 추가 → Toast "고정비는 최대 20개까지 추가할 수 있어요"
- AC-6 [S][P1]: Scenario: 빈 고정비 상태와 프리필
  - Given 저장된 Plan이 없고 고정비 0개일 때
  - Then `data-testid="fixed-empty"`에 "아직 고정비가 없어요" 문구 표시
  - And 저장된 Plan `{ salary: 3000000, payday: 25 }`가 있으면 월급 필드에 "3,000,000", 월급날에 "25"가 채워짐
- AC-7 [U][P1]: Scenario: 모바일 숫자 키패드
  - Then 월급·월급날·고정비 금액 TextField는 `inputMode="numeric"` 속성을 가진다
  - And 삭제 버튼과 "고정비 추가" 버튼의 높이는 44px 이상

### F3. 비율 프리셋과 직접 조정 (`/ratio`)

- **Description**: 생활비·저축·비상금·여가 네 칸의 비율을 프리셋 칩으로 고르거나 숫자로 직접 조정한다. 비율을 바꾸면 각 칸의 금액이 실시간으로 다시 계산된다. 합계가 100%일 때만 저장할 수 있다.
- **Data**: PlanDraft(입력), Plan(저장)
- **API**: 없음

**Screen `/ratio` — 비율 설정**

- **TDS 컴포넌트**
  - `Top`: "어떤 비율로 나눌까요?"
  - `Chip` ×4: 기본 5:3:1:1, 저축 집중 4:4:1:1, 여유 생활 6:2:1:1, 직접 조정
  - `ListRow` ×4: 왼쪽 라벨, 오른쪽 `TextField` 비율(`inputMode="numeric"`, 접미사 "%") + `Paragraph.Text` 금액
  - 합계 표시: `Paragraph.Text` + `Badge`
  - `SubmitFooter` 안의 `Button` "이 비율로 저장"
  - 저장 실패: `Toast`
- **상태**
  - 로딩: 없음(동기)
  - 빈 상태: draft와 저장된 Plan이 모두 없으면 `/setup`으로 replace 이동
  - 오류: 합계가 100이 아니면 Badge를 경고색으로 바꾸고 저장 버튼을 disabled
- **키보드**
  - 포커스 시 해당 ListRow를 화면 중앙으로 스크롤한다.
  - SubmitFooter는 키보드 위에 붙는다(ScreenScaffold 기본 동작).
- **Navigation contract**
  - Incoming: `location.state = { draft: PlanDraft } | null`. null이면 `loadPlan()`의 salary·fixedCosts·payday를 쓰고, Plan도 없으면 `navigate('/setup', { replace: true })`.
  - Outgoing: "이 비율로 저장" → `savePlan` 성공 후 `navigate('/result', { state: { justSaved: true } })`
- **Instrumentation**: "이 비율로 저장" → `logClick('plan_save')`
- **Layout**: `ScreenScaffold`, 1차 액션은 `SubmitFooter`

**Requirements**:

- AC-1 [E][P0]: Scenario: 프리셋 선택
  - Given draft `{ salary: 3000000, fixedCosts 합계 700000 }`
  - When Chip "저축 집중 4:4:1:1" 탭
  - Then 비율 필드가 `40/40/10/10`
  - And 금액이 생활비 `920,000원`, 저축 `920,000원`, 비상금 `230,000원`, 여가 `230,000원`으로 표시됨
- AC-2 [E][P0]: Scenario: 직접 조정 후 저장
  - Given 프리셋 "기본 5:3:1:1"이 선택된 상태
  - When 저축을 `35`, 생활비를 `45`로 바꾸고 "이 비율로 저장" 탭
  - Then Chip "직접 조정"이 선택 상태가 됨
  - And `psp.plan.v1`에 `{ presetId: 'custom', ratios: {living:45,saving:35,emergency:10,leisure:10} }` 저장
  - And `/result`로 이동
- AC-3 [U][P0]: Scenario: 첫 진입 기본값
  - Given 저장된 Plan이 없을 때
  - When `/ratio`에 draft와 함께 진입
  - Then Chip "기본 5:3:1:1"이 선택되고 비율 `50/30/10/10` 표시
  - And 저장된 Plan이 있으면 그 presetId와 ratios가 선택됨
- AC-4 [W][P1]: Scenario: 합계 100% 아님
  - When 비율을 `50/30/10/5`로 입력
  - Then `data-testid="ratio-sum"`에 "합계 95%" 표시
  - And 에러 "비율 합계가 100%가 되어야 해요 (현재 95%)" 표시
  - And "이 비율로 저장" 버튼 `disabled`
- AC-5 [W][P1]: Scenario: 비율 범위 밖 입력
  - When 저축에 `120` 입력
  - Then 필드 값이 `100`으로 고정됨
  - And 음수·소수점 문자는 입력되지 않음(`"-"`, `"."` 무시)
- AC-6 [W][P1]: Scenario: state 없이 직접 진입
  - Given `location.state === null`이고 저장된 Plan이 없을 때
  - When `/ratio` 진입
  - Then `navigate('/setup', { replace: true })` 호출
- AC-7 [W][P1]: Scenario: 저장 실패
  - Given `savePlan`이 `{ ok: false, reason: 'quota' }`를 반환할 때
  - When "이 비율로 저장" 탭
  - Then Toast "저장 공간이 부족해 저장하지 못했어요" 표시, `/result`로 이동하지 않음

### F4. 배분 결과와 소득 구간 비교 (`/result`)

- **Description**: 저장된 계획의 배분 결과를 보여주는 핵심 결과 화면이다.
  - 무료 층: 쪼갤 수 있는 금액과 네 칸 금액
  - 잠금 층(리워드 광고 게이트): 같은 비율로 월급이 ±50만·±100만원일 때의 소득 구간별 저축 비교 시나리오
- **Data**: Plan(읽기), Allocation, `buildIncomeScenarios(plan)`
- **API**: 없음
- **계산**: `buildIncomeScenarios`
  - 구간은 `[salary-1000000, salary-500000, salary, salary+500000, salary+1000000]`이다.
  - `salary < 100000`이거나 `salary - fixedTotal ≤ 0`인 구간은 제외한다.
  - 각 구간의 반환값은 `{ salary, remaining, saving, yearlySaving: saving × 12 }`이다.

**Screen `/result` — 배분 결과**

- **TDS 컴포넌트**
  - `Top`: "월급을 이렇게 나눠요"
  - `SummaryHero`: value = remaining, CountUp, 라벨 "쪼갤 수 있는 돈"
  - 네 칸 금액: `Card` ×4. 각 Card 안에 `Paragraph.Text` t3 금액과 비율 `Badge`
  - 칸별 비중: `MiniBar`
  - 고정비 합계: `ListRow`
  - 잠금 층: `TossRewardAd` 안에 `Card`. 구간별 `ListRow`와 `MiniBar`
  - `AdSlot` 배너
  - 공유: `Button variant="weak" display="block"` "공유하기"
  - `SubmitFooter` 안의 `Button` "홈으로"
- **결과 계층화**
  - 무료 층 `data-testid="free-tier"`: SummaryHero와 네 칸 Card. 이것만으로 "월급을 어디에 얼마씩" 목적이 달성된다.
  - 잠금 층 `data-testid="locked-tier"`: 소득 구간별 월·연 저축액 비교.
  - 코드 구조 규칙: 무료 층은 `<TossRewardAd>` 바깥에 두고, 잠금 층만 그 자식으로 둔다. 화면 전체를 감싸지 않는다.
- **광고 배치 순서**: 무료 층 → 잠금 층 → `AdSlot` → 공유 버튼. 배너는 콘텐츠와 겹치지 않는다.
- **상태**
  - 로딩: 게이트의 광고 로딩은 템플릿 TossRewardAd가 처리한다.
  - 빈 상태: Plan이 없으면 `Asset.ContentIcon`과 "아직 계획이 없어요"를 보여주고, `Button` "계획 만들기"로 `/setup`에 이동한다.
  - 오류: 계산 결과 remaining ≤ 0(손상 데이터)이면 빈 상태와 같은 화면을 보여준다.
- **Navigation contract**
  - Incoming: `location.state = { justSaved: boolean } | null`
  - Outgoing
    - "홈으로" → `navigate('/', { replace: true })`
    - "계획 만들기"(빈 상태) → `navigate('/setup')`
- **Instrumentation**
  - 무료 층 렌더 → `logImpression('allocation_result')`
  - 배너 → `logImpression('result_banner_ad')`
  - 잠금 층 게이트 노출 → `logImpression('income_compare_gate')`
  - "공유하기" → `logClick('result_share')` 후 `shareApp()`
  - `justSaved === true`로 결과가 렌더된 뒤 `requestReviewOnce()`

**Requirements**:

- AC-1 [U][P0]: Scenario: 무료 층은 광고와 무관하게 보인다
  - Given 광고가 한 번도 뜨지 않는 환경(슬롯 ID 미설정·광고 로드 실패·타임아웃). 템플릿 TossRewardAd는 이때 게이트를 자동으로 연다.
  - And Plan `{ salary: 3000000, fixedCosts 합계 700000, ratios 50/30/10/10 }`
  - When 사용자가 `/result`에 진입
  - Then `data-testid="free-tier"` 영역에 "2,300,000원"과 생활비 `1,150,000원`, 저축 `690,000원`, 비상금 `230,000원`, 여가 `230,000원`이 표시됨
- AC-2 [E][P1]: Scenario: 더 깊은 층은 게이트 뒤에 있다
  - Given `data-testid="locked-tier"` 영역이 TossRewardAd의 자식으로 렌더될 때
  - When 광고 시청이 완료되거나, 광고를 띄울 수 없어 게이트가 자동으로 열림
  - Then `data-testid="locked-tier"`에 월급 5개 구간 행이 표시됨: `2,000,000원 → 월 저축 390,000원 / 연 4,680,000원`, `2,500,000원 → 540,000원`, `3,000,000원 → 690,000원`, `3,500,000원 → 840,000원`, `4,000,000원 → 990,000원`
- AC-3 [U][P0]: Scenario: 결과 레이아웃
  - Then 화면에 `data-testid="summary-hero"` 1개와 `data-testid="bucket-card"` Card 4개가 있음
  - And 각 Card에 금액(t3 이상 강조)과 비율 Badge("50%" 등)가 있음
  - And 1차 액션 "홈으로"는 SubmitFooter 안에 있음
- AC-4 [E][P1]: Scenario: 저장 직후 진입
  - Given `location.state = { justSaved: true }`
  - When 결과가 렌더됨
  - Then Toast "계획을 저장했어요" 표시
  - And `requestReviewOnce()` 1회 호출
  - And `state`가 null이면 둘 다 호출하지 않음
- AC-5 [S][P1]: Scenario: 계획 없음 빈 상태
  - Given `psp.plan.v1`이 없을 때
  - When `/result` 진입
  - Then `data-testid="result-empty"`에 `Asset.ContentIcon`과 "아직 계획이 없어요"가 보임
  - And "계획 만들기" 탭 시 `/setup`으로 이동
- AC-6 [W][P1]: Scenario: 음수 구간 제외
  - Given Plan `{ salary: 1200000, fixedCosts 합계 600000 }`
  - When 잠금 층이 열림
  - Then `200,000원` 구간(remaining ≤ 0)은 제외됨
  - And `700,000원`, `1,200,000원`, `1,700,000원`, `2,200,000원` 4개 행만 표시됨
- AC-7 [E][P2]: Scenario: 공유
  - When "공유하기" 탭
  - Then `logClick('result_share')`와 `shareApp()`이 순서대로 호출됨

### F5. 홈: 월급날 D-day와 이체 체크리스트 (`/`)

- **Description**: 다음 월급날까지 남은 일수와 이번 달 이체 체크리스트를 보여주는 대시보드다. 체크리스트는 배분액이 0보다 큰 칸만 보여준다. 사용자가 Switch를 켜고 끌 때마다 이번 달 MonthRecord와 이행률이 즉시 갱신된다.
- **Data**: Plan(읽기), MonthRecord(읽기·쓰기)
- **API**: 없음

**Screen `/` — 홈**

- **TDS 컴포넌트**
  - `Top`: "PaySplitPlan"
  - `SummaryHero`: value "D-2" 또는 "D-DAY", 보조 "매달 25일 월급"
  - 이번 달 이행률: `Card` 안에 `Paragraph.Text` t2 "75%"와 `Badge`
  - 체크리스트: `ListRow` ×(1~4). 왼쪽 "저축 690,000원", 오른쪽 `Switch`
  - 결과 보기: `Button variant="weak" display="block"` "배분 결과 보기"
  - 계획 수정: `Button variant="weak" display="block"` "계획 수정"
  - `FloatingTabBar`
- **상태**
  - 로딩: 없음(동기)
  - 빈 상태: Plan이 없으면 `Asset.ContentIcon`, "월급을 어떻게 나눌지 계획해볼까요?", 그리고 `SubmitFooter` 안에 `Button` "계획 만들기"
  - 오류: 저장 실패 시 Switch를 원래 상태로 되돌리고 Toast를 띄운다
- **Navigation contract**
  - Incoming: `location.state = null`
  - Outgoing
    - "계획 만들기"·"계획 수정" → `navigate('/setup')`
    - "배분 결과 보기" → `navigate('/result')`(state 없음)
- **Instrumentation**
  - "계획 만들기" → `logClick('plan_create_start')`
  - Switch를 켤 때 → `logClick('transfer_check')`
- **Layout**
  - `ScreenScaffold`를 쓴다.
  - D-day는 `SummaryHero`로 보여준다.
  - 이행률은 `Card`로 묶는다.

**Requirements**:

- AC-1 [U][P0]: Scenario: D-day 표시
  - Given 오늘 `2026-09-23`, Plan `payday: 25`
  - Then `data-testid="dday-hero"`에 "D-2" 표시
  - And payday가 `23`이면 "D-DAY", `31`이면 "D-7" 표시
- AC-2 [E][P0]: Scenario: 이체 체크
  - Given Plan ratios `50/30/10/10`, 이번 달(`2026-09`) 체크 0개
  - When "저축 690,000원" 행의 Switch를 켬
  - Then `psp.records.v1['2026-09']`가 `{ checked: ['saving'], total: 4, rate: 25 }`로 저장됨
  - And `data-testid="month-rate"`가 "25%"로 갱신됨
- AC-3 [E][P0]: Scenario: 전체 완료
  - Given 3개 체크 상태(rate 75)
  - When 남은 1개 Switch를 켬
  - Then rate `100` 저장
  - And `data-testid="month-rate"` 옆에 Badge "이번 달 완료" 표시
- AC-4 [U][P0]: Scenario: 대시보드 레이아웃
  - Then `data-testid="dday-hero"` 1개, `data-testid="month-rate"`를 가진 Card 1개, `data-testid="transfer-item"` ListRow 4개(ratios 50/30/10/10 기준)가 있음
- AC-5 [S][P1]: Scenario: 계획 없음 빈 상태
  - Given `psp.plan.v1`이 없을 때
  - Then `data-testid="home-empty"`에 `Asset.ContentIcon`과 "월급을 어떻게 나눌지 계획해볼까요?"가 보임
  - And SubmitFooter "계획 만들기" 탭 시 `/setup`으로 이동
- AC-6 [W][P1]: Scenario: 0원 칸 제외
  - Given ratios `{living:60, saving:40, emergency:0, leisure:0}`
  - Then 체크리스트에 생활비·저축 2개 행만 표시됨
  - And 모두 체크 시 `{ total: 2, rate: 100 }` 저장
- AC-7 [W][P1]: Scenario: 체크 저장 실패
  - Given `saveRecords`가 `{ ok: false, reason: 'quota' }`를 반환할 때
  - When Switch를 켬
  - Then Switch가 꺼진 상태로 되돌아감
  - And Toast "저장 공간이 부족해 저장하지 못했어요" 표시
- AC-8 [W][P1]: Scenario: 손상 데이터
  - Given `psp.plan.v1 = "{broken"`
  - When 홈 진입
  - Then 앱이 멈추지 않고 빈 상태 화면 표시
  - And Toast "저장된 계획을 불러오지 못했어요" 1회 표시

### F6. 월별 이행률 기록과 6개월 추이 (`/history`)

- **Description**: 계획을 만든 달부터 이번 달까지 월별 이행률 목록을 보여주는 두 번째 결과 화면이다.
  - 무료 층: 이번 달 이행률과 월별 목록
  - 잠금 층(리워드 광고 게이트): 최근 6개월 추이 Sparkline, 6개월 평균, 100% 달성 개월 수
  - 과거 달은 읽기 전용이다.
- **Data**: MonthRecord(읽기), Plan(createdAt 확인용)
- **API**: 없음

**Screen `/history` — 이행 기록**

- **TDS 컴포넌트**
  - `Top`: "월별 이행 기록"
  - `SummaryHero`: value = 이번 달 rate, CountUp, 접미사 "%"
  - 월별 목록: `ListRow` 반복. 왼쪽 "2026년 9월", 오른쪽 "75%"와 rate 100일 때 `Badge` "완료". 최신 달이 위에 온다.
  - 잠금 층: `TossRewardAd` 안에 `Card`. `Sparkline`(6개 점), `Paragraph.Text` 평균·달성 개월
  - `AdSlot` 배너
  - `FloatingTabBar`
- **결과 계층화**
  - 무료 층 `data-testid="free-tier"`: SummaryHero와 월별 목록. 이것만으로 "월별 이행률 기록" 목적이 달성된다.
  - 잠금 층 `data-testid="locked-tier"`: 6개월 추이·평균·달성 개월 수.
  - 코드 구조 규칙: 무료 층은 `<TossRewardAd>` 바깥에 두고, 잠금 층만 그 자식으로 둔다.
- **광고 배치 순서**: 무료 층 → 잠금 층 → `AdSlot`
- **상태**
  - 로딩: 게이트 로딩은 템플릿이 처리한다.
  - 빈 상태: Plan이 없으면 `Asset.ContentIcon`과 "계획을 만들면 매달 이행률이 여기에 쌓여요", 그리고 `Button` "계획 만들기"
  - 오류: 레코드가 손상됐으면 `{}`로 처리하고 빈 달을 다시 채운다
- **스크롤**: 최대 36행이라 페이지 스크롤을 쓴다(가상 스크롤 없음).
- **Navigation contract**
  - Incoming: `location.state = null`
  - Outgoing: "계획 만들기" → `navigate('/setup')`
- **Instrumentation**
  - 잠금 층 게이트 노출 → `logImpression('history_trend_gate')`
  - 배너 → `logImpression('history_banner_ad')`

**Requirements**:

- AC-1 [U][P0]: Scenario: 무료 층은 광고와 무관하게 보인다
  - Given 광고가 한 번도 뜨지 않는 환경(슬롯 ID 미설정·광고 로드 실패·타임아웃). 템플릿 TossRewardAd는 이때 게이트를 자동으로 연다.
  - And 기록 `2026-07: 50`, `2026-08: 100`, `2026-09: 75`
  - When 사용자가 `/history`에 진입
  - Then `data-testid="free-tier"`에 "75%" 히어로가 표시됨
  - And 목록이 "2026년 9월 75%", "2026년 8월 100% 완료", "2026년 7월 50%" 순으로 표시됨
- AC-2 [E][P1]: Scenario: 더 깊은 층은 게이트 뒤에 있다
  - Given `data-testid="locked-tier"` 영역이 TossRewardAd의 자식으로 렌더될 때
  - And 기록 `2026-04..2026-09` rate `[50, 75, 100, 100, 75, 100]`
  - When 광고 시청이 완료되거나, 광고를 띄울 수 없어 게이트가 자동으로 열림
  - Then `data-testid="locked-tier"`에 6개 점의 `Sparkline`, "6개월 평균 83%", "100% 달성 3개월"이 표시됨
- AC-3 [E][P0]: Scenario: 빈 달 자동 기록
  - Given `plan.createdAt = 2026-07-10`, 오늘 `2026-09-23`, 기록은 `2026-09`만 있음
  - When `/history` 진입
  - Then 목록에 `2026-08`, `2026-07`이 "0%"로 표시되고 `psp.records.v1`에 저장됨
- AC-4 [U][P0]: Scenario: 기록 레이아웃
  - Then `data-testid="summary-hero"` 1개와 `data-testid="month-row"` ListRow가 기록 개월 수만큼 있음
  - And 과거 달 행에는 Switch 등 편집 컨트롤이 없음
- AC-5 [S][P1]: Scenario: 계획 없음 빈 상태
  - Given `psp.plan.v1`이 없을 때
  - Then `data-testid="history-empty"`에 `Asset.ContentIcon`과 "계획을 만들면 매달 이행률이 여기에 쌓여요"가 보임
- AC-6 [W][P1]: Scenario: 추이 데이터 부족
  - Given 기록이 1개월(`2026-09`)뿐일 때
  - When 잠금 층이 열림
  - Then Sparkline 대신 "2개월 이상 기록되면 추이를 보여드려요"가 표시됨
- AC-7 [W][P1]: Scenario: 손상된 기록
  - Given `psp.records.v1 = "[bad"`이고 Plan이 있을 때
  - When `/history` 진입
  - Then 오류 화면 없이 createdAt 달부터 이번 달까지 0% 레코드로 다시 채워져 표시됨

### F7. 앱 셸, 광고 배치, 검수 준수

- **Description**: 라우터, FloatingTabBar, 스택 화면 뒤로가기, 배너·리워드 광고 env 연결을 묶는 공통 셸이다. 앱인토스 검수에서 반려되는 사항(외부 이동, 설치 유도, 외부 로깅, HEX 색상, 콘솔 에러)을 코드와 빌드 수준에서 막는다.
- **Data**: 없음
- **API**: 없음
- **Routes**: `/`(홈), `/setup`, `/ratio`, `/result`, `/history`. 그 밖의 경로는 `/`로 redirect한다.

**Requirements**:

- AC-1 [U][P0]: Scenario: 탭 네비게이션
  - Given 홈 `/`에 있을 때
  - When FloatingTabBar "기록" 탭
  - Then `/history`로 이동
  - And `/setup`, `/ratio`, `/result`에서는 FloatingTabBar가 렌더되지 않음
- AC-2 [U][P0]: Scenario: 광고 env 연결
  - Then `AdSlot`은 `adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID}`를, `TossRewardAd`는 `slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}`를 받음
  - And 두 값이 undefined인 빌드에서도 `/result`, `/history`의 free-tier가 표시됨
- AC-3 [W][P1]: Scenario: 알 수 없는 경로
  - When `/unknown`으로 진입
  - Then `/`로 replace 이동
- AC-4 [W][P1]: Scenario: 외부 도메인 이탈 금지
  - Then 소스에 `window.open(` 호출과 `window.location.href =` 외부 URL 대입이 0건(grep 검사)
  - And 앱 내 모든 이동은 react-router `navigate`로만 이루어짐
- AC-5 [W][P1]: Scenario: 금지 요소
  - Then 소스·UI 문구에 "앱을 설치", "다운로드" 문자열이 0건
  - And `gtag`, `amplitude`, `mixpanel`, `firebase/analytics` import가 0건
  - And `src/` 내 `.tsx`, `.css`에서 HEX 색상 정규식 `/#[0-9a-fA-F]{3,8}\b/`의 매치가 0건(색상은 `var(--tds-color-*)`만 사용)
- AC-6 [U][P1]: Scenario: 콘솔 에러 0개
  - Given 프로덕션 빌드(`vite build`)를 실행할 때
  - When 홈 → setup → ratio → result → history를 순서대로 방문
  - Then `console.error` 호출이 0회
- AC-7 [U][P1]: Scenario: 호환성과 터치 영역
  - Then 빌드 타겟은 `es2017` 이하 문법으로 트랜스파일됨(Android 7+, iOS 16+)
  - And `Array.prototype.at`, `structuredClone`, `crypto.randomUUID`를 폴백 없이 쓰지 않음
  - And 모든 Button, Switch, Chip, ListRow의 터치 영역은 44px 이상

## Assumptions

1. **4칸 비율 해석**: PRD의 "5:3:2"는 3개 숫자이고 칸은 생활비·저축·비상금·여가 4개다. 그래서 "2"를 비상금 10%와 여가 10%로 나눈 **5:3:1:1**을 기본 프리셋으로 삼았다. 나머지 두 프리셋(4:4:1:1, 6:2:1:1)도 이번 SPEC에서 정한 값이다.
2. **이체 체크리스트 단위**: 네 칸(배분액이 0보다 큰 칸)만 체크 대상이다. 고정비는 자동이체라고 보고 체크리스트에서 뺐다. 이행 기준 월은 월급 주기가 아니라 **달력 월(YYYY-MM)**이다.
3. **이행률 식**: 체크한 칸 수 ÷ 전체 칸 수 × 100(반올림)이다. 계획을 만든 달부터 체크가 없는 달은 0%로 기록한다. 과거 달은 수정할 수 없다.
4. **소득 구간 비교는 계산값이다**: 같은 고정비와 같은 비율에서 월급을 ±50만·±100만원 바꿨을 때의 결과다. 외부 통계(연령·소득 평균 등)는 쓰지 않는다.
5. **리워드 게이트가 2곳인 이유**: PRD가 잠금 층을 "소득 구간별 비교 시나리오"와 "6개월 이행 추이" 두 가지로 정했다. 두 잠금 층은 각각 두 핵심 흐름(계획 → `/result`, 기록 → `/history`)의 마지막 결과 화면에 1개씩 둔다. 입력 화면과 홈 체크리스트는 잠그지 않는다.
6. **배분 금액은 1,000원 단위 내림**이고, 끝전은 생활비에 합친다.
7. 월급 범위(10만~1억원), 고정비 최대 20개, 기록 보관 36개월은 localStorage 용량과 UX를 고려해 정한 값이다.
8. 수익 모델은 광고뿐이다. IAP, 구독, 프로모션 리워드(`grantPromotionReward`)는 쓰지 않는다. 생성형 AI를 쓰지 않으므로 AI 고지 AC는 없다.

## Open Questions

1. 기본 프리셋을 5:3:1:1로 정했는데, PRD 작성자가 생각한 "5:3:2"의 칸 구성이 다르다면(예: 여가 없이 3칸) 프리셋 표를 다시 정해야 하는가?
2. 월급날이 주말·공휴일이라 앞당겨 지급되는 경우도 D-day에 반영해야 하는가? 이번 SPEC은 반영하지 않는다.
3. 계획을 월 중간에 수정하면 이번 달 체크 상태를 유지하는가? 이번 SPEC에서는 유지하고, 0원이 된 칸의 체크만 제거한다.
4. 리워드 게이트를 결과 화면 한 곳으로 합쳐야 하는가? 합친다면 6개월 추이를 `/result` 잠금 층으로 옮기는 안을 검토해야 한다.
5. 데이터 초기화(전체 삭제) 기능이 필요한가? MVP 범위 밖이라 보고 넣지 않았다.