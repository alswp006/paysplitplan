# SPEC — PaySplitPlan (월급 쪼개기)

아래는 스키마 검증 이슈를 모두 고친 전체 SPEC입니다. 이 앱에는 SQL DB가 없고 localStorage만 씁니다. 그래서 localStorage에 저장하는 엔티티 하나를 테이블 하나로 보고 규칙을 적용했습니다.

## 변경 요약

**id·createdAt·updatedAt 추가**
- 저장하는 엔티티 4개 모두에 `id`, `createdAt`, `updatedAt`을 넣었습니다: `SalaryPlan`, `FixedCost`, `MonthRecord`, `ReviewPromptState`.
- 리뷰 요청 플래그(`paysplit:review:v1`)는 원래 `'1'` 문자열이었습니다. 이것도 저장 엔티티라서 JSON 레코드(`ReviewPromptState`)로 바꿨습니다.
- 공통 유틸 두 개를 추가했습니다: `createId()`, `nowIso()`.
- 타임스탬프 규칙을 한곳에 정리했습니다: 생성 시각은 바뀌지 않고, 갱신 시각은 실제로 쓸 때만 바뀝니다. 기기 시계가 거꾸로 가도 갱신 시각은 생성 시각보다 앞서지 않습니다.

**외래 키(FK)와 삭제 동작**
- `MonthRecord.planId` → `SalaryPlan.id` 참조를 새로 만들었습니다.
  - 계획이 삭제돼도 기록은 지우지 않고 그대로 둡니다(NO ACTION). 끊긴 참조는 허용합니다.
  - 화면은 이 참조를 따라가지 않고 기록 안의 `snapshot`만 씁니다.
- `FixedCost`는 계획 JSON 안에 들어 있어서, 계획이 삭제되면 함께 삭제됩니다(CASCADE).

**인덱스**
- 기본 키, 유일 인덱스, 정렬 방식을 표로 정리했습니다.
- `FixedCost.id`는 한 계획 안에서 중복되면 안 됩니다. 이 규칙을 검증에 넣었습니다.
- `records`의 객체 키는 `month`의 유일 인덱스 역할을 합니다.

**계획을 다시 저장할 때**
- 계획은 한 행(싱글톤)만 있습니다. 덮어써도 `id`와 `createdAt`은 그대로 두고 `updatedAt`만 바꿉니다(F1 AC-13, F4 AC-9).

**기존 데이터 호환**
- 새 필드가 없는 예전 v1 데이터는 버리지 않습니다. 읽을 때 메모리에서만 빈 필드를 채우고, 다음에 저장할 때 채운 값을 기록합니다(F1 AC-15, AC-16).
- 새 필드가 있는데 타입이 틀리면 손상 데이터(HTTP 대응 422)로 처리합니다(F1 AC-12, AC-17).

**추가·수정한 AC**
- 추가: F1 AC-13~19
- 수정: F1 AC-3·4·11·12, F2 AC-8·11, F4 AC-3·9
- 기타: 용량 추정을 다시 계산했고, 가정 A12~A14와 확인 질문 Q7을 추가했습니다.

---

## Common Principles

**P-1. 기술 스택**
- Vite + React + TypeScript를 쓴다.
- UI는 모두 TDS(`@toss/tds-mobile`)로 만든다.
- 라우팅은 `react-router-dom`을 쓴다. 라우트는 `/`, `/plan`, `/result`, `/history`, `*`(404 폴백, F8) 5개다.
- 데이터는 localStorage에만 저장한다. 서버와 외부 API는 없다.

**P-2. 이미 있는 것(재설계 금지)**
- 템플릿이 제공하는 컴포넌트: `AdSlot`, `TossRewardAd`, `TossPurchase`, localStorage 헬퍼, `FloatingTabBar`, `PageShell`/`ScreenScaffold`, `SubmitFooter`, `Card`, `SummaryHero`(CountUp), `Sparkline`, `MiniBar`, `Asset.ContentIcon`.
- 로그인은 Toss 세션을 자동으로 쓴다. 사용자를 식별할 필요가 없으므로 `getIsTossLoginIntegratedService()`도 호출하지 않는다.

**P-2a. 공용 유틸 (이 앱이 `src/lib/*`에 새로 만든다, 새 npm 의존성 없음)**

| 함수 | 모듈 | 시그니처 | 계약 |
|---|---|---|---|
| `logClick` | `src/lib/analytics.ts` | `(name: string) => void` | 템플릿의 Toss 내부 로깅 헬퍼에 위임하는 얇은 래퍼다. 외부 분석 SDK를 쓰지 않는다(AC-C5). 헬퍼가 없거나 호출 중 예외가 나도 삼키고 no-op로 끝난다(try/catch). |
| `logImpression` | `src/lib/analytics.ts` | `(name: string) => void` | `logClick`과 같은 방식이다. 한 번 마운트된 화면 안에서 같은 name은 1회만 기록한다. |
| `shareApp` | `src/lib/share.ts` | `() => Promise<void>` | 이미 설치된 `@apps-in-toss/web-framework`의 공유 기능을 호출한다. 쓸 수 없으면 `navigator.share`, 그것도 없으면 no-op다. 사용자가 취소하거나 실패해도 reject하지 않고 resolve한다. |
| `requestReviewOnce` | `src/lib/review.ts` | `() => void` | localStorage 키 `paysplit:review:v1`이 **없을 때만** 리뷰 요청을 1회 호출한다. 호출 후 `ReviewPromptState`(Data Models)를 JSON으로 저장한다. 키가 있으면 값과 상관없이 no-op다(예전 값 `'1'`도 이미 요청한 것으로 본다). `setItem` 예외는 삼킨다. 예외를 던지지 않는다. |
| `getToday` | `src/lib/date.ts` | `() => Date` | `new Date()`(기기 로컬)를 반환한다. 테스트에서 mock한다(P-6). |
| `nowIso` | `src/lib/date.ts` | `() => string` | `getToday().toISOString()`을 반환한다. 저장 엔티티의 `createdAt`, `updatedAt`, `completedAt`은 모두 이 함수로만 만든다. |
| `isIsoTimestamp` | `src/lib/date.ts` | `(x: unknown) => x is string` | `typeof x === 'string'`이고, 빈 문자열이 아니고, `!Number.isNaN(Date.parse(x))`이면 `true`다. |
| `createId` | `src/lib/id.ts` | `() => string` | `Date.now().toString(36) + Math.random().toString(36).slice(2, 6)`를 반환한다. 호환성(AC-C6) 때문에 `crypto.randomUUID()`는 쓰지 않는다. |
| `formatManwon` | `src/lib/format.ts` | `(n: number) => string` | `n ≥ 10000`이면 `Math.floor(n/10000).toLocaleString('ko-KR') + '만 원'`, `0 < n < 10000`이면 `n.toLocaleString('ko-KR') + '원'`, `n ≤ 0`이면 `''`(보조 문구 숨김)를 반환한다. 예: `3000000 → "300만 원"`, `3450000 → "345만 원"`. |
| `parseAmountInput` | `src/lib/format.ts` | `(raw: string) => ParsedAmount` | 숫자 입력 필드의 원문을 해석한다. 규칙은 아래와 같다. 예외를 던지지 않는다. |

```ts
export type ParsedAmount =
  | { kind: 'empty' }
  | { kind: 'ok'; value: number }   // 0 이상 정수
  | { kind: 'negative' }
  | { kind: 'decimal' }
  | { kind: 'invalid' };
```

`parseAmountInput` 해석 규칙은 위에서부터 차례로 적용한다.
1. `s = raw.replace(/[,\s]/g, '')`로 콤마와 공백을 모두 지운다.
2. `s === ''`이면 `empty`다.
3. `/^\d+$/`에 맞으면 `ok`이고 value는 `Number(s)`다. 앞자리 0은 무시한다. 예: `"007" → 7`.
4. `/^-\d+(\.\d+)?$/`에 맞으면 `negative`다.
5. `/^\d+\.\d+$/`에 맞으면 `decimal`이다.
6. 그 외는 모두 `invalid`다. 예: `"abc"`, `"-"`, `"3e6"`, `"3,000원"`.

**P-3. TDS 규칙**
- 블록 조립에 쓰는 컴포넌트: `ListRow`, `Button`, `TextField`, `Paragraph.Text`, `Chip`+`ChipItem`, `Switch`, `AlertDialog`, `BottomSheet`, `Toast`, `Top`, `Badge`.
- 여백은 `Spacing size={n}`으로만 조정한다. TDS 컴포넌트에 인라인 margin/padding을 덮어쓰지 않는다.
- 커스텀 CSS는 flex/grid 배치에만 쓴다.

**P-4. 색상**
- HEX 하드코딩은 금지한다. `var(--adaptiveGrey600)` 같은 `var(--adaptive*)` 변수나 TDS 컴포넌트 색만 쓴다(다크모드 대응).

**P-5. 금액 표기**
- 모든 금액은 정수 원 단위로 다룬다.
- 화면에는 `toLocaleString('ko-KR') + '원'`으로 표기한다. 예: `2,400,000원`.
- 보조 표기는 `formatManwon(n)`을 쓴다. 예: `3000000 → "300만 원"`, `3450000 → "345만 원"`.

**P-6. 날짜**
- 모든 날짜 계산은 기기 로컬 날짜를 기준으로 한다.
- 오늘 날짜는 `getToday(): Date` 유틸 하나로만 얻는다. 저장용 타임스탬프는 `nowIso()`로만 만든다. 테스트에서는 `getToday`를 mock한다.

**P-7. 결과 계층화 (수익 모델)**
- 게이트는 `/result` 화면 **한 곳**에만 둔다.
- 무료 층(`data-testid="free-tier"`): 가용 금액과 4개 통장별 배분액이다. 여기까지만 봐도 PRD 목적인 "어디에 얼마씩"이 달성된다.
- 잠금 층(`data-testid="locked-tier"`): 소득 구간별 비교 시나리오와 6개월 이행 추이다. `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`의 자식으로만 렌더한다.
- fail-open: 슬롯 ID가 없거나, 광고 로드에 실패하거나, 타임아웃이 나면 게이트가 자동으로 열린다.
- 결제(IAP)나 구독으로 계층을 여는 방식은 쓰지 않는다.

**P-8. 이 앱에 해당하지 않는 항목**

| 항목 | 이유 |
|---|---|
| 생성형 AI 고지 | 결과는 정해진 계산식으로 나오고 AI를 쓰지 않는다 |
| CORS | 외부 API를 호출하지 않는다 |
| 프로모션 리워드 (`grantPromotionReward`) | PRD에 없다 |
| IAP | PRD의 수익 모델은 광고뿐이다 |
| 401 (미인증 접근) | 별도 로그인이 없다. Toss 세션을 자동으로 쓰고(P-2), 인증이 필요한 리소스도 없다. 인증 실패 화면을 만들지 않는다. |
| 403 (다른 사용자 데이터 접근) | 사용자 한 명의 기기 localStorage만 쓴다. 다른 사용자의 데이터에 접근하는 경로가 구조적으로 없어 권한 에러 화면을 만들지 않는다. |
| SQL DB, 마이그레이션 도구, DB 레벨 FK 강제, 트랜잭션 | 저장소는 localStorage뿐이다. 키 유일성, 참조 무결성, 원자성은 `src/lib/storage.ts`의 검증과 "`setItem` 실패 시 기존 값 유지" 규칙으로 코드에서 보장한다(Data Models의 스키마 개요). |

**P-9. 공통 AC (검수 통과용, 모든 화면에 적용)**

- **AC-C1 [W][P0]: 외부 도메인 이탈 차단**
  - Given 앱의 모든 화면에서
  - When 소스 전체(`src/**/*.{ts,tsx}`)에서 `window.open(`이나 `window.location.href =`에 `http`로 시작하는 URL을 넣는 코드를 grep하면
  - Then 매치가 0건이다.
  - And 앱 안의 이동은 모두 `navigate()`로만 이루어진다.
- **AC-C2 [U][P1]: 콘솔 에러 0개**
  - Given 프로덕션 빌드(`vite build && vite preview`)에서
  - When 이 흐름을 끝까지 수행하면: `/` → `/plan` 입력 → `/result` 저장 → `/` 체크 4개 → `/history` → 주소창에서 `/does-not-exist` 진입 → `"홈으로 가기"` 탭
  - Then `console.error` 호출이 0회다.
  - And `No routes matched`를 포함한 `console.warn` 호출도 0회다.
- **AC-C3 [W][P0]: HEX 색상 하드코딩 금지**
  - When `src/`의 템플릿 외 파일(`*.ts, *.tsx, *.css`)에서 정규식 `#[0-9a-fA-F]{3,8}\b`로 grep하면
  - Then 매치가 0건이다.
- **AC-C4 [W][P1]: 앱 설치 유도 문구 금지**
  - When `src/`에서 `설치하세요|다운로드|앱 받기`를 grep하면
  - Then 매치가 0건이다.
- **AC-C5 [W][P0]: 외부 로깅 금지**
  - When `package.json` 의존성과 `src/`를 검사하면
  - Then `react-ga`, `@amplitude`, `firebase/analytics`, `googletagmanager`, `mixpanel`이 0건이다.
- **AC-C6 [U][P1]: Android 7+, iOS 16+ 호환**
  - When `src/`에서 `structuredClone|\.at\(|Object\.hasOwn|\.findLast\(|\.toSorted\(|randomUUID`를 grep하면
  - Then 매치가 0건이다.
- **AC-C7 [U][P1]: 터치 영역**
  - Given 모든 화면의 `Button`, `Switch`, `ListRow`(onClick 있음), `ChipItem`에서
  - Then 렌더된 요소의 높이가 44px 이상이다.
- **AC-C8 [U][P0]: 광고 없이도 전 과정 완료 (fail-open)**
  - Given `VITE_TOSS_AD_SLOT_ID`와 `VITE_TOSS_AD_GROUP_ID`가 모두 비어 있는 빌드에서
  - When AC-C2의 전체 흐름을 수행하면
  - Then 모든 단계가 막힘 없이 완료된다.

**P-10. 에러 AC 표기 규칙 (HTTP 대응 코드)**
- 이 앱은 서버와 네트워크 요청이 없어 실제 HTTP 응답을 만들지 않는다.
- 에러 AC 제목의 `HTTP 대응 NNN`은 **에러 종류를 나누는 라벨**일 뿐이다. 구현에서 HTTP 상태 코드를 반환하거나 로그로 남기지 않는다. 화면에도 `"404"` 같은 숫자를 보여주지 않는다.
- 에러 AC에는 사용자가 보는 **정확한 에러 문구**를 적는다. 문구가 없는 경우(함수 반환값 등)에는 반환값을 적는다.

| 라벨 | 의미 | 이 앱에서의 처리 |
|---|---|---|
| HTTP 대응 400 | 입력 형식·타입·범위 위반 | 필드 에러 문구를 보여주고 제출을 막는다(SubmitFooter disabled 또는 이동 안 함). 입력 원문은 자동으로 고치지 않는다. |
| HTTP 대응 404 | 없는 경로, 저장된 데이터 없음 | 빈 상태나 404 화면을 보여주고, 다음 행동으로 가는 Button을 둔다. |
| HTTP 대응 409 | 기존 데이터와 충돌 | AlertDialog로 확인을 받거나, 같은 요청은 결과가 바뀌지 않게(멱등) 처리한다. |
| HTTP 대응 412 | 선행 조건 없음 | `{ ok: false, error: 'NO_PLAN' }`을 반환하고 아무것도 쓰지 않는다. |
| HTTP 대응 422 | 저장된 데이터 손상·스키마 위반 | 기본값으로 복구하거나 해당 레코드를 뺀다. `console.error`는 0회, 예외도 0회다. |
| HTTP 대응 507 | 저장 공간 부족 | `{ ok: false, error: 'QUOTA' }`를 반환하고, 기존 값을 유지하고, Toast를 띄운다. |

---

## Data Models

### 스키마 개요 (localStorage 엔티티 = 테이블)

**저장 엔티티**

| 엔티티(테이블) | 저장 위치 | 행 수 | PK | 공통 필드 | 관계 |
|---|---|---|---|---|---|
| `SalaryPlan` | `paysplit:plan:v1` | 0–1 (싱글톤) | `id` | `id`, `createdAt`, `updatedAt` | 1:N `FixedCost`(내장), 1:N `MonthRecord`(`planId`) |
| `FixedCost` | `SalaryPlan.fixedCosts[]` (내장) | 계획당 0–10 | `id` (계획 안에서 유일) | `id`, `createdAt`, `updatedAt` | N:1 `SalaryPlan`(부모 JSON에 포함) |
| `MonthRecord` | `paysplit:records:v1` → `records[month]` | 0–24 | `id` | `id`, `createdAt`, `updatedAt` | N:1 `SalaryPlan`(`planId`, soft FK) |
| `ReviewPromptState` | `paysplit:review:v1` | 0–1 (싱글톤) | `id` (고정값 `'review-prompt'`) | `id`, `createdAt`, `updatedAt` | 없음 |

**저장하지 않는 것(계산값이나 코드 상수)**: `Allocation`, `BracketScenario`, `TrendPoint`/`TrendSummary`, `PRESETS`. 이것들은 id나 타임스탬프를 갖지 않는다.

**타임스탬프 공통 규칙**
- 형식: `nowIso()` 결과(UTC ISO 8601, 예: `"2026-09-29T01:00:00.000Z"`)를 쓴다. 검증은 `isIsoTimestamp`로 한다.
- `createdAt`: 행을 처음 만들 때 1회 넣고, 그 뒤로 바꾸지 않는다.
- `updatedAt`: 처음 만들 때는 `createdAt`과 같은 값이다. 그 행을 실제로 쓰는 저장 호출마다 새로 넣는다. 멱등 호출(F1 AC-11)은 쓰기를 하지 않으므로 바뀌지 않는다.
- 쓰기 시점 불변식: `updatedAt = max(nowIso(), createdAt)`. 기기 시계가 거꾸로 가도 `updatedAt`은 `createdAt`보다 앞서지 않는다. 읽을 때는 두 값의 순서를 검증하지 않는다.

**외래 키(FK)와 삭제 동작**

| 자식 → 부모 | 참조 방식 | null 허용 | 부모 삭제 시 | 강제 방식 |
|---|---|---|---|---|
| `FixedCost` → `SalaryPlan` | 내장(부모 JSON의 `fixedCosts` 배열) | 해당 없음 | **CASCADE**: 같은 키에 들어 있어서 함께 삭제된다 | 구조적 포함 |
| `MonthRecord.planId` → `SalaryPlan.id` | 문자열 참조(soft FK) | 예. 레거시 레코드는 `null`(F1 AC-16) | **NO ACTION**: 기록은 삭제하지 않고, `planId`도 바꾸지 않는다(끊긴 참조 허용) | 쓰기 시점(`toggleRecordItem`)에만 현재 `plan.id`를 넣는다. 읽기 시점에는 참조가 있는 계획인지 검증하지 않는다. |

- 부모 행이 삭제되는 경우는 `loadPlan()`이 손상된 계획 키를 지울 때뿐이다(F1 AC-5, AC-12). 계획을 삭제하는 UI는 없다.
- `planId`를 SET NULL로 처리하지 않는 이유가 있다. 읽기만으로는 기록을 다시 쓰지 않는다는 원칙이 있고, 손상된 계획이 삭제돼도 기록 문자열은 그대로여야 한다(F6 AC-11).
- 화면과 계산은 `planId`를 따라가지 않는다. 과거 월의 금액·비율은 `MonthRecord.snapshot`으로만 보여준다.
- 끊긴 `planId`는 그 달에 다음 토글이 성공할 때 현재 계획 id로 갱신된다(F1 AC-18).

**키와 인덱스**

| 엔티티 | 컬럼 | 종류 | 구현 | 쓰는 곳 |
|---|---|---|---|---|
| `SalaryPlan` | `id` | PK | 싱글톤 키 하나. 조회는 `getItem` 1회 | `loadPlan`, `savePlan` |
| `FixedCost` | `id` | PK (계획 안에서 UNIQUE) | `isValidDraft`가 같은 배열 안의 중복 id를 거부한다 | 고정비 삭제(id로 필터) |
| `FixedCost` | 배열 위치 | 정렬 | 배열 인덱스 = 표시 순서(추가 순) | `/plan` 목록, `isSamePlan` |
| `MonthRecord` | `month` | UNIQUE | `records` 객체 키 = `month`. 키와 `record.month`가 같아야 한다(다르면 레코드 제외). 이번 달 조회는 O(1)이다 | `toggleRecordItem`, `getTrend`, `/history` |
| `MonthRecord` | `id` | PK | `createId()`로 생성한다. 같은 월에서는 바뀌지 않는다. 월과 1:1이라 스토어 전체의 중복 검사는 하지 않는다 | 레코드 식별 |
| `MonthRecord` | `month` 정렬 | 정렬 | 키가 최대 24개라서 `Object.keys(records).sort()`로 충분하다. 별도 인덱스는 두지 않는다 | `/history`(내림차순), `getTrend`·24개월 정리(오름차순) |
| `MonthRecord` | `planId` | 인덱스 없음 | 조회 조건으로 쓰지 않는다(기록 전용 참조) | — |
| `ReviewPromptState` | `id` | PK | 싱글톤 키 하나. 키가 있는지만 확인한다 | `requestReviewOnce` |

### 공통 타입 — `src/lib/plan.ts`

```ts
export type CategoryKey = 'living' | 'saving' | 'emergency' | 'leisure';
export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  living: '생활비', saving: '저축', emergency: '비상금', leisure: '여가',
};
export const CATEGORY_ORDER: CategoryKey[] = ['living', 'saving', 'emergency', 'leisure'];

/** 각 값 0–100 정수, 합계 반드시 100 */
export type Ratios = Record<CategoryKey, number>;

export type PresetId = 'p532' | 'p442' | 'p622' | 'custom';
export interface Preset { id: Exclude<PresetId, 'custom'>; label: string; ratios: Ratios; }
export const PRESETS: Preset[] = [
  { id: 'p532', label: '5:3:2 기본',     ratios: { living: 50, saving: 30, emergency: 10, leisure: 10 } },
  { id: 'p442', label: '4:4:2 저축 집중', ratios: { living: 40, saving: 40, emergency: 10, leisure: 10 } },
  { id: 'p622', label: '6:2:2 여유',     ratios: { living: 60, saving: 20, emergency: 10, leisure: 10 } },
];
```
프리셋은 코드 상수이고 localStorage에 저장하지 않는다.

### FixedCost

| 필드 | 타입 | 제약 |
|---|---|---|
| id | `string` | PK. `createId()`로 만든다. 빈 문자열이 아니고, 같은 `fixedCosts` 배열 안에서 유일하다 |
| name | `string` | trim 후 1–20자. 같은 이름이 여러 개 있어도 된다(A10) |
| amount | `number` | 정수, 1 ≤ amount ≤ 100,000,000 |
| createdAt | `string` | ISO 8601. `/plan`에서 추가할 때 `nowIso()`로 넣는다 |
| updatedAt | `string` | ISO 8601. 추가할 때 `createdAt`과 같은 값이다. MVP에는 고정비 수정 기능이 없어서 추가 뒤에는 바뀌지 않는다. 계획을 저장(`savePlan`)해도 고정비의 타임스탬프는 바꾸지 않는다 |

### SalaryPlan (현재 계획, 싱글톤 1행)

```ts
export interface FixedCost {
  id: string;
  name: string;
  amount: number;
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
}
export interface SalaryPlan {
  version: 1;
  id: string;              // PK. 처음 저장할 때 createId(), 이후 덮어써도 유지
  salary: number;          // 정수, 1 ≤ salary ≤ 100,000,000
  fixedCosts: FixedCost[]; // 0–10개, 합계 < salary, id 유일
  presetId: PresetId;      // ratios가 프리셋과 일치하지 않으면 'custom'
  ratios: Ratios;          // 합계 100
  payday: number;          // 1–31 정수
  createdAt: string;       // ISO 8601. 처음 저장할 때 1회, 이후 불변
  updatedAt: string;       // ISO 8601. savePlan이 성공할 때마다 갱신
}
export type PlanDraft = Omit<SalaryPlan, 'version' | 'id' | 'createdAt' | 'updatedAt'>;

export function isValidDraft(x: unknown): x is PlanDraft;
export function isValidPlan(x: unknown): x is SalaryPlan;
export function isSamePlan(a: PlanDraft, b: PlanDraft): boolean;
export function normalizeLegacyPlan(x: unknown): unknown; // 읽기 전용 정규화, 아래 참조
```
- localStorage 키: `paysplit:plan:v1`
- 저장 형태: `JSON.stringify(SalaryPlan)`. 계획이 없으면 키도 없다.
- 읽기 순서: `JSON.parse` → `normalizeLegacyPlan` → `isValidPlan`. 하나라도 실패하면 `null`로 취급하고 키를 삭제한다. 예외를 던지지 않는다.
- 저장된 계획이 없을 때의 폼 기본값: `{ salary: 0, fixedCosts: [], presetId: 'p532', ratios: 50/30/10/10, payday: 25 }`

**`isValidDraft` 규칙** (하나라도 어기면 `false`, 예외 없음):
- `salary`: `typeof === 'number'`, `Number.isInteger`, 1 ≤ salary ≤ 100,000,000. 문자열 `"3000000"`은 `false`다.
- `fixedCosts`: 배열이고 길이 0–10이다.
  - 각 원소:
    - `id`는 빈 문자열이 아닌 string이다.
    - `name`은 string이고 trim 후 1–20자다.
    - `amount`는 number 정수이고 1–100,000,000이다.
    - `createdAt`과 `updatedAt`은 `isIsoTimestamp`를 통과한다.
  - 배열 안의 `id`가 모두 서로 다르다(PK 유일성).
  - `Σ amount < salary`다.
- `ratios`: `CATEGORY_ORDER`의 4개 키가 모두 있다. 각 값은 number 정수이고 0–100이며, 합계는 100이다.
- `payday`: number 정수이고 1–31이다.
- `presetId`: `'p532' | 'p442' | 'p622' | 'custom'` 중 하나다.

**`isValidPlan`**: `isValidDraft` 규칙을 모두 만족하고, 다음도 만족한다.
- `version === 1`
- `id`가 빈 문자열이 아닌 string
- `createdAt`과 `updatedAt`이 `isIsoTimestamp`를 통과

**`normalizeLegacyPlan`** (새 필드가 없던 예전 v1 데이터 호환, F1 AC-15):
- 입력이 객체이고 `version === 1`이고 `isIsoTimestamp(updatedAt)`일 때만 동작한다. 그 외에는 입력을 그대로 반환한다.
- **값이 `undefined`인 필드만** 채운다. 값은 있는데 타입이 틀리면 채우지 않고 그대로 두며, 이 경우 `isValidPlan`에서 걸러진다.
  - `id` → `'legacy-' + Date.parse(updatedAt).toString(36)`. 결정적이라 여러 번 읽어도 같은 id가 나온다.
  - `createdAt` → `updatedAt`
  - 각 `fixedCosts[i].createdAt`과 `.updatedAt` → 계획의 `updatedAt`
- 메모리에서만 채우고 localStorage에는 쓰지 않는다. 채운 값은 다음 `savePlan` 때 저장된다.
- `undefined` 확인은 `x.id === undefined`로 한다(AC-C6 때문에 `Object.hasOwn`은 쓰지 않는다).

**`isSamePlan`**: 다음을 모두 만족하면 `true`다.
- `salary`와 `payday`가 같다.
- 4개 `ratios` 값이 같다.
- `fixedCosts` 길이가 같고, 같은 인덱스끼리 `name.trim()`과 `amount`가 같다.
- `presetId`와 고정비의 `id`·`createdAt`·`updatedAt`은 비교하지 않는다.

### Allocation (계산 결과, 저장하지 않음)

```ts
export interface Allocation {
  fixedTotal: number;                     // Σ fixedCosts.amount
  available: number;                      // salary - fixedTotal
  amounts: Record<CategoryKey, number>;   // 정수 원
}
export function calculateAllocation(p: Pick<PlanDraft,'salary'|'fixedCosts'|'ratios'>): Allocation;
```

계산 규칙:
- `saving`, `emergency`, `leisure`는 각각 `Math.floor(available * ratio / 100)`로 구한다.
- `living`은 `available - (나머지 셋의 합)`이다. 내림하고 남은 잔액은 생활비에 흡수된다.
- 따라서 `ratios` 합계가 100이면 네 금액의 합은 항상 `available`과 같다.
- 전제: `calculateAllocation`은 `ratios` 합계가 100인 입력에서만 결과를 보장한다. 합계가 100이 아니면 호출하지 않는다.
- 잔액을 생활비에 흡수하는 규칙은 합계 100이 강제되는 `/result`(F4·F5)와 `/`(F6)에서만 적용된다. `/plan`의 비율 행 금액은 이 함수를 쓰지 않고 아래 `getRatioRowAmount`를 쓴다.

```ts
export function getRatioRowAmount(available: number, ratio: number): number | null;
// available ≤ 0 이면 null(화면에 '-원'), 아니면 Math.floor(available * ratio / 100). 결과는 항상 0 이상.
```
- `/plan`의 비율 행 4개(생활비 포함)는 모두 이 함수로 금액을 구한다. 비율 합계가 얼마든 음수가 나오지 않는다.
- 예: available 2,400,000, 55:35:10:10(합 110) → 1,320,000 / 840,000 / 240,000 / 240,000.

표시·집계 규칙 (단일 규칙):
- 카테고리 `key`는 `calculateAllocation(...).amounts[key] > 0`일 때만 **표시되고 집계된다**. 비율(`ratios[key]`)로는 판단하지 않는다.
- 이 규칙은 세 곳에 똑같이 적용한다: 결과 카드(`allocation-card`, F4), 홈 체크리스트 행(`checklist-row`, F6), `MonthRecord.eligible`.
- 예: `living` 비율이 0이어도 잔액 때문에 `amounts.living > 0`이면 생활비 카드와 행을 표시하고 eligible에 넣는다. 반대로 비율이 0보다 커도 내림한 금액이 0이면 표시하지 않고 eligible에서 뺀다.

예시 A:

| 항목 | 값 |
|---|---|
| 입력 | salary 3,000,000 / 고정비 월세 500,000 + 통신비 100,000 / 50:30:10:10 |
| fixedTotal | 600,000 |
| available | 2,400,000 |
| 생활비 / 저축 / 비상금 / 여가 | 1,200,000 / 720,000 / 240,000 / 240,000 |

- 저장된 예시 A 계획의 id·타임스탬프 기준값(AC에서 참조):
  - `id: "plan_a"`, `createdAt`과 `updatedAt`: `"2026-09-01T00:00:00.000Z"`
  - 고정비: `{ id: "fc_rent", ... }`, `{ id: "fc_phone", ... }`. 각각의 `createdAt`과 `updatedAt`은 `"2026-09-01T00:00:00.000Z"`다.

예시 B (잔액이 생활비로 가는 경우):

| 항목 | 값 |
|---|---|
| 입력 | available 1,234,567 / 50:30:10:10 |
| 저축 | 370,370 |
| 비상금 | 123,456 |
| 여가 | 123,456 |
| 생활비 | 617,285 (잔액 흡수) |

### MonthRecord (월별 이체 이행 기록)

```ts
export interface MonthRecord {
  id: string;                                 // PK. 그 달 기록을 처음 만들 때 createId(), 이후 유지
  month: string;                              // 'YYYY-MM' (getToday() 기준 달력 월). UNIQUE, records 객체 키와 같음
  planId: string | null;                      // FK → SalaryPlan.id (soft, NO ACTION). 마지막으로 성공한 토글 시점의 계획 id. 레거시 레코드는 null
  checked: Record<CategoryKey, boolean>;
  eligible: CategoryKey[];                    // 토글 시점 계획의 calculateAllocation().amounts[key] > 0 인 카테고리 (CATEGORY_ORDER 순, 표시·집계 규칙과 동일)
  rate: number;                               // round(eligible 중 checked 수 / eligible 수 * 100), 0–100 정수
  completedAt: string | null;                 // rate가 100이 된 시각(ISO), 100 미만으로 내려가면 null
  snapshot: { salary: number; available: number; ratios: Ratios };
  createdAt: string;                          // ISO 8601. 그 달 기록을 처음 만들 때 1회, 이후 불변
  updatedAt: string;                          // ISO 8601. 실제로 쓰는 토글마다 갱신
}
export interface RecordsStore { version: 1; records: Record<string, MonthRecord>; }
```
- localStorage 키: `paysplit:records:v1`
- 최대 24개월을 보관한다. 25번째 월이 생기면 가장 오래된 `month` 키를 삭제한다.
- 스토어 전체 검증: 다음 중 하나라도 해당하면 `{ version: 1, records: {} }`로 취급한다.
  - JSON 파싱 실패
  - 값이 `null`이거나 객체가 아님
  - `version !== 1`
  - `records`가 객체가 아님
- 레코드별 레거시 정규화(메모리에서만, F1 AC-16): **값이 `undefined`인 필드만** 채운다.
  - `id` → `'legacy-' + month`
  - `planId` → `null`
  - `createdAt` → `updatedAt`. 단 `updatedAt`이 `isIsoTimestamp`를 통과할 때만 채운다.
- 레코드별 검증: 정규화한 뒤 다음 중 하나라도 어긴 레코드는 **읽기 결과에서만 뺀다**. 나머지 레코드는 정상으로 쓴다.
  - 키가 `/^\d{4}-(0[1-9]|1[0-2])$/`에 맞고 `month`와 같다(UNIQUE 인덱스 무결성).
  - `id`가 빈 문자열이 아닌 string이다.
  - `planId`가 빈 문자열이 아닌 string이거나 `null`이다.
  - `createdAt`과 `updatedAt`이 `isIsoTimestamp`를 통과한다.
  - `completedAt`이 `null`이거나 `isIsoTimestamp`를 통과한다.
  - `rate`가 0–100 정수 number다.
  - `checked`의 4개 값이 boolean이다.
  - `eligible`이 `CategoryKey` 배열이다.
- 읽기만으로는 저장값을 다시 쓰지 않는다. 다음 `toggleRecordItem`이 실제로 쓸 때, 검증을 통과한 레코드만 정규화된 형태로 저장된다.
- 저장된 `eligible`과 `rate`는 마지막 토글 시점의 값이다. 홈(`/`) 화면은 이 저장값을 표시에 쓰지 않는다(F6 표시 규칙). 홈에 들어가기만 해서는 기록을 다시 쓰지 않는다.

### ReviewPromptState (리뷰 요청 1회 기록) — `src/lib/review.ts`

```ts
export interface ReviewPromptState {
  version: 1;
  id: 'review-prompt';     // PK(고정값, 싱글톤)
  createdAt: string;       // 리뷰 요청을 호출한 시각(ISO)
  updatedAt: string;       // 한 번만 쓰므로 createdAt과 같다
}
```
- localStorage 키: `paysplit:review:v1`
- 키가 있으면 값과 상관없이 "이미 요청함"으로 본다. 예전 값 `'1'`이나 파싱할 수 없는 값도 마찬가지다. 그래서 이 키는 손상 복구나 삭제를 하지 않는다.

### 저장소 API — `src/lib/storage.ts`

```ts
export type SaveError = 'QUOTA';
export function loadPlan(): SalaryPlan | null;
export function savePlan(draft: PlanDraft): { ok: true; plan: SalaryPlan } | { ok: false; error: SaveError };
export function loadRecords(): RecordsStore;
export function toggleRecordItem(key: CategoryKey, value: boolean):
  | { ok: true; record: MonthRecord }
  | { ok: false; error: 'QUOTA' | 'NO_PLAN' };
```
- 어떤 함수도 예외를 던지지 않는다.
- `savePlan(draft)` 동작:
  1. `existing = loadPlan()`
  2. `id = existing?.id ?? createId()`
  3. `createdAt = existing?.createdAt ?? nowIso()`
  4. `updatedAt = max(nowIso(), createdAt)`
  5. `fixedCosts`는 draft에 있는 값(각자의 id·타임스탬프 포함)을 그대로 저장한다.
  6. `{ version: 1, ...draft, id, createdAt, updatedAt }`를 `setItem`한다.
  - 싱글톤 행이라서 덮어써도 `id`와 `createdAt`은 유지된다.
  - `setItem`에서 `QuotaExceededError`(또는 다른 예외)를 만나면 `{ ok: false, error: 'QUOTA' }`를 반환한다. 이때 기존 `paysplit:plan:v1` 값은 바뀌지 않는다.
  - 충돌 여부는 판단하지 않는다(항상 덮어쓴다). 덮어쓰기 확인은 화면(F4 AC-9)이 맡는다.
- `toggleRecordItem` 동작:
  1. `loadPlan()`이 `null`이면 아무것도 쓰지 않고 `{ ok: false, error: 'NO_PLAN' }`을 반환한다.
  2. `loadRecords()`(정규화·검증 후)에서 `getToday()` 기준 `'YYYY-MM'` 기록 `existing`을 찾는다.
  3. 다음 값을 계산한다.
     - `checked`: 기존 값, 없으면 모두 `false`. 여기에 `[key]: value`를 적용한다.
     - `eligible`, `rate`, `snapshot`: 현재 계획의 `calculateAllocation` 결과에서 구한다.
     - `planId`: 현재 계획의 `id`다.
     - `completedAt` 규칙:
       - 갱신 전 rate가 100 미만이고 갱신 후 100이면 `nowIso()`를 넣는다.
       - 갱신 전후 모두 100이면 기존 값을 유지한다.
       - 갱신 후 100 미만이면 `null`이다.
  4. **멱등**: `existing`이 있고 새로 계산한 `checked`, `eligible`, `rate`, `completedAt`, `snapshot`, `planId`가 모두 기존 값과 같으면 `setItem`을 호출하지 않고 `{ ok: true, record: existing }`을 반환한다. `updatedAt`도 바뀌지 않는다.
  5. 그 외에는 레코드를 만든다.
     - `id = existing?.id ?? createId()`
     - `createdAt = existing?.createdAt ?? nowIso()`
     - `updatedAt = max(nowIso(), createdAt)`
     - 24개월 정리를 적용한 뒤 `setItem`한다. 이때 다른 레코드도 정규화된 형태로 함께 저장된다.
  6. `setItem`에서 예외가 나면 `{ ok: false, error: 'QUOTA' }`를 반환한다. `paysplit:records:v1` 값은 호출 전과 같다.
  7. 성공하면 `{ ok: true, record }`(갱신된 이번 달 기록)를 반환한다.

### 파생 타입 (저장하지 않음) — `src/lib/insights.ts`

```ts
export interface BracketScenario { salary: number; available: number; saving: number; savingYear: number; isCurrent: boolean; }
export function getBracketScenarios(p: Pick<PlanDraft,'salary'|'fixedCosts'|'ratios'>): BracketScenario[];
// 후보: salary-1,000,000 / -500,000 / 0 / +500,000 / +1,000,000
// 후보 월급이 fixedTotal 이하이거나 100,000,000을 넘으면 제외. 월급 오름차순.

export interface TrendPoint { month: string; rate: number | null; }  // 기록 없는 달은 null
export interface TrendSummary { points: TrendPoint[]; average: number | null; streak: number; }
export function getTrend(today: Date, store: RecordsStore): TrendSummary;
```

`getTrend` 규칙:
- `points`: 이번 달을 포함한 최근 6개월을 오래된 순으로 담는다.
- `average`: rate가 null이 아닌 달의 평균을 반올림한다. 그런 달이 없으면 `null`이다.
- `streak`: rate가 100인 달이 연속된 개월 수다.
  - 이번 달이 100이면 이번 달부터 거꾸로 센다.
  - 이번 달이 100 미만이거나 기록이 없으면 지난달부터 거꾸로 센다.

### D-day 유틸 — `src/lib/dday.ts`

```ts
export function getNextPayday(today: Date, payday: number): { date: Date; dday: number; label: string };
// 이번 달 월급일(payday가 말일보다 크면 말일로 보정)이 오늘 이상이면 이번 달, 아니면 다음 달(동일 보정)
// label: dday === 0 → 'D-DAY', 그 외 'D-{dday}'
```

| 오늘 | payday | 다음 월급일 | label |
|---|---|---|---|
| 2026-09-29 | 25 | 2026-10-25 | D-26 |
| 2026-09-29 | 30 | 2026-09-30 | D-1 |
| 2026-09-29 | 31 | 2026-09-30 (9월 말일로 보정) | D-1 |
| 2026-09-25 | 25 | 2026-09-25 | D-DAY |
| 2027-02-01 | 31 | 2027-02-28 | D-27 |

### 용량 추정

| 키 | 1건 크기 | 최대 건수 | 최대 용량 |
|---|---|---|---|
| `paysplit:plan:v1` | 약 1.8KB (고정비 10개 × 약 130B, 고정비마다 타임스탬프 2개 포함) | 1 | 약 1.8KB |
| `paysplit:records:v1` | 약 450B (id·planId·createdAt 포함) | 24 | 약 10.8KB |
| `paysplit:review:v1` | 약 100B | 1 | 약 0.1KB |
| **합계** | | | **약 13KB (5MB 한도의 0.3%)** |

---

## Feature List

### F1. 배분 계산 엔진 & 저장소 (데이터 계층)
- **Description**
  - 월급, 고정비, 비율을 받아 가용 금액과 4개 통장별 배분액을 계산하는 순수 함수를 만든다.
  - 계획(`SalaryPlan`), 월별 기록(`RecordsStore`), 리뷰 요청 상태(`ReviewPromptState`)를 localStorage에 안전하게 읽고 쓰는 저장소 모듈을 만든다.
  - 이 모듈은 PK·타임스탬프·FK 규칙(스키마 개요)을 코드로 보장한다.
  - UI 없이 단위 테스트만으로 검증한다.
- **Data**: `SalaryPlan`, `FixedCost`, `Allocation`, `MonthRecord`, `RecordsStore`, `ReviewPromptState`, `PRESETS`
- **API**: 없음 (localStorage만 사용)
- **테스트 공통 전제**: 특별한 말이 없으면 `getToday()` mock은 `new Date('2026-09-29T01:00:00.000Z')`이고, 이때 `nowIso()`는 `"2026-09-29T01:00:00.000Z"`다.
- **Requirements**
  - **AC-1 [U][P0]: Scenario: 배분 계산**
    - Given `{ salary: 3000000, fixedCosts: [{name:'월세',amount:500000},{name:'통신비',amount:100000}], ratios: {living:50,saving:30,emergency:10,leisure:10} }`
    - When `calculateAllocation`을 호출하면
    - Then `{ fixedTotal: 600000, available: 2400000, amounts: { living: 1200000, saving: 720000, emergency: 240000, leisure: 240000 } }`를 반환한다.
  - **AC-2 [U][P0]: Scenario: 내림 잔액은 생활비로**
    - Given available이 1,234,567이 되는 입력과 50:30:10:10
    - When `calculateAllocation`을 호출하면
    - Then amounts는 `{ living: 617285, saving: 370370, emergency: 123456, leisure: 123456 }`이다.
    - And 네 값의 합은 1,234,567이다.
  - **AC-3 [E][P0]: Scenario: 계획 처음 저장·불러오기**
    - Given `paysplit:plan:v1` 키가 없음
    - And draft는 예시 A다. 고정비는 `{ id: "fc_rent", createdAt: "2026-09-28T00:00:00.000Z", updatedAt: "2026-09-28T00:00:00.000Z", ... }` 외 1건이다.
    - When `savePlan(draft)`를 호출하면
    - Then `localStorage['paysplit:plan:v1']`에 다음이 저장된다.
      - `version: 1`
      - 빈 문자열이 아닌 `id`
      - `createdAt`과 `updatedAt`이 모두 `"2026-09-29T01:00:00.000Z"`
    - And 저장된 `fixedCosts[0]`의 `id`, `createdAt`, `updatedAt`은 draft 값 그대로다(`"fc_rent"`, `"2026-09-28T00:00:00.000Z"`).
    - And `loadPlan()`은 같은 salary/fixedCosts/ratios/payday/id/createdAt/updatedAt을 반환한다.
  - **AC-4 [E][P0]: Scenario: 월 기록 토글 (새 기록 생성)**
    - Given 예시 A 계획(`id: "plan_a"`), 기록 없음
    - When `toggleRecordItem('saving', true)`를 호출하면
    - Then `records['2026-09']`의 값은 다음과 같다.
      - `checked.saving`: `true`
      - `eligible`: 4개
      - `rate`: `25`
      - `completedAt`: `null`
    - And `id`는 빈 문자열이 아니고, `planId`는 `"plan_a"`, `month`는 `"2026-09"`다.
    - And `createdAt`과 `updatedAt`은 모두 `"2026-09-29T01:00:00.000Z"`다.
  - **AC-5 [W][P1] · HTTP 대응 422: Scenario: 손상된 계획 데이터**
    - Given `localStorage['paysplit:plan:v1'] = '{broken'`
    - When `loadPlan()`을 호출하면
    - Then `null`을 반환하고 예외를 던지지 않는다.
    - And 해당 키가 삭제된다.
    - 에러 문구: 없음(반환값 `null`, `console.error` 0회)
  - **AC-6 [W][P1] · HTTP 대응 507: Scenario: 저장 공간 부족**
    - Given `localStorage.setItem`이 `QuotaExceededError`를 던지도록 mock
    - When `savePlan(draft)`를 호출하면
    - Then `{ ok: false, error: 'QUOTA' }`를 반환하고 예외를 던지지 않는다.
    - And 기존 `paysplit:plan:v1` 문자열은 호출 전과 같다.
    - 에러 문구: 반환값 `error: 'QUOTA'`(화면 문구는 F4 AC-7)
  - **AC-7 [S][P1]: Scenario: 빈 저장소**
    - While 두 키가 모두 없는 상태에서는
    - Then `loadPlan()`은 `null`, `loadRecords()`는 `{ version: 1, records: {} }`를 반환한다.
  - **AC-8 [W][P1]: Scenario: 24개월 초과 정리**
    - Given 2024-10부터 2026-09까지 24개월 기록(모두 유효한 id·planId·타임스탬프)
    - When `getToday()` = 2026-10-05에 `toggleRecordItem('living', true)`를 호출하면
    - Then `records`의 키는 24개다.
    - And `'2024-10'`은 없고 `'2026-10'`이 있다.
    - And 남은 23개 기존 레코드의 `id`와 `createdAt`은 호출 전과 같다.
  - **AC-9 [W][P1] · HTTP 대응 507: Scenario: 기록 저장 공간 부족**
    - Given 예시 A 계획, 저장값 `records['2026-09'].checked.saving = false`, `localStorage.setItem`이 `QuotaExceededError`를 던지도록 mock
    - When `toggleRecordItem('saving', true)`를 호출하면
    - Then `{ ok: false, error: 'QUOTA' }`를 반환하고 예외를 던지지 않는다.
    - And `localStorage['paysplit:records:v1']` 문자열은 호출 전과 완전히 같다.
    - 에러 문구: 반환값 `error: 'QUOTA'`(화면 문구는 F6 AC-6)
  - **AC-10 [W][P1] · HTTP 대응 412: Scenario: 계획 없이 토글**
    - Given `paysplit:plan:v1` 키가 없음
    - When `toggleRecordItem('saving', true)`를 호출하면
    - Then `{ ok: false, error: 'NO_PLAN' }`을 반환한다.
    - And `paysplit:records:v1`은 생기거나 바뀌지 않는다.
    - 에러 문구: 반환값 `error: 'NO_PLAN'`
  - **AC-11 [W][P1] · HTTP 대응 409: Scenario: 같은 값으로 다시 토글(멱등)**
    - Given 예시 A 계획(`id: "plan_a"`)
    - And `records['2026-09']`의 값은 다음과 같다.
      - `id`: `"rec_0901"`, `planId`: `"plan_a"`
      - checked 4개 모두 `true`, `rate`: `100`
      - `completedAt`: `"2026-09-10T09:00:00.000Z"`
      - `createdAt`: `"2026-09-01T09:00:00.000Z"`, `updatedAt`: `"2026-09-10T09:00:00.000Z"`
      - `snapshot`: 예시 A 값
    - When `toggleRecordItem('saving', true)`를 호출하면
    - Then `{ ok: true }`를 반환한다.
    - And `localStorage.setItem`은 호출되지 않고 `paysplit:records:v1` 문자열은 호출 전과 같다.
    - And `checked`, `eligible`, `rate`(100), `completedAt`, `id`, `createdAt`, `updatedAt`은 모두 그대로다.
    - And `records`의 키 개수는 그대로다(같은 월의 기록이 새로 생기지 않음).
    - 에러 문구: 없음(성공 반환)
  - **AC-12 [W][P1] · HTTP 대응 422: Scenario: 타입이 잘못된 계획 데이터**
    - Given `localStorage['paysplit:plan:v1']`에 JSON 파싱은 되지만 정규화 후 `isValidPlan`을 어기는 값이 있다. 예:
      - (a) 예시 A에서 `"salary": "3000000"`(문자열)
      - (b) 예시 A에서 ratios 합계 90
      - (c) 예시 A에서 `"payday": 0`
      - (d) `"version": 2`
      - (e) 예시 A에서 두 고정비의 `id`가 모두 `"fc_rent"`(PK 중복)
      - (f) 예시 A에서 `"createdAt": "not-a-date"`
      - (g) 예시 A에서 `"id": 123`(number)
      - (h) 예시 A에서 `fixedCosts[0].updatedAt`이 `null`
    - When `loadPlan()`을 호출하면
    - Then 여덟 경우 모두 `null`을 반환하고 예외를 던지지 않는다.
    - And `paysplit:plan:v1` 키가 삭제된다.
    - 에러 문구: 없음(반환값 `null`, `console.error` 0회)
  - **AC-13 [E][P0]: Scenario: 계획을 다시 저장하면 id·createdAt 유지**
    - Given 예시 A 계획이 저장되어 있다(`id: "plan_a"`, `createdAt`과 `updatedAt`: `"2026-09-01T00:00:00.000Z"`).
    - When `getToday()` = `new Date('2026-09-29T02:00:00.000Z')`에서 salary만 3,500,000인 draft로 `savePlan`을 호출하면
    - Then `{ ok: true }`를 반환한다.
    - And `loadPlan()`의 `id`는 `"plan_a"`, `createdAt`은 `"2026-09-01T00:00:00.000Z"`, `updatedAt`은 `"2026-09-29T02:00:00.000Z"`, `salary`는 `3500000`이다.
    - And 고정비 2건의 `id`, `createdAt`, `updatedAt`은 저장 전과 같다.
  - **AC-14 [E][P1]: Scenario: 기록을 갱신하면 id·createdAt 유지, updatedAt 갱신**
    - Given AC-4를 실행한 직후(`records['2026-09']`, `createdAt` `"2026-09-29T01:00:00.000Z"`)
    - When `getToday()` = `new Date('2026-09-29T03:00:00.000Z')`에서 `toggleRecordItem('living', true)`를 호출하면
    - Then `records['2026-09']`의 `id`와 `createdAt`은 AC-4 결과와 같다.
    - And `updatedAt`은 `"2026-09-29T03:00:00.000Z"`, `rate`는 `50`이다.
  - **AC-15 [W][P1] · HTTP 대응 422: Scenario: 레거시 계획(새 필드 누락) 정규화**
    - Given `paysplit:plan:v1`에 예시 A가 저장되어 있다. 다만 `id`와 `createdAt` 키가 없고, 각 고정비에 `createdAt`과 `updatedAt` 키가 없다. `updatedAt`은 `"2026-09-01T00:00:00.000Z"`다.
    - When `loadPlan()`을 두 번 호출하면
    - Then 두 번 모두 null이 아닌 계획을 반환한다.
      - `id`는 `'legacy-' + Date.parse("2026-09-01T00:00:00.000Z").toString(36)`이고, 두 번의 결과가 같다.
      - `createdAt`은 `"2026-09-01T00:00:00.000Z"`다.
      - 각 고정비의 `createdAt`과 `updatedAt`은 `"2026-09-01T00:00:00.000Z"`다.
    - And `paysplit:plan:v1` 문자열은 호출 전과 같다(읽기로는 쓰지 않는다).
    - When 이어서 `savePlan(같은 draft)`를 호출하면
    - Then 저장된 JSON에 위의 `id`와 `createdAt`이 들어간다.
    - 에러 문구: 없음
  - **AC-16 [W][P1] · HTTP 대응 422: Scenario: 레거시 기록(새 필드 누락) 정규화**
    - Given `records['2026-08']`에 `id`, `planId`, `createdAt` 키가 없고 `updatedAt`은 `"2026-08-31T12:00:00.000Z"`다. 나머지 필드는 유효하다.
    - When `loadRecords()`를 호출하면
    - Then `records['2026-08']`은 결과에 포함된다.
      - `id`: `"legacy-2026-08"`
      - `planId`: `null`
      - `createdAt`: `"2026-08-31T12:00:00.000Z"`
    - And `paysplit:records:v1` 문자열은 호출 전과 같다.
    - When 이어서 예시 A 계획으로 `toggleRecordItem('saving', true)`(2026-09)를 호출하면
    - Then 저장된 `records['2026-08']`에 위 세 필드가 채워진 채로 기록된다.
    - 에러 문구: 없음
  - **AC-17 [W][P1] · HTTP 대응 422: Scenario: 기록 공통 필드 타입 오류**
    - Given `records`에 다음 레코드가 있다.
      - `2026-06`: `"id": 42`(number)
      - `2026-07`: `"createdAt": "yesterday"`
      - `2026-08`: `"planId": ""`(빈 문자열)
      - `2026-09`: 유효함
    - When `loadRecords()`를 호출하면
    - Then 결과 `records`의 키는 `['2026-09']` 하나다.
    - And 예외가 없고 `console.error`는 0회다.
    - And `paysplit:records:v1` 문자열은 호출 전과 같다.
    - 에러 문구: 없음(잘못된 레코드는 조용히 뺀다)
  - **AC-18 [W][P1]: Scenario: 부모 계획 삭제 시 기록 유지(NO ACTION)와 planId 재연결**
    - Given `records['2026-09']`: `id` `"rec_0901"`, `planId` `"plan_old"`, `createdAt` `"2026-09-01T09:00:00.000Z"`, checked는 저축만 `true`
    - And `paysplit:plan:v1 = '{broken'`
    - When `loadPlan()`을 호출하면
    - Then `null`을 반환하고 계획 키가 삭제된다.
    - And `paysplit:records:v1` 문자열은 그대로다. `planId` `"plan_old"`도 그대로 남는다(끊긴 참조 허용).
    - When 예시 A draft로 `savePlan`을 호출하고 `toggleRecordItem('living', true)`를 호출하면
    - Then 새 계획의 `id`는 `"plan_old"`가 아닌 새 값이다.
    - And `records['2026-09'].planId`는 새 계획 `id`와 같다.
    - And `records['2026-09']`의 `id`(`"rec_0901"`)와 `createdAt`은 그대로다.
  - **AC-19 [U][P1]: Scenario: 리뷰 요청 상태 레코드**
    - Given `paysplit:review:v1` 키가 없음
    - When `requestReviewOnce()`를 두 번 호출하면
    - Then 리뷰 요청은 1회만 호출된다.
    - And 저장값은 `{ version: 1, id: 'review-prompt', createdAt: "2026-09-29T01:00:00.000Z", updatedAt: "2026-09-29T01:00:00.000Z" }`다.
    - Given 키의 값이 예전 형식 `'1'`이면
    - When `requestReviewOnce()`를 호출하면
    - Then 리뷰 요청은 호출되지 않고 저장값도 `'1'` 그대로다.

### F2. 계획 입력 화면 — 월급·고정비·월급날
- **Description**
  - `/plan` 화면에서 월급, 고정비 목록(최대 10개), 월급날(1–31)을 입력한다.
  - 저장된 계획이 있으면 그 값으로 폼을 채운다. 고정비의 `id`와 타임스탬프도 그대로 가져온다.
  - 입력값이 유효하면 하단 고정 버튼으로 초안을 결과 화면에 넘긴다.
  - 숫자 필드(월급, 월급날, 고정비 금액)는 입력 원문 문자열을 상태로 보관하고 `parseAmountInput`으로 해석한다.
    - 해석 결과가 `ok`일 때만 콤마 포맷을 적용한다.
    - 그 외에는 원문을 그대로 보여준다(자동 보정·삭제 없음).
  - 고정비를 추가하면 `id = createId()`, `createdAt = updatedAt = nowIso()`인 `FixedCost`를 만든다. 삭제는 `id`로 필터한다.
- **Data**: `PlanDraft`, `FixedCost` (읽기: `paysplit:plan:v1`)
- **API**: 없음
- **Requirements**
  - **AC-1 [E][P0]: Scenario: 월급 입력과 가용 금액 미리보기**
    - Given 빈 폼
    - When 월급 `TextField`(inputMode="numeric")에 `3000000`을 입력하고, 고정비 `{ name: '월세', amount: 500000 }`와 `{ name: '통신비', amount: 100000 }`을 추가하면
    - Then 월급 필드 아래에 보조 문구 `"300만 원"`이 표시된다.
    - And `data-testid="available-preview"`에 `"남는 돈 2,400,000원"`이 표시된다.
  - **AC-2 [E][P0]: Scenario: 결과 화면으로 이동**
    - Given 월급 3,000,000, 고정비 합 600,000, 비율 합 100, 월급날 25
    - When SubmitFooter `"배분 결과 보기"`를 탭하면
    - Then `navigate('/result', { state: { draft: PlanDraft } })`가 호출된다.
    - And `draft.salary`는 `3000000`, `draft.payday`는 `25`이다.
    - And `draft`에는 `id`, `createdAt`, `updatedAt`, `version` 키가 없다.
    - And `isValidDraft(draft)`는 `true`다.
  - **AC-3 [W][P1] · HTTP 대응 400: Scenario: 월급 미입력**
    - When 월급이 `0`이거나 빈 값인 상태에서 `"배분 결과 보기"`를 탭하면
    - Then 월급 TextField에 에러 문구가 표시되고 이동하지 않는다.
    - 에러 문구: `"월급을 입력해주세요"`
  - **AC-4 [W][P1] · HTTP 대응 400: Scenario: 월급 상한 초과**
    - When 월급에 `100000001`을 입력하면
    - Then 에러 문구가 표시되고 SubmitFooter 버튼이 disabled 된다.
    - 에러 문구: `"1억 원 이하로 입력해주세요"`
  - **AC-5 [W][P1] · HTTP 대응 400: Scenario: 고정비가 월급 이상**
    - Given 월급 1,000,000
    - When 고정비 `{ name: '월세', amount: 1000000 }`을 추가하면
    - Then 에러 문구가 표시되고 SubmitFooter 버튼이 disabled 된다.
    - 에러 문구: `"고정비가 월급보다 많아요. 금액을 확인해주세요"`
  - **AC-6 [W][P1] · HTTP 대응 400: Scenario: 고정비 입력 오류·개수 제한**
    - 고정비 추가 BottomSheet에서 아래처럼 `"추가"`를 탭하면 각 문구가 표시된다.

      | 입력 | 표시 위치 | 에러 문구 |
      |---|---|---|
      | `{ name: '', amount: 50000 }` | 이름 필드 | `"항목 이름을 입력해주세요"` |
      | `{ name: '보험', amount: 0 }` | 금액 필드 | `"금액을 입력해주세요"` |
      | trim 후 21자 이상인 이름(예: `'가'.repeat(21)`) | 이름 필드 | `"항목 이름은 20자 이내로 입력해주세요"` |
      | `{ name: '보험', amount: 100000001 }` | 금액 필드 | `"1억 원 이하로 입력해주세요"` |

    - And 위 네 가지 오류에서는 BottomSheet가 닫히지 않고 고정비 목록 길이가 바뀌지 않는다.
    - When 이미 10개인 상태에서 `"고정비 추가"`를 탭하면
    - Then Toast `"고정비는 최대 10개까지 추가할 수 있어요"`가 표시되고 BottomSheet가 열리지 않는다.
  - **AC-7 [W][P1] · HTTP 대응 400: Scenario: 월급날 범위**
    - When 월급날 TextField에 `32`나 `0`을 입력하면
    - Then 에러 문구가 표시되고 SubmitFooter 버튼이 disabled 된다.
    - 에러 문구: `"1~31 사이 날짜를 입력해주세요"`
  - **AC-7a [W][P1] · HTTP 대응 400: Scenario: 월급날 빈 값·정수 아님·문자**
    - Given 폼은 월급날을 입력 원문 문자열로 보관하고, `PlanDraft.payday`(number)는 `parseAmountInput` 결과가 `ok`이고 1–31일 때만 만든다.
    - When 월급날 TextField를 모두 지워 빈 문자열이 되거나, 정수가 아닌 값(예: 붙여넣은 `2.5`, `-`, `abc`)이 되면
    - Then 월급날 필드에 에러 문구가 표시되고 SubmitFooter 버튼이 disabled 된다.
    - And 입력 원문(`2.5`, `-`, `abc`)이 필드에 그대로 남는다.
    - And 빈 월급날은 `25`(또는 다른 값)로 자동 복원되지 않는다. blur한 뒤에도 필드는 빈 값이고 에러 문구도 그대로 남는다.
    - When 이어서 필드를 지우고 `10`을 입력하면
    - Then 에러 문구가 사라지고, 다른 필드가 유효하면 SubmitFooter 버튼이 enabled 된다.
    - And 이때 제출한 `draft.payday`는 `10`이다.
    - 에러 문구: `"1~31 사이 날짜를 입력해주세요"`
  - **AC-8 [S][P1]: Scenario: 초기 로드와 빈 고정비 상태**
    - While 저장된 계획이 없고 고정비가 0개인 상태에서는
    - Then 월급 필드는 비어 있고, 월급날은 `25`, 프리셋은 `p532`가 선택되어 있다.
    - And 고정비 영역에 `"월세·통신비처럼 매달 나가는 돈을 추가해보세요"` 문구와 `"고정비 추가"` Button이 표시된다.
    - While 예시 A 계획이 저장된 상태에서는
    - Then 월급 필드에 `3,000,000`이 채워지고 고정비 2행이 채워진다.
    - And 이 상태로 바로 제출한 `draft.fixedCosts`의 `id`는 `["fc_rent","fc_phone"]`이고, 각 `createdAt`과 `updatedAt`은 `"2026-09-01T00:00:00.000Z"` 그대로다.
  - **AC-9 [W][P1] · HTTP 대응 400: Scenario: 가용 금액을 계산할 수 없는 경우의 미리보기**
    - Given 고정비 `{ name: '월세', amount: 500000 }`이 있는 상태
    - When 월급이 빈 값이거나 `0`이면
    - Then `data-testid="available-preview"`에 `"남는 돈 -원"`이 표시된다.
    - When 월급이 `400000`(고정비 합 이하)이면
    - Then `available-preview`에 `"남는 돈 -원"`이 표시되고, AC-5 에러 문구 `"고정비가 월급보다 많아요. 금액을 확인해주세요"`도 함께 표시된다.
    - And 어떤 경우에도 `available-preview`에 음수 금액이나 `-` 부호가 붙은 숫자가 표시되지 않는다.
  - **AC-10 [W][P1] · HTTP 대응 400: Scenario: 월급에 숫자가 아닌 값 입력**
    - Given 고정비 `{ name: '월세', amount: 500000 }`이 있는 폼
    - When 월급 TextField에 아래 값을 입력하거나 붙여넣으면
    - Then 각 행의 에러 문구가 월급 필드에 표시된다.

      | 입력 원문 | `parseAmountInput` | 에러 문구 |
      |---|---|---|
      | `abc` | `invalid` | `"숫자만 입력해주세요"` |
      | `3,000원` | `invalid` | `"숫자만 입력해주세요"` |
      | `-500000` | `negative` | `"0보다 큰 금액을 입력해주세요"` |
      | `3000000.5` | `decimal` | `"원 단위로 입력해주세요"` |

    - And 네 경우 모두 다음을 만족한다.
      - SubmitFooter 버튼이 disabled 된다.
      - `available-preview`는 `"남는 돈 -원"`이다.
      - 보조 문구(`formatManwon`)는 표시되지 않는다.
      - 필드에는 입력 원문이 그대로 남는다(문자 자동 삭제 없음).
    - When 필드를 지우고 `3000000`을 입력하면
    - Then 에러 문구가 사라지고, 필드에 `3,000,000`, 보조 문구 `"300만 원"`, `available-preview`에 `"남는 돈 2,500,000원"`이 표시된다.
    - When `3,000,000` 또는 ` 3000000 `(앞뒤 공백)을 붙여넣으면
    - Then 에러 없이 월급 3,000,000으로 해석된다.
  - **AC-11 [W][P1] · HTTP 대응 400: Scenario: 고정비 금액 타입 오류·공백 이름**
    - Given 고정비 추가 BottomSheet가 열려 있고 고정비가 0개인 상태
    - When 아래 값으로 `"추가"`를 탭하면
    - Then 각 행의 필드에 에러 문구가 표시된다.

      | 이름 | 금액 원문 | 표시 필드 | 에러 문구 |
      |---|---|---|---|
      | `보험` | `abc` | 금액 | `"숫자만 입력해주세요"` |
      | `보험` | `-50000` | 금액 | `"0보다 큰 금액을 입력해주세요"` |
      | `보험` | `50000.5` | 금액 | `"원 단위로 입력해주세요"` |
      | `보험` | (빈 값) | 금액 | `"금액을 입력해주세요"` |
      | `"   "`(공백만) | `50000` | 이름 | `"항목 이름을 입력해주세요"` |

    - And 모든 경우에 BottomSheet가 닫히지 않고 고정비 목록 길이는 0으로 유지된다.
    - When `getToday()` = `new Date('2026-09-29T01:00:00.000Z')`에서 이름 `보험`, 금액 `50,000`으로 `"추가"`를 탭하면
    - Then BottomSheet가 닫히고 고정비 1행(`보험 · 50,000원`)이 추가된다.
    - And 추가된 `FixedCost`의 `id`는 빈 문자열이 아니고, `createdAt`과 `updatedAt`은 모두 `"2026-09-29T01:00:00.000Z"`다.
    - When 같은 이름·금액으로 한 번 더 추가하면
    - Then 두 행의 `id`는 서로 다르다(A10: 이름 중복 허용, PK 유일).

### F3. 비율 프리셋 & 직접 조정
- **Description**
  - `/plan` 화면 안의 비율 블록이다.
  - Chip으로 5:3:2 / 4:4:2 / 6:2:2 프리셋을 고르거나, 카테고리별 −/+ 버튼으로 5%p씩 직접 조정한다.
  - 합계가 100%일 때만 결과로 넘어갈 수 있다.
  - 비율 행 금액은 합계와 관계없이 행마다 `getRatioRowAmount(available, ratio)`로 계산한다. 생활비 행도 잔액을 흡수하지 않는다.
- **Data**: `Ratios`, `PresetId`, `PRESETS`
- **API**: 없음
- **Requirements**
  - **AC-1 [E][P0]: Scenario: 프리셋 선택**
    - Given 월급 3,000,000, 고정비 600,000
    - When ChipItem `"4:4:2 저축 집중"`을 탭하면
    - Then ratios는 `{ living: 40, saving: 40, emergency: 10, leisure: 10 }`가 된다.
    - And 저축 행에 `"40% · 960,000원"`이 표시된다.
  - **AC-2 [E][P0]: Scenario: 직접 조정 시 custom 전환**
    - Given 프리셋 `p532`
    - When 저축 행의 `"+"` Button을 탭하면
    - Then 저축은 `35%`가 되고, 선택된 Chip이 `"직접 조정"`으로 바뀐다(presetId `'custom'`).
    - And 합계 표시는 `"합계 105%"`가 된다.
    - And 월급 3,000,000, 고정비 600,000인 상태라면 비율 행은 `"생활비 50% · 1,200,000원"`, `"저축 35% · 840,000원"`, `"비상금 10% · 240,000원"`, `"여가 10% · 240,000원"`이다.
  - **AC-3 [U][P0]: Scenario: 합계 표시**
    - The system shall 비율 블록 하단의 `data-testid="ratio-sum"`에 항상 `"합계 {n}%"`를 표시한다.
    - n이 100일 때만 SubmitFooter 버튼이 enabled 상태다.
  - **AC-4 [W][P1] · HTTP 대응 400: Scenario: 합계 불일치**
    - Given ratios `{ living: 50, saving: 30, emergency: 10, leisure: 0 }`
    - Then 에러 문구가 표시되고 SubmitFooter 버튼이 disabled 된다.
    - 에러 문구: `"비율 합계를 100%로 맞춰주세요 (현재 90%)"`(`{n}`은 현재 합계)
  - **AC-5 [W][P1] · HTTP 대응 400: Scenario: 경계값**
    - Given 여가가 `0%`이면 여가 행의 `"-"` Button이 disabled 된다.
    - Given 생활비가 `100%`이면 생활비 행의 `"+"` Button이 disabled 된다.
    - And 어떤 값도 0 미만이나 100 초과가 되지 않는다.
    - 에러 문구: 없음(Button disabled로 입력 자체를 막음)
  - **AC-6 [S][P1]: Scenario: 월급 미입력 시 금액 자리**
    - While 월급이 0인 상태에서는
    - Then 각 비율 행은 `"50% · -원"`처럼 금액 자리에 `-`를 표시한다.
    - And 월급이 고정비 합 이하(가용 금액 ≤ 0)일 때와 월급 필드가 F2 AC-10 오류 상태일 때도 똑같이 `-원`을 표시한다.
  - **AC-7 [E][P2]: Scenario: 프리셋으로 되돌리기**
    - Given presetId `'custom'`, ratios 50/30/10/10
    - When 이 상태로 저장된 계획을 다시 로드하면
    - Then presetId는 `'p532'`로 인식되어 `"5:3:2 기본"` Chip이 선택된다.
  - **AC-8 [W][P1] · HTTP 대응 400: Scenario: 합계 ≠ 100일 때 행 금액**
    - Given 월급 3,000,000, 고정비 600,000, ratios `{ living: 100, saving: 30, emergency: 10, leisure: 10 }`(합 150)
    - Then 비율 행은 `"생활비 100% · 2,400,000원"`, `"저축 30% · 720,000원"`, `"비상금 10% · 240,000원"`, `"여가 10% · 240,000원"`이다.
    - And 어떤 비율 행에도 음수 금액이나 `-` 부호가 붙은 숫자가 표시되지 않는다.
    - And `ratio-sum`은 `"합계 150%"`이고 SubmitFooter 버튼은 disabled다.
    - 에러 문구: `"비율 합계를 100%로 맞춰주세요 (현재 150%)"`

### F4. 배분 결과 화면 — 무료 층 & 계획 저장
- **Description**
  - `/result` 화면에서 가용 금액을 히어로로, 4개 통장 배분액을 카드로 보여준다. 이것이 앱의 핵심 답(무료 층)이다.
  - `"이 계획 저장하기"`로 계획을 localStorage에 저장하고, 공유와 리뷰 요청을 제공한다.
  - 이미 다른 계획이 저장되어 있으면 덮어쓰기 전에 확인을 받는다.
  - 덮어쓰기는 싱글톤 계획 행을 갱신하는 것이다. `id`와 `createdAt`은 유지되고 `updatedAt`만 바뀐다.
- **Data**: `PlanDraft`, `SalaryPlan`, `Allocation`
- **API**: 없음
- **Requirements**
  - **AC-1 [U][P0]: Scenario: 무료 층은 광고와 무관하게 보인다**
    - Given 광고가 한 번도 뜨지 않는 환경(슬롯 ID 미설정, 광고 로드 실패, 타임아웃. 이때 템플릿 TossRewardAd는 게이트를 자동으로 연다)
    - When 사용자가 예시 A 초안으로 `/result`에 들어가면
    - Then `data-testid="free-tier"` 영역에 `"남는 돈 2,400,000원"`과 `생활비 1,200,000원 / 저축 720,000원 / 비상금 240,000원 / 여가 240,000원`이 표시된다.
    - And PRD 목표("월급 300만 원이면 어디에 얼마씩")가 달성된다.
  - **AC-2 [U][P0]: Scenario: 결과 레이아웃**
    - The system shall `data-testid="free-tier"` 안에 `data-testid="available-hero"` SummaryHero를 둔다. value는 2400000이고 CountUp으로 표시한다.
    - `amounts[key] > 0`인 카테고리 수만큼 `data-testid="allocation-card"` Card를 둔다(Data Models의 표시·집계 규칙). 예시 A는 4개다.
    - 예: available 5, 비율 50:30:10:10이면 amounts는 `{ living: 4, saving: 1, emergency: 0, leisure: 0 }`이고 카드는 2개(생활비, 저축)다.
    - 각 카드는 금액을 t3 강조 타이포로, 비율을 MiniBar로 표시한다.
  - **AC-3 [E][P0]: Scenario: 계획 저장 (충돌 없음)**
    - Given `location.state.draft`로 들어왔고, 저장된 계획이 없는 상태
    - When SubmitFooter `"이 계획 저장하기"`를 탭하면
    - Then AlertDialog 없이 `paysplit:plan:v1`에 저장되고 Toast `"계획을 저장했어요"`가 표시된다.
    - And 저장된 계획의 `id`는 빈 문자열이 아니고 `createdAt === updatedAt`이다.
    - And `requestReviewOnce()`가 1회 호출된다.
    - And SubmitFooter 라벨이 `"홈에서 이체 체크하기"`로 바뀐다. 이 버튼을 탭하면 `navigate('/')`가 호출된다.
  - **AC-4 [S][P0]: Scenario: 저장된 계획으로 진입**
    - While `location.state`가 없고 저장된 계획이 있는 상태에서는
    - Then 저장된 계획으로 같은 결과를 표시한다.
    - And SubmitFooter 라벨은 `"홈에서 이체 체크하기"`다.
  - **AC-5 [S][P1] · HTTP 대응 404: Scenario: 빈 상태**
    - While `location.state`도 저장된 계획도 없는 상태에서는
    - Then Asset.ContentIcon과 문구 `"아직 계획이 없어요"`를 표시한다.
    - And `"월급 계획 짜기"` Button을 표시하고, 탭하면 `navigate('/plan')`이 호출된다.
    - And `data-testid="free-tier"`와 `data-testid="locked-tier"`는 렌더되지 않는다.
    - 에러 문구: `"아직 계획이 없어요"`
  - **AC-6 [W][P1] · HTTP 대응 400: Scenario: 잘못된 state (값·타입 오류)**
    - Given `location.state.draft`가 `isValidDraft`를 어기는 경우. 예:
      - (a) `{ ...예시A, ratios: { living: 50, saving: 30, emergency: 10, leisure: 0 } }`(합 90)
      - (b) `{ ...예시A, salary: "3000000" }`(문자열)
      - (c) `{ ...예시A, payday: 32 }`
      - (d) `location.state = { draft: null }`
      - (e) 예시 A에서 `fixedCosts[0].createdAt`이 없음
      - (f) 예시 A에서 두 고정비의 `id`가 같음
    - When `/result`에 들어가면
    - Then 이 초안을 무시한다. 저장된 계획이 있으면 AC-4, 없으면 AC-5 동작을 따른다.
    - And `console.error`는 0회이고 예외가 발생하지 않는다.
    - 에러 문구: 별도 문구 없음(AC-4 화면, 또는 AC-5 문구 `"아직 계획이 없어요"`)
  - **AC-7 [W][P1] · HTTP 대응 507: Scenario: 저장 실패**
    - Given `savePlan`이 `{ ok: false, error: 'QUOTA' }`를 반환할 때
    - When `"이 계획 저장하기"`를 탭하면(저장된 계획이 있으면 AC-9의 `"바꾸기"`까지 탭하면)
    - Then Toast가 표시되고 SubmitFooter 라벨은 `"이 계획 저장하기"` 그대로다.
    - And `requestReviewOnce()`는 호출되지 않는다.
    - 에러 문구: Toast `"저장 공간이 부족해 저장하지 못했어요"`
  - **AC-8 [E][P2]: Scenario: 공유**
    - When `"친구에게 공유하기"` Button을 탭하면
    - Then `logClick('result_share')`와 `shareApp()`이 각각 1회 호출된다.
  - **AC-9 [W][P1] · HTTP 대응 409: Scenario: 다른 계획이 이미 저장된 상태에서 저장**
    - Given 예시 A 계획이 저장되어 있다(`id: "plan_a"`, `createdAt`: `"2026-09-01T00:00:00.000Z"`).
    - And `location.state.draft`는 예시 A에서 `salary`만 `3500000`인 초안이다(`isSamePlan` = false).
    - When SubmitFooter `"이 계획 저장하기"`를 탭하면
    - Then `savePlan`을 호출하기 전에 AlertDialog가 열린다.
      - 제목: `"저장된 계획을 바꿀까요?"`
      - 설명: `"지금 계획으로 바뀌고, 이전 계획은 되돌릴 수 없어요. 이체 체크 기록은 그대로 남아요."`
      - 버튼: `"바꾸기"`, `"취소"`
    - And AlertDialog가 열려 있는 동안 `localStorage['paysplit:plan:v1']` 문자열은 탭 전과 같다.
    - When `"취소"`를 탭하거나, 딤 영역을 탭하거나, 뒤로가기를 하면
    - Then AlertDialog가 닫힌다.
    - And `paysplit:plan:v1` 문자열이 탭 전과 같다(`salary` 3000000 유지).
    - And SubmitFooter 라벨은 `"이 계획 저장하기"` 그대로다.
    - And Toast가 표시되지 않고 `requestReviewOnce()`도 호출되지 않는다.
    - When `getToday()` = `new Date('2026-09-29T02:00:00.000Z')`에서 다시 `"이 계획 저장하기"`를 탭하고 `"바꾸기"`를 탭하면
    - Then `logClick('plan_overwrite_confirm')`이 1회 호출된다.
    - And `loadPlan()`의 `salary`는 `3500000`, `id`는 `"plan_a"`, `createdAt`은 `"2026-09-01T00:00:00.000Z"`, `updatedAt`은 `"2026-09-29T02:00:00.000Z"`다.
    - And Toast `"계획을 저장했어요"`가 표시되고 SubmitFooter 라벨이 `"홈에서 이체 체크하기"`로 바뀐다.
    - And `paysplit:records:v1` 문자열은 저장 전과 같다.
    - 에러 문구: AlertDialog 제목 `"저장된 계획을 바꿀까요?"`
  - **AC-10 [E][P1] · HTTP 대응 409: Scenario: 저장된 계획과 같은 초안 저장 (충돌 아님)**
    - Given 예시 A 계획이 저장되어 있다.
    - And `location.state.draft`는 예시 A와 `isSamePlan` = true다(고정비의 `id`, 타임스탬프, `presetId`만 달라도 같다고 본다).
    - When `"이 계획 저장하기"`를 탭하면
    - Then AlertDialog 없이 바로 저장되고 Toast `"계획을 저장했어요"`가 표시된다.
    - And 저장된 계획의 `id`와 `createdAt`은 저장 전과 같다.
    - And SubmitFooter 라벨이 `"홈에서 이체 체크하기"`로 바뀐다.

### F5. 결과 심화 층 — 소득 구간 비교 & 6개월 이행 추이 (리워드 게이트)
- **Description**
  - `/result` 무료 층 아래에 `<TossRewardAd>`로 감싼 잠금 층 블록 하나를 둔다.
  - 같은 비율과 고정비로 월급이 ±50만/±100만 원일 때의 저축액을 비교하고, 최근 6개월 이행률 추이를 보여준다.
  - 새 라우트나 새 저장 스키마는 없다.
- **Data**: `BracketScenario`, `TrendSummary` (읽기: `paysplit:plan:v1`, `paysplit:records:v1`)
- **API**: 없음
- **Requirements**
  - **AC-1 [E][P1]: Scenario: 더 깊은 층은 게이트 뒤에 있다**
    - Given `/result`의 `data-testid="locked-tier"` 영역이 TossRewardAd의 자식으로 렌더될 때
    - When 광고 시청이 끝나거나, 광고를 띄울 수 없어 게이트가 자동으로 열리면
    - Then `data-testid="locked-tier"` 영역에 `data-testid="bracket-compare"`(소득 구간별 저축액 비교)와 `data-testid="trend-block"`(6개월 이행 추이)이 표시된다.
  - **AC-2 [U][P0]: Scenario: 소득 구간 비교 값**
    - Given 예시 A(고정비 600,000, 50:30:10:10)
    - Then `data-testid="bracket-row"`가 5개다.
    - 저축액은 순서대로 `2,000,000 → 420,000원`, `2,500,000 → 570,000원`, `3,000,000 → 720,000원`(Badge `"내 월급"`), `3,500,000 → 870,000원`, `4,000,000 → 1,020,000원`이다.
    - 각 행에 연 저축액(`×12`, 예: `8,640,000원`)과 MiniBar가 표시된다.
  - **AC-3 [W][P1]: Scenario: 고정비 이하 구간 제외**
    - Given 월급 1,000,000, 고정비 600,000
    - Then bracket-row는 3개(1,000,000 / 1,500,000 / 2,000,000)다.
    - And 월급이 0 이하이거나 600,000 이하인 구간은 표시되지 않는다.
  - **AC-4 [U][P0]: Scenario: 6개월 추이**
    - Given `getToday()` = 2026-09-29, 기록 `2026-07: 100, 2026-08: 50, 2026-09: 75`
    - Then `data-testid="trend-sparkline"` Sparkline이 2026-04부터 2026-09까지 6개 포인트로 그려진다(기록 없는 달은 빈 점).
    - And `data-testid="trend-average"`에 `"6개월 평균 이행률 75%"`가 표시된다.
    - And `data-testid="trend-streak"`에 `"연속 완료 0개월"`이 표시된다.
  - **AC-5 [E][P1]: Scenario: 연속 완료 계산**
    - Given 기록 `2026-07: 100, 2026-08: 100, 2026-09: 40`, `getToday()` = 2026-09-29
    - Then `"연속 완료 2개월"`이 표시된다.
  - **AC-6 [S][P1] · HTTP 대응 404: Scenario: 추이 빈 상태**
    - While 최근 6개월 기록이 2개월 미만인 상태에서는
    - Then Sparkline 대신 안내 문구가 표시된다.
    - And `bracket-compare`는 정상 표시된다.
    - 에러 문구: `"이행 기록이 2개월 이상 쌓이면 추이를 보여드려요"`
  - **AC-7 [W][P1] · HTTP 대응 422: Scenario: 손상된 기록**
    - Given `paysplit:records:v1 = 'null'`
    - Then AC-6 빈 상태가 표시되고 console.error는 0회다.
    - 에러 문구: `"이행 기록이 2개월 이상 쌓이면 추이를 보여드려요"`

### F6. 홈 — 월급날 D-day & 이체 완료 체크리스트
- **Description**
  - `/` 화면에서 다음 월급일까지의 D-day를 히어로로 보여준다.
  - 저장된 계획의 통장별 이체 항목을 Switch 체크리스트로 제공한다.
  - 체크할 때마다 이번 달 `MonthRecord`를 갱신하고(`planId`는 현재 계획 id), 모두 체크하면 완료 피드백을 준다.
  - 홈 표시 규칙 (단일 출처):
    - `liveEligible`: 현재 저장된 계획에서 `calculateAllocation(plan).amounts[key] > 0`인 카테고리다(CATEGORY_ORDER 순).
    - `checklist-row`: `liveEligible`의 key마다 1행을 둔다.
    - Switch 초기 상태: 이번 달 기록이 있으면 `record.checked[key]`, 없으면 `false`다.
    - `progress-text`: `"{c}/{m} 완료 · {p}%"`로 표시한다.
      - `m` = `liveEligible` 개수
      - `c` = `liveEligible` 중 `record.checked[key] === true`인 개수
      - `p` = `Math.round(c / m * 100)`
    - 저장된 `record.eligible`, `record.rate`, `record.planId`는 홈 표시에 쓰지 않는다. 그래서 행 개수와 `"n/m"`의 `m`은 항상 같다.
    - 완료 Toast는 `progress-text`의 `p`가 100 미만에서 100으로 바뀌는 토글에서만 1회 표시한다.
- **Data**: `SalaryPlan`, `MonthRecord` (읽기/쓰기: `paysplit:records:v1`)
- **API**: 없음
- **Requirements**
  - **AC-1 [U][P0]: Scenario: D-day 표시**
    - Given 저장된 계획의 payday 25, `getToday()` = 2026-09-29
    - Then `data-testid="dday-hero"`에 `"D-26"`과 `"10월 25일 월급날"`이 표시된다.
    - payday가 31이면 `"D-1"`과 `"9월 30일 월급날"`이 표시된다.
  - **AC-2 [E][P0]: Scenario: 이체 체크**
    - Given 예시 A 계획, 이번 달(2026-09) 기록 없음
    - When `"저축 통장 · 720,000원"` 행(`data-testid="checklist-row"`)의 Switch를 켜면
    - Then `records['2026-09'].checked.saving`은 `true`, `rate`는 `25`, `planId`는 `"plan_a"`가 된다.
    - And `data-testid="progress-text"`에 `"1/4 완료 · 25%"`가 표시된다.
    - And `logClick('checklist_toggle')`이 1회 호출된다.
  - **AC-3 [E][P0]: Scenario: 이번 달 완료**
    - When Switch 4개를 모두 켜면
    - Then `rate`는 `100`이고 `completedAt`에는 ISO 문자열이 들어간다.
    - And Toast `"이번 달 통장 쪼개기 완료!"`가 1회 표시되고 `requestReviewOnce()`가 호출된다.
    - When 이후 하나를 끄면
    - Then `rate`는 `75`, `completedAt`은 `null`이 된다.
    - And 이 과정 내내 `records['2026-09'].id`와 `createdAt`은 처음 켰을 때의 값 그대로다.
  - **AC-4 [S][P0]: Scenario: 금액 0원 카테고리 제외**
    - While 계획 ratios가 `{ living: 60, saving: 30, emergency: 10, leisure: 0 }`인 상태에서는(예시 A 월급·고정비라서 `amounts.leisure = 0`)
    - Then checklist-row는 3개이고 여가 행은 표시되지 않는다. 이번 달 기록의 `eligible`은 `['living','saving','emergency']`다.
    - And 3개를 모두 켜면 `"3/3 완료 · 100%"`가 표시된다.
  - **AC-5 [S][P1] · HTTP 대응 404: Scenario: 계획 없음 빈 상태**
    - While 저장된 계획이 없는 상태에서는
    - Then Asset.ContentIcon, 문구 `"월급을 어디에 얼마씩 나눌지 정해볼까요?"`, `"월급 계획 짜기"` Button(display="block")이 표시된다.
    - And `dday-hero`와 `checklist-row`는 렌더되지 않는다.
    - When 버튼을 탭하면
    - Then `logClick('home_start_plan')`이 호출된 뒤 `navigate('/plan')`이 호출된다.
    - 에러 문구: `"월급을 어디에 얼마씩 나눌지 정해볼까요?"`
  - **AC-6 [W][P1] · HTTP 대응 507: Scenario: 체크 저장 실패**
    - Given `localStorage.setItem`이 `QuotaExceededError`를 던질 때
    - When 저축 Switch를 켜면
    - Then `toggleRecordItem('saving', true)`가 `{ ok: false, error: 'QUOTA' }`를 반환한다.
    - And Switch는 꺼진 상태로 돌아간다.
    - And `progress-text`는 토글 전 값을 유지한다.
    - And Toast가 표시된다.
    - 에러 문구: Toast `"저장하지 못했어요. 다시 시도해주세요"`
  - **AC-7 [W][P1]: Scenario: 월이 바뀌면 새 체크리스트**
    - Given `records['2026-09']`가 4/4 완료된 상태
    - When `getToday()` = 2026-10-01에 홈에 들어가면
    - Then 모든 Switch는 꺼져 있고 `"0/4 완료 · 0%"`가 표시된다.
    - And `records['2026-09']`는 그대로 유지된다.
  - **AC-8 [E][P2]: Scenario: 계획 이동**
    - When `"계획 수정"` Button을 탭하면 → `navigate('/plan')`이 호출된다.
    - When `"배분 결과 보기"` Button을 탭하면 → `navigate('/result')`가 state 없이 호출된다.
  - **AC-9 [W][P1]: Scenario: 생활비 비율 0 + 내림 잔액**
    - Given 계획 `{ salary: 1234567, fixedCosts: [], ratios: { living: 0, saving: 50, emergency: 30, leisure: 20 } }`, `getToday()` = 2026-09-29, 기록 없음
    - Then `calculateAllocation`의 amounts는 `{ living: 1, saving: 617283, emergency: 370370, leisure: 246913 }`이다.
    - And checklist-row는 4개이고, 그중 하나는 `"생활비 통장 · 1원"`이다. `/result`의 allocation-card도 4개다.
    - When Switch 4개를 모두 켜면
    - Then `records['2026-09'].eligible`의 길이는 4, `rate`는 `100`이고, `progress-text`에 `"4/4 완료 · 100%"`가 표시된다.
  - **AC-10 [W][P1]: Scenario: 월 중간에 계획을 새로 저장**
    - Given `getToday()` = 2026-09-29이다.
    - And 저장된 `records['2026-09']`의 값은 다음과 같다.
      - `checked`: `{ living: true, saving: true, emergency: false, leisure: true }`
      - `eligible`: 4개
      - `rate`: `75`
    - And 그 뒤에 예시 A 월급·고정비에 ratios `{ living: 60, saving: 30, emergency: 10, leisure: 0 }`인 계획으로 다시 저장했다(`amounts.leisure = 0`, 계획 `id`는 유지).
    - When 토글 없이 홈에 들어가면
    - Then checklist-row는 3개(생활비·저축·비상금)이고 여가 행은 없다.
    - And Switch는 생활비 on, 저축 on, 비상금 off다.
    - And `progress-text`에 `"2/3 완료 · 67%"`가 표시된다.
    - And `localStorage['paysplit:records:v1']` 문자열은 들어가기 전과 같다(저장된 `rate` 75는 그대로다).
    - When 비상금 Switch를 켜면
    - Then `records['2026-09'].eligible`은 `['living','saving','emergency']`, `rate`는 `100`이 된다.
    - And `progress-text`에 `"3/3 완료 · 100%"`가 표시되고 Toast `"이번 달 통장 쪼개기 완료!"`가 1회 표시된다.
  - **AC-11 [W][P1] · HTTP 대응 422: Scenario: 손상된 계획으로 홈 진입**
    - Given `localStorage['paysplit:plan:v1']`이 `'{broken'`이거나 `isValidPlan`을 어기는 값(예: `"salary": "3000000"`)이다.
    - When 홈(`/`)에 들어가면
    - Then AC-5 빈 상태가 표시된다.
    - And `paysplit:plan:v1` 키가 삭제된다.
    - And `console.error`는 0회이고 예외가 발생하지 않는다.
    - And `paysplit:records:v1` 문자열은 들어가기 전과 같다. 삭제된 계획을 가리키는 `planId`도 그대로 남는다(FK NO ACTION).
    - 에러 문구: `"월급을 어디에 얼마씩 나눌지 정해볼까요?"`

### F7. 월별 이행률 기록 화면
- **Description**
  - `/history` 화면에서 이번 달 이행률을 히어로로 보여주고, 저장된 월별 기록(최대 24개월)을 최신순 목록으로 보여준다.
  - 각 행은 이행률 MiniBar와 완료 배지로 "지켰는지"를 한눈에 보여준다.
  - 과거 월의 표시는 기록 자체 값만 쓴다. `planId`로 계획을 조회하지 않는다.
- **Data**: `MonthRecord`, `RecordsStore` (읽기 전용)
- **API**: 없음
- **Requirements**
  - **AC-1 [U][P0]: Scenario: 월별 목록**
    - Given 기록 `2026-07: 100, 2026-08: 50, 2026-09: 75`
    - Then `data-testid="month-row"` ListRow 3개가 `2026년 9월 → 8월 → 7월` 순으로 표시된다.
    - 각 행 오른쪽에 `75%`, `50%`, `100%`와 MiniBar가 표시된다.
    - 100%인 7월 행에만 Badge `"완료"`가 붙는다.
  - **AC-2 [U][P0]: Scenario: 이번 달 히어로**
    - Given 위 기록, `getToday()` = 2026-09-29
    - Then `data-testid="history-hero"` SummaryHero의 value는 `75`(CountUp), 라벨은 `"이번 달 이행률"`, 단위는 `%`다.
  - **AC-3 [S][P1] · HTTP 대응 404: Scenario: 빈 상태**
    - While 기록이 0개인 상태에서는
    - Then Asset.ContentIcon, 문구 `"아직 기록이 없어요"`, `"이번 달 체크하러 가기"` Button이 표시된다. 버튼을 탭하면 `navigate('/')`가 호출된다.
    - And `month-row`는 0개다.
    - 에러 문구: `"아직 기록이 없어요"`
  - **AC-4 [S][P1] · HTTP 대응 404: Scenario: 이번 달 기록 없음**
    - While 지난달 기록만 있고 이번 달 기록이 없는 상태에서는
    - Then history-hero value는 `0`이고 보조 문구가 표시된다.
    - 에러 문구: `"이번 달은 아직 체크 전이에요"`
  - **AC-5 [W][P1] · HTTP 대응 422: Scenario: 손상된 기록**
    - Given `paysplit:records:v1 = '{broken'`
    - Then AC-3 빈 상태가 표시되고 console.error는 0회다.
    - 에러 문구: `"아직 기록이 없어요"`
  - **AC-6 [U][P1]: Scenario: 스크롤**
    - The system shall 목록을 일반 문서 스크롤로 렌더한다. 최대 24행이므로 가상 스크롤은 쓰지 않는다.
    - 마지막 행과 AdSlot이 FloatingTabBar에 가려지지 않도록 목록 끝에 `Spacing size={80}`을 둔다.
  - **AC-7 [U][P2]: Scenario: 배너 광고 위치**
    - The system shall `AdSlot`을 목록 마지막 행 아래에 1개만 둔다.
    - 광고가 로드되지 않으면 빈 영역의 높이는 0이다.
  - **AC-8 [W][P1] · HTTP 대응 422: Scenario: 일부 레코드 타입 오류**
    - Given `paysplit:records:v1`의 `version`은 1이고, 기록이 다음과 같다.
      - `2026-07`: rate `100`(정상)
      - `2026-08`: `"rate": "50"`(문자열)
      - `2026-09`: rate `75`(정상)
    - And `getToday()` = 2026-09-29
    - Then `month-row`는 2개(`2026년 9월 · 75%`, `2026년 7월 · 100%`)다. 8월 행은 표시되지 않는다.
    - And history-hero value는 `75`다.
    - And `console.error`는 0회이고, `paysplit:records:v1` 문자열은 들어가기 전과 같다(읽기만으로 다시 쓰지 않음).
    - 에러 문구: 없음(잘못된 레코드는 조용히 뺀다)
  - **AC-9 [W][P1]: Scenario: 끊긴 planId·레거시 기록도 정상 표시**
    - Given 다음 기록이 있고, 저장된 계획은 `"plan_new"`다.
      - `2026-08`: `planId` `"plan_deleted"`, rate `50`
      - `2026-07`: 레거시 형태(`id`, `planId`, `createdAt` 키 없음), rate `100`
    - Then `month-row` 2개가 `50%`, `100%`로 표시된다.
    - And `console.error`는 0회다.
    - 에러 문구: 없음

### F8. 없는 경로 폴백 (404 화면)
- **Description**
  - 정의된 4개 라우트(`/`, `/plan`, `/result`, `/history`)에 해당하지 않는 경로로 들어오면 `<Route path="*">`가 404 화면(S5)을 렌더한다.
  - 빈 화면이나 라우터 경고 없이 홈으로 돌아갈 수 있게 한다.
- **Data**: 없음 (localStorage를 읽거나 쓰지 않음)
- **API**: 없음
- **Requirements**
  - **AC-1 [W][P1] · HTTP 대응 404: Scenario: 없는 경로 진입**
    - Given 앱을 `/unknown`, `/history/2026-09`, `/plan/edit` 중 한 경로로 직접 연다.
    - When 첫 렌더가 끝나면
    - Then `data-testid="not-found"` 영역에 다음이 표시된다.
      - Asset.ContentIcon
      - 제목 `"페이지를 찾을 수 없어요"`
      - 보조 문구 `"주소가 바뀌었거나 없는 화면이에요"`
      - Button `"홈으로 가기"`(display="block")
    - And FloatingTabBar, SubmitFooter, AdSlot은 렌더되지 않는다.
    - And `console.error`는 0회, `No routes matched`를 포함한 `console.warn`도 0회다.
    - And `paysplit:plan:v1`, `paysplit:records:v1`, `paysplit:review:v1` 문자열은 들어가기 전과 같다.
    - And `logImpression('not_found')`가 1회 호출된다.
    - 에러 문구: `"페이지를 찾을 수 없어요"`
  - **AC-2 [E][P1]: Scenario: 홈으로 복귀**
    - Given `/unknown`의 404 화면
    - When `"홈으로 가기"`를 탭하면
    - Then `navigate('/', { replace: true })`가 호출되고 S1 홈이 렌더된다.
    - And 이어서 뒤로가기를 해도 `/unknown` 404 화면으로 돌아가지 않는다(history 항목이 교체됨).
  - **AC-3 [U][P1]: Scenario: 라우트 구성**
    - The system shall 라우터에 `path`가 `/`, `/plan`, `/result`, `/history`, `*`인 Route를 정확히 1개씩, 모두 5개 둔다.
    - `src/`에서 `path="*"`(또는 `path: '*'`)를 grep하면 1건이다.
    - `*` Route는 목록의 마지막에 둔다.
  - **AC-4 [W][P2] · HTTP 대응 404: Scenario: 정의된 경로의 변형은 404가 아니다**
    - When `/plan/`(끝 슬래시), `/plan?from=home`(쿼리), `/history#top`(해시)으로 들어가면
    - Then 각각 S2 계획 짜기, S2 계획 짜기, S4 이행 기록이 렌더된다.
    - And `data-testid="not-found"`는 렌더되지 않는다.
    - 에러 문구: 없음(정상 화면)

---

## Screen Definitions

> 앱 이름: PRD에 "앱 이름:" 줄이 없다. 한국어 앱 이름은 **"월급 쪼개기"**를 가정한다(Assumptions A1, Open Questions Q1). 영문 `PaySplitPlan`은 화면에 쓰지 않는다.

### S1. 홈 — `/`
- **Top title**: `월급 쪼개기`
- **골격**: `PageShell` > `ScreenScaffold`. 하단에 `FloatingTabBar`(탭: 홈 `/`, 기록 `/history`)를 둔다.
- **TDS 컴포넌트**: `Top`, `Card`, `SummaryHero`, `ListRow`, `Switch`, `Paragraph.Text`, `Button`, `Toast`, `Spacing`, `Asset.ContentIcon`
- **레이아웃 계약**:
  1. `data-testid="dday-hero"` SummaryHero에 D-day(t2)와 월급일 날짜를 표시한다.
  2. `Card` 안에 "이번 달 이체 체크" 제목, `data-testid="progress-text"`, `checklist-row` × n을 둔다. 각 행은 `ListRow`다(왼쪽: 통장명, 아래: 금액 / 오른쪽: `Switch` aria-label `"{통장명} 이체 완료"`).
  3. 버튼 행: `"배분 결과 보기"`, `"계획 수정"` Button. 각각 display="block", 높이 48px 이상.
- **상태**:
  - 로딩: 없음(localStorage를 동기로 읽음).
  - 빈 상태: F6 AC-5.
  - 에러: F6 AC-6(저장 실패), F6 AC-11(손상된 계획).
- **터치**: Switch를 포함한 ListRow 전체 높이 56px 이상. 행 아무 곳이나 탭해도 Switch가 토글된다.
- **Navigation contract**:
  - Incoming: `location.state`를 쓰지 않는다(무시).
  - Outgoing:
    - `"월급 계획 짜기"` / `"계획 수정"` → `navigate('/plan')` (state 없음)
    - `"배분 결과 보기"` → `navigate('/result')` (state 없음 → 저장된 계획 사용)
- **계측**:
  - `"월급 계획 짜기"` → `logClick('home_start_plan')`
  - Switch 토글 → `logClick('checklist_toggle')`
  - 100% 달성 → `requestReviewOnce()`

### S2. 계획 짜기 — `/plan`
- **Top title**: `계획 짜기`
- **골격**: `PageShell` > `ScreenScaffold`. `SubmitFooter`를 하단에 고정하고 FloatingTabBar는 숨긴다.
- **TDS 컴포넌트**: `Top`, `TextField`(월급, 월급날, 고정비 이름·금액), `ListRow`(고정비 행, 비율 행), `Button`(고정비 추가, 삭제, −/+), `Chip`+`ChipItem`(프리셋 3개 + "직접 조정"), `BottomSheet`(고정비 추가), `Paragraph.Text`, `Toast`, `Spacing`
- **레이아웃 계약**: 위에서 아래 순서는 다음과 같다.
  1. 월급 TextField와 보조 문구(`"300만 원"`)
  2. 월급날 TextField(접미사 `"일"`)
  3. 고정비 섹션: 행 목록(오른쪽 삭제 Button, React key는 `FixedCost.id`), `"고정비 추가"` Button, `data-testid="available-preview"`
  4. 비율 섹션: Chip 그룹, 비율 행 4개(`"{라벨} {n}% · {금액}원"` + −/+ Button), `data-testid="ratio-sum"`
     - 금액은 `getRatioRowAmount(available, ratio)`로 구한다.
     - 값이 `null`이면 금액 자리에 `-`를 표시한다.
  5. SubmitFooter `"배분 결과 보기"`
- **입력 처리**:
  - 숫자 필드(월급, 월급날, 고정비 금액)는 입력 원문 문자열을 상태로 보관하고 `parseAmountInput`으로 해석한다(F2 AC-7a, AC-10, AC-11).
  - 해석 결과가 `ok`일 때만 콤마 포맷을 적용한다(월급날은 콤마 없음). 그 외에는 원문을 그대로 보여주고 에러 문구를 표시한다.
  - 월급 필드 에러 문구 우선순위:
    1. `"월급을 입력해주세요"` (empty 또는 0, 제출 탭 시)
    2. `"0보다 큰 금액을 입력해주세요"`
    3. `"원 단위로 입력해주세요"`
    4. `"숫자만 입력해주세요"`
    5. `"1억 원 이하로 입력해주세요"`
  - 필드 하나에는 에러 문구를 하나만 표시한다.
  - 고정비 추가 성공 시 `{ id: createId(), name: name.trim(), amount, createdAt: nowIso(), updatedAt: 같은 값 }`을 목록 끝에 붙인다. 삭제는 `id`로 필터한다.
- **키보드**:
  - 숫자 필드는 `inputMode="numeric"`을 쓴다.
  - 포커스된 필드는 `scrollIntoView({ block: 'center' })`로 가상 키보드 위에 보이게 한다.
  - 키보드가 열려 있으면 SubmitFooter가 키보드 바로 위에 붙는다.
  - 고정비 BottomSheet가 열리면 이름 필드에 자동 포커스한다. 키보드가 열리면 시트가 키보드 위로 올라간다.
  - 월급 필드에서 Enter를 누르면 월급날 필드로 포커스가 이동한다.
- **목록 스크롤**: 고정비는 최대 10행이므로 일반 스크롤을 쓴다.
- **상태**:
  - 로딩: 없음(동기 읽기).
  - 빈 상태: 고정비 0개일 때 안내 문구(F2 AC-8).
  - 에러: F2 AC-3~7a, AC-9~11, F3 AC-4~5, AC-8.
- **터치**: −/+ Button 각각 44×44px 이상. 고정비 삭제 Button 44×44px 이상.
- **Navigation contract**:
  - Incoming: `location.state`를 쓰지 않는다. 초기값은 `loadPlan()`이나 기본값에서 가져온다.
  - Outgoing: `"배분 결과 보기"` → `navigate('/result', { state: { draft: PlanDraft } })`. draft에는 `id`, `version`, `createdAt`, `updatedAt`이 없다.
- **계측**: `"배분 결과 보기"` → `logClick('plan_submit')`

### S3. 배분 결과 — `/result` (핵심 가치 화면, 게이트 위치)
- **Top title**: `배분 결과`
- **골격**: `PageShell` > `ScreenScaffold`. `SubmitFooter`를 하단에 고정하고 FloatingTabBar는 숨긴다.
- **TDS 컴포넌트**: `Top`, `SummaryHero`(CountUp), `Card`, `ListRow`, `Badge`, `Paragraph.Text`, `Button`, `AlertDialog`(덮어쓰기 확인), `Toast`, `Spacing`, `MiniBar`, `Sparkline`, `Asset.ContentIcon`, `TossRewardAd`, `AdSlot`
- **무료 층** (`data-testid="free-tier"`, `<TossRewardAd>` **바깥**):
  - `data-testid="available-hero"`: SummaryHero에 `"남는 돈"`과 CountUp 값을 표시하고, 보조로 `"월급 3,000,000원 − 고정비 600,000원"`을 표시한다.
  - `data-testid="allocation-card"` Card × (`amounts[key] > 0`인 카테고리 수, 표시·집계 규칙): 통장명, 금액(t3 강조), `{n}%`, MiniBar.
  - `"친구에게 공유하기"` Button.
- **잠금 층** (`data-testid="locked-tier"`, `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`의 **자식으로만**):
  - `data-testid="bracket-compare"` Card: 제목 `"월급이 달라지면 저축은?"`, `bracket-row` × 3~5개, 내 월급 행에는 Badge `"내 월급"`.
  - `data-testid="trend-block"` Card: `trend-sparkline`, `trend-average`, `trend-streak`. 기록이 2개월 미만이면 안내 문구로 대신한다.
- **코드 구조 규칙**: 무료 층은 `<TossRewardAd>` 바깥에 두고, 잠금 층만 그 자식으로 둔다. 화면 전체를 감싸지 않는다(리뷰 체크 항목).
- **광고 배치**: 잠금 층 아래, SubmitFooter 위에 `AdSlot` 1개를 둔다. 콘텐츠와 겹치지 않는다.
- **저장 흐름**:
  - `"이 계획 저장하기"`를 탭하면 먼저 `loadPlan()`을 읽는다.
  - `null`이거나 `isSamePlan(saved, draft)`이면 바로 `savePlan`한다(F4 AC-3, AC-10).
  - 그 외에는 AlertDialog로 확인을 받은 뒤 저장한다(F4 AC-9).
  - 어느 경우든 `savePlan`이 싱글톤 행의 `id`와 `createdAt`을 유지한다.
- **상태**:
  - 로딩: 없음.
  - 빈 상태: F4 AC-5.
  - 에러: F4 AC-6(잘못된 state), F4 AC-7(저장 실패), F4 AC-9(덮어쓰기 충돌).
- **터치**: 공유 Button, SubmitFooter Button, AlertDialog 버튼 높이 48px 이상.
- **Navigation contract**:
  - Incoming: `location.state = { draft: PlanDraft } | null`. `/plan`이 보내는 타입과 같다. `isValidDraft`를 통과하지 못하면 무시한다.
  - Outgoing:
    - 저장 후 또는 저장된 계획 모드의 `"홈에서 이체 체크하기"` → `navigate('/')`
    - 빈 상태의 `"월급 계획 짜기"` → `navigate('/plan')`
- **계측**:
  - `"이 계획 저장하기"` → `logClick('plan_save')`
  - 덮어쓰기 `"바꾸기"` → `logClick('plan_overwrite_confirm')`
  - 공유 → `logClick('result_share')` + `shareApp()`
  - 저장 성공 후 → `requestReviewOnce()`
  - 무료 층 노출 → `logImpression('result_free_tier')`
  - 잠금 층 콘텐츠 렌더 → `logImpression('result_locked_tier')`
  - AdSlot → `logImpression('result_banner')`

### S4. 이행 기록 — `/history` (데이터 화면)
- **Top title**: `이행 기록`
- **골격**: `PageShell` > `ScreenScaffold`. 하단에 `FloatingTabBar`를 둔다.
- **TDS 컴포넌트**: `Top`, `SummaryHero`(CountUp), `Card`, `ListRow`, `Badge`, `Paragraph.Text`, `Button`, `Spacing`, `MiniBar`, `Asset.ContentIcon`, `AdSlot`
- **레이아웃 계약**:
  1. `data-testid="history-hero"` SummaryHero (`"이번 달 이행률"`, `%`)
  2. `Card` 안에 `month-row` 목록(왼쪽 `"2026년 9월"`, 오른쪽 `%` + MiniBar, 100%이면 Badge `"완료"`). React key는 `MonthRecord.id`다.
  3. `AdSlot`
  4. `Spacing size={80}`
- **스크롤**: 일반 스크롤(최대 24행).
- **상태**:
  - 로딩: 없음.
  - 빈 상태: F7 AC-3.
  - 에러: F7 AC-5(손상된 스토어), F7 AC-8(일부 레코드 오류), F7 AC-9(끊긴 참조·레거시).
- **터치**: month-row는 탭 동작이 없어 onClick도 없다(시각 요소). 빈 상태 Button 높이 48px 이상.
- **Navigation contract**:
  - Incoming: `location.state`를 쓰지 않는다.
  - Outgoing: 빈 상태 `"이번 달 체크하러 가기"` → `navigate('/')`
- **계측**: AdSlot → `logImpression('history_banner')`

### S5. 페이지 없음 — `*` (404 폴백)
- **Top title**: `월급 쪼개기`
- **골격**: `PageShell` > `ScreenScaffold`. FloatingTabBar, SubmitFooter, AdSlot은 두지 않는다.
- **TDS 컴포넌트**: `Top`, `Asset.ContentIcon`, `Paragraph.Text`, `Button`, `Spacing`
- **레이아웃 계약**: `data-testid="not-found"` 영역 안에 위에서 아래로 다음을 둔다.
  1. Asset.ContentIcon
  2. `Spacing size={16}`
  3. 제목 `"페이지를 찾을 수 없어요"`
  4. 보조 문구 `"주소가 바뀌었거나 없는 화면이에요"`
  5. `Spacing size={24}`
  6. `"홈으로 가기"` Button(display="block")
- **상태**: 로딩·빈 상태·에러 없음(정적 화면, localStorage 접근 없음).
- **터치**: `"홈으로 가기"` Button 높이 48px 이상.
- **Navigation contract**:
  - Incoming: `location.state`를 쓰지 않는다.
  - Outgoing: `"홈으로 가기"` → `navigate('/', { replace: true })`
- **계측**: 화면 노출 → `logImpression('not_found')`

---

## Assumptions
- **A1. 한국어 앱 이름**: PRD에 "앱 이름:" 줄이 없어서, One-liner의 "월급날 통장 쪼개기"에서 딴 **"월급 쪼개기"**를 임시 Top title로 쓴다.
- **A2. 5:3:2를 4개 통장에 매핑**: PRD의 "5:3:2"는 3분할인데 통장은 4개(생활비·저축·비상금·여가)다. 그래서 `5:3:2 = 생활비 50 / 저축 30 / 비상금 10 + 여가 10`으로 해석했다. 4:4:2, 6:2:2 프리셋도 같은 방식으로 가정했다.
- **A3. 반올림**: 배분액은 원 단위로 내림하고, 남는 잔액은 생활비에 흡수한다.
- **A4. 이행률 기준**: 이행률은 "이번 달(달력 월) 이체 체크 완료 비율"이다. 실제 이체 금액은 확인하지 않고 사용자의 자기 체크만 기록한다.
- **A5. 소득 구간 비교**: 비교 구간은 현재 월급 기준 ±50만/±100만 원, 5개 구간으로 가정했다. 고정비와 비율은 현재 계획과 같다고 본다.
- **A6. 계측 지점**: PRD에 Core Flow와 [전환] 표시가 없다. 그래서 계획 제출·저장·덮어쓰기 확인·공유·체크를 전환 지점으로 추론했다.
- **A7. 계획 개수와 덮어쓰기**: 계획은 1개만 유지한다. 저장된 계획과 다른 초안을 저장할 때는 AlertDialog로 확인을 받은 뒤 덮어쓴다(F4 AC-9). 과거 계획은 MonthRecord.snapshot으로만 남는다.
- **A8. 광고 ID**: 광고 ID(`VITE_TOSS_AD_SLOT_ID`, `VITE_TOSS_AD_GROUP_ID`)는 아직 발급되지 않았다. 빌드할 때 주입되므로, 값이 생기면 다시 빌드하고 배포해야 한다. 그 전까지 게이트는 자동으로 열린다.
- **A9. 계측 위임 대상**: `logClick`/`logImpression`(P-2a)은 템플릿에 Toss 내부 로깅 헬퍼가 있다고 보고 그 헬퍼에 위임한다. 헬퍼가 없으면 no-op로 동작하고, 외부 분석 의존성은 추가하지 않는다.
- **A10. 고정비 이름 중복 허용**: 같은 이름의 고정비(예: 보험 2건)도 실제로 있을 수 있어 막지 않는다. 고정비는 `id`(PK)로 구분하며, 이름 중복은 충돌(409)로 보지 않는다.
- **A11. HTTP 대응 코드**: 서버가 없어서 에러 AC의 HTTP 코드는 분류용 라벨로만 쓴다(P-10). 401/403은 해당하는 경로가 없어 AC를 만들지 않는다(P-8).
- **A12. 레거시 데이터 호환**: 이 SPEC 이전 빌드로 저장된 v1 데이터에는 `id`, `createdAt`, `planId`, 고정비 타임스탬프가 없을 수 있다.
  - 이런 데이터는 버리지 않는다. 값이 없는 필드만 읽을 때 결정적인 값으로 채운다(F1 AC-15, AC-16).
  - 저장 스키마 `version`은 1로 유지한다. 새 필드가 추가만 됐기 때문이다.
- **A13. 계획 행의 정체성**: 계획은 싱글톤 행이다. 덮어써도 같은 행을 갱신하는 것으로 보고 `id`와 `createdAt`을 유지한다. `id`가 새로 생기는 경우는 계획 키가 없을 때(최초 저장, 또는 손상으로 삭제된 뒤)뿐이다.
- **A14. FK 강제 수준**: `MonthRecord.planId`는 추적용 soft FK다. 읽을 때 참조가 존재하는지 검증하지 않고, 부모가 삭제돼도 기록을 바꾸지 않는다(NO ACTION). 과거 달 표시에는 `snapshot`만 쓴다.

## Open Questions
- **Q1.** 콘솔에 등록할 공식 한국어 앱 이름은 무엇인가? "월급 쪼개기"로 확정해도 되는가?
- **Q2.** 프리셋 구성(5:3:2 / 4:4:2 / 6:2:2)과 4통장 매핑(A2)이 기획 의도와 맞는가? 비상금·여가 기본 비율이 달라야 하는가?
- **Q3.** 체크리스트의 "이번 달"을 달력 월 대신 **월급일 주기**(예: 9/25~10/24)로 잡아야 하는가? 월급일이 말일 근처인 사용자는 달력 월과 어긋날 수 있다.
- **Q4.** 소득 구간 비교를 ±50만 원 단위 대신 고정 구간(200/250/300/350/400만 원)으로 보여주길 원하는가?
- **Q5.** 결과 화면 배너(AdSlot)와 리워드 게이트를 함께 두면 광고가 과하게 느껴질 수 있다. 배너를 `/history`에만 둘지 정해야 한다.
- **Q6.** 계획 덮어쓰기 확인(F4 AC-9)이 저장 흐름에 한 단계를 더한다. 확인 없이 덮어쓰고 Toast에 "되돌리기"를 넣는 방식이 더 나은가? 그러려면 직전 계획 1개를 보관하는 키(예: `paysplit:plan-prev:v1`, 같은 `SalaryPlan` 스키마)가 추가로 필요하다.
- **Q7.** 계획을 덮어쓸 때 같은 행으로 볼지(현재: `id` 유지, A13), 새 버전으로 볼지(새 `id`) 정해야 한다. 새 버전으로 보면 월 중간에 계획을 바꿨을 때 `MonthRecord.planId`로 버전을 구분할 수 있다. 대신 이전 버전을 보관하지 않으면 끊긴 참조가 늘어난다.

---

참고: claude.ai Canva 커넥터는 아직 인증되지 않아 이 세션에서 쓸 수 없습니다. claude.ai 커넥터 설정에서 인증하면 쓸 수 있고, 이번 작업에는 필요하지 않았습니다.