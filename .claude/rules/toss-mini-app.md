# App-in-Toss Mini App — Absolute Rules

## GROUND TRUTH for SDK
**Read `.ai-factory/apps-in-toss-essential.txt` before using any `@apps-in-toss/web-framework` API.** It contains verified exports. If an API is not listed there, it does not exist — do not guess. The apps-in-toss MCP is for TDS component docs/examples only — for SDK APIs, trust this file (`.d.ts`-verified), not the MCP.

## TDS Components Mandatory (Highest Priority)
- **BEFORE writing UI**: read `.ai-factory/tds-reference.txt`(토스 공식 TDS LLM 문서)와 `.ai-factory/tds-patterns.md`(출시 미니앱 기반 골든 패턴)에서 정확한 컴포넌트 API를 확인하라.
  <!-- 예전 이 줄은 "apps-in-toss MCP를 질의하라"였다. 그런데 파이프라인은 MCP 도구를
       허용목록에 넣지 않으므로(claude-code-runner.ts의 allowedTools에 mcp__* 0개)
       그 지시는 **실행 불가능**했다. 문서가 시키는 일을 허용목록이 막는 구조는
       2026-08-08에 밤을 죽인 것과 같은 모양이다(정확 일치 거부 → 턴 소진 → 0머지).
       MCP를 열 때 이 줄을 되돌려라. -->
- The apps-in-toss MCP is **not available** to the coding agent — do not attempt to call `mcp__*` tools. They will be denied and the retry will burn your turn budget.
- ALL UI MUST use TDS (`@toss/tds-mobile`) components exclusively
- shadcn/ui, MUI, Ant Design, Chakra UI → instant review rejection
- NEVER override TDS component margin/padding with Tailwind or inline styles
- Spacing: use TDS `Spacing` component (size prop required) — NEVER inline margin/padding
- **새 페이지 작성 시 `.ai-factory/tds-patterns.md` + `src/components/` Pre-built 컴포넌트 먼저 확인** — ScreenScaffold/SummaryHero/Card/Amount/SubmitFooter/StateView/FloatingTabBar 조립이 우선. raw div 골격·자작 nav 금지. 가까운 패턴을 변형하세요.
- **버튼 중첩 금지**: `FixedBottomCTA`/`BottomCTA`/`CTAButton`은 **자체가 `<button>`**이다(.d.ts: HTMLButtonElement) → 안에 `<Button>`을 넣으면 `<button><button>`(무효 HTML/validateDOMNesting). children에 라벨을 직접 넣거나 `SubmitFooter`를 써라. 2개 버튼은 `FixedBottomCTA.Double` 또는 커스텀 div+Button. (ListRow `onClick`은 `<li role=button>`이라 내부 버튼이 `<li><button>`=유효 HTML이지만, a11y상 행 내부 액션은 `right` 슬롯 IconButton 권장.)
- **TextField placeholder 필수**: `variant="box"|"line"`은 플로팅 라벨이라 빈 칸+비포커스에서 라벨이 위로 떠 **숨는다** → `placeholder`를 안 주면 빈 회색 박스가 된다(무엇을 입력할지 알 수 없음). label과 placeholder를 항상 함께.
- **하단 탭 활성표시**: 아이콘+라벨 컬러 틴트만 — 솔리드 알약/`Button variant="fill"` 금지(네이티브 토스 탭과 불일치).
- **시각 앵커**: 홈/결과 최상단에 핵심 숫자 하나를 크게(SummaryHero, t1). '휑함'의 가장 큰 원인은 숫자 앵커 부재. 금액은 raw 텍스트 대신 `Amount`(줄바꿈 방지).
- Fallback TDS doc (when the MCP is unavailable): `.ai-factory/tds-reference.txt` — official TDS LLM doc
- "모르면 지어내지 마라": tds-essential.txt/tds-reference.txt에 없는 prop은 존재하지 않음 → 추측 사용 금지
- TDS로 구현 불확실 → 기본 HTML + `var(--adaptive*)` 또는 `var(--tds-color-*)` CSS 변수로 대체 (Tailwind 금지)

## TDS Core 11 Components (assemble like building blocks)
1. ListRow — list item (ListRow.Texts with type/top/bottom — NO padding prop)
2. Button — button (variant: 'fill' | 'weak' ONLY)
3. TextField — text input (variant: 'box' | 'line' | 'big' | 'hero' REQUIRED)
4. Paragraph.Text — text display (typography: t1~t7, st1~st13)
5. Chip — tag/filter
6. Switch — switch (NOT "Toggle" — Toggle component does not exist in TDS)
7. AlertDialog — modal dialog (NOT "Dialog")
8. BottomSheet — bottom sheet
9. Toast — toast notification (open + position REQUIRED)
10. Top — top navigation bar (NOT "AppBar", title prop REQUIRED)
11. (하단 탭 네비) — TDS에 **TabBar 컴포넌트는 없다**(환각). main nav가 2~5탭이면 템플릿 제공 `src/components/FloatingTabBar` 사용(활성탭=아이콘+라벨 컬러 틴트, 솔리드 알약/Button fill 금지). `Tab`은 상단 콘텐츠 전환용(하단 nav 아님).

## Server-Side Code Forbidden
- No Next.js (Vite + React only, or granite framework)
- No API Routes, getServerSideProps, server components
- No Node.js-only modules (fs, path, crypto, better-sqlite3)
- Data storage: browser localStorage or SDK `Storage` (native persistence) or external API via fetch
- External API via fetch를 쓸 때: v3 앱은 `https://<appName>.web.tossmini.com`(운영)과 `https://<appName>.private-web.tossmini.com`(QR 테스트) 두 origin에서 실행된다 — API 서버 CORS 허용목록에 둘 다 필요. CORS를 통제할 수 없는 서드파티 API는 쓰지 마라(프록시 서버를 둘 수 없다 — Server-Side Forbidden).

## App-in-Toss SDK — Imperative API only

**CRITICAL**: The SDK does NOT provide React hooks. There is no `useTossLogin`, `useTossAd`, `useTossPayment`, `useTossPromotion`. Using these names in code is a FAIL.

**CRITICAL — SDK는 WebView 밖에서 *예외를 던진다*(false 반환 아님)**: 토스 네이티브 브릿지가 없는 환경(로컬 브라우저, 검수자 PC, jsdom)에서는 모든 SDK 호출·probe(`*.isSupported()` 포함)가 `false`를 *반환*하는 게 아니라 **throw**한다. 가드하지 않으면 그 throw가 effect/render를 탈출 → **React 트리 전체 언마운트 → 첫 화면부터 흰 화면**(검수 즉시 반려).
- 모든 SDK 호출·probe를 **try/catch로 감싸고** 실패 시 조용히 degrade(빈 영역/no-op):
  ```typescript
  // ❌ 흰 화면 유발 — isSupported가 throw
  if (TossAds.attachBanner.isSupported()) { ... }
  // ✅ 가드
  function supported() { try { return TossAds.attachBanner.isSupported?.() === true; } catch { return false; } }
  ```
- **마운트 시(useEffect) 호출되는 SDK**(광고 attach, `getSafeAreaInsets`, `getIsTossLoginIntegratedService` 등)는 반드시 가드. 이벤트 핸들러의 `generateHapticFeedback`/`setClipboardText`도 `try { Promise.resolve(call()).catch(()=>{}); } catch {}`로 감싸 미처리 거부 제거.
- 검증: `npm run test:visual`의 스크린샷(e2e/__shots__)이 **흰 화면이 아니어야** 한다(서버측 헤드리스 렌더 게이트가 #root 미마운트를 배포 전 차단함). 새 화면은 e2e/visual-smoke.spec.ts의 ROUTES에 등록해야 스모크가 본다.
- dev 서버(`npm run dev`)는 띄우지 마라 — 띄워도 확인할 수단이 없다(curl/wget은 localhost 포함 전부 거부, `&`로 백그라운드에 띄워도 같다 — 아무것도 읽을 수 없다). 위의 `npm run test:visual`은 playwright가 서버를 직접 띄우므로 dev 서버가 필요 없다; 파이프라인이 네 턴 뒤 브라우저 스모크를 돈다.

Patterns below. For exact signatures, read `.ai-factory/apps-in-toss-essential.txt`.

### Login — 붙이지 마라. 사용자 식별은 식별키(anonKey)다
Toss app session is automatic. Do NOT attempt to call any `login()` function.

**토스 로그인 연동을 새로 붙이지 마라**(2026-07-23 앱인토스 안내). 대부분의 미니앱은
**사용자 식별키(anonKey)**로 충분하다 — 서버 연동·사용자 동의 절차 **없이** 미니앱 안에서
바로 발급되고, 미니앱마다 고유하며 같은 사용자는 항상 같은 값을 받는다(검증 API 제공).
그것만으로 스마트발송·프로모션·토스페이가 된다. 토스 로그인이 필요한 경우는 **본인 확인·
중복가입 방지처럼 앱인토스 밖 계정과 같은 사람인지 연결해야 할 때뿐**이고, 동의 화면
이탈률이 절반에 가까운 미니앱도 있었다. 이 앱은 데이터가 전부 기기 안(localStorage / SDK
`Storage`)이므로 로그인은 순수 마찰이다.

- 식별키는 **`getAnonymousKey()` 하나**다. 시그니처는 `.ai-factory/apps-in-toss-essential.txt` §5.1에
  있다 — 파라미터 없음, 권한 불필요, 반환이 **3분기**다:
  `{ type: 'HASH', hash }`(성공) / `'ERROR'`(오류) / `undefined`(앱 버전 미지원).
  **세 경우를 전부 처리하고** 타입 가드 없이 `.hash`에 접근하지 마라(런타임에 터진다).
- `getUserKeyForGame()`은 **deprecated 별칭**이다(개발자센터 문서: "타입과 동작이 동일합니다").
  비게임/게임 구분이 아니라 구버전/신버전이므로 새 코드에서 쓰지 마라.
- 그 전에 물어라: **식별키가 정말 필요한가.** 기기 로컬 저장으로 끝나는 화면이면 아무것도 부르지 마라.
- `getIsTossLoginIntegratedService()`는 **연동 상태 조회**이지 로그인이 아니다 — 그대로 써도 된다:
```typescript
import { getIsTossLoginIntegratedService } from '@apps-in-toss/web-framework';
const integrated = await getIsTossLoginIntegratedService();
```

### Payment (IAP)
```typescript
// ⚠️ IAP는 `IAP` 네임스페이스 아래에 있다(.d.ts 검증). 최상위 import는 빌드 에러.
import { IAP } from '@apps-in-toss/web-framework';
const cleanup = IAP.createOneTimePurchaseOrder({   // 반환: cleanup 함수
  options: {
    sku: import.meta.env.VITE_TOSS_IAP_SKU,   // 콘솔 발급값 — 리터럴 금지
    processProductGrant: async ({ orderId }) => { /* backend */ return true; },
  },
  onEvent: (e) => { /* e.data.orderId etc. */ },
  onError: (err) => { /* ... */ },
});
```
For subscriptions: `IAP.createSubscriptionPurchaseOrder` (same pattern + `offerId` option).
React 컴포넌트가 필요하면 템플릿의 `src/components/TossPurchase.tsx`(가드+cleanup 래퍼)를 쓴다.
NEVER use Stripe, PG, or external payment.

### Ads
Imperative API with callback. React wrappers are NOT in the SDK:
```typescript
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';

// For reward/interstitial ads
const slotId = import.meta.env.VITE_TOSS_AD_SLOT_ID;   // 콘솔 발급값 — 리터럴 금지
if (!slotId) return;                                    // 값이 없으면 광고 영역을 렌더하지 않는다
loadFullScreenAd({ slotId, onEvent: (e) => { /* loaded */ }, onError: (err) => {} });
showFullScreenAd({ slotId, onEvent: (e) => { /* rewarded/dismissed */ }, onError: (err) => {} });
```
Banner: `TossAds.initialize({})` then `TossAds.attachBanner(adGroupId, targetEl, options?)` returning `{ destroy }`. All methods expose `.isSupported()`. (NOT `loadAdMob` / `showAdMob` — those don't exist in the SDK.)

**If you need a React gate component (e.g., "watch ad before seeing result"), build it in `src/components/` yourself using the imperative API above.** Do NOT import `TossRewardAd` or `AdSlot` from the SDK — they don't exist.

Reward Ad Pattern: gate only the final payoff moment — never intermediate steps or navigation.

### Promotion (user rewards)
```typescript
import { grantPromotionReward } from '@apps-in-toss/web-framework';
await grantPromotionReward({ promotionCode: import.meta.env.VITE_TOSS_PROMOTION_CODE, amount: 1000 });  // 콘솔 발급값 — 리터럴 금지
```
- 1인당 누적 5,000원 한도 (`amount > 5000` 호출 금지)
- `promotionCode`는 앱인토스 콘솔 발급 필수
- 활용: 첫 사용 보상, 친구 초대, 이벤트

### Navigation
NEVER use `window.location.href` for external URLs. Use `openURL` from SDK (subject to review policy — external links discouraged).

### Storage
Either browser localStorage (ephemeral, test-friendly) or SDK `Storage` (native persistence):
```typescript
import { Storage } from '@apps-in-toss/web-framework';
await Storage.setItem('key', JSON.stringify(data));
const raw = await Storage.getItem('key');
```

### Analytics — SDK only, external tools forbidden
외부 로깅/분석 솔루션(GA, Amplitude 등)은 검수 반려 사유다. 계측은 SDK `Analytics`로만 한다.
**단 앱 코드는 `Analytics`를 직접 부르지 않는다** — 아래 '계측·리뷰·공유' 절의 래퍼를 써라.

## 계측 · 리뷰 · 공유 (Pre-built — 재구현 금지)

`src/lib/analytics.ts` · `src/lib/review.ts` · `src/lib/share.ts`가 **이미 있다.** SDK를 직접
import하지 말고 이 래퍼를 써라. 래퍼는 **절대 throw하지 않으므로** 호출부에 try/catch가 필요 없다
(SDK 원본은 WebView 밖에서 throw해 흰 화면을 만든다 — 위 'SDK는 WebView 밖에서 예외를 던진다' 절).

```typescript
import { logClick, logImpression } from '@/lib/analytics';
import { requestReviewOnce } from '@/lib/review';
import { shareApp } from '@/lib/share';
```

**왜 하나 — 이것이 매출을 만든 장치다.** 단독 운영 미니앱 8개로 하루 246만원을 만든 개발자의
방법은 기능 추가가 아니라 **계측 → 진단 → 한 수**였다: 행동 로그로 이탈 절벽(ZIP 받기 83%→31%)을
찾아 알림 하나를 붙였더니 최종 전환이 9%→14%가 됐다. 로그가 없으면 어디가 새는지 **알 방법이
없다**. 그리고 리뷰는 호출 시점만 바꿔 100개 → 6,000개가 됐고, [8-27] 개편으로 평점·리뷰가
미니앱 **상세 페이지에 공개**되므로 유통에 직결된다.

### 화면 로그 — 자동이다. 직접 부르지 마라
`PageShell`(그리고 그것을 감싸는 `ScreenScaffold`)이 `useScreenLog`로 **이미** 화면 진입 로그와
3초 이상 체류 로그를 남긴다. 페이지에서 `logScreen`이나 `useScreenLog`를 또 부르면 **같은 화면이
두 번 집계**돼 퍼널 숫자가 조용히 틀어진다. 페이지 컴포넌트가 할 일은 없다.

### 클릭 로그 — 네가 붙여야 한다
주요 CTA·결과 보기·공유·결제 버튼의 `onClick` **안**에서 부른다.

```tsx
<Button onClick={() => { logClick('calculate_submit'); handleSubmit(); }}>계산하기</Button>
```

- 모든 버튼에 붙이지 마라. **핵심 여정의 전환 지점**(제출·결과 보기·저장·공유·결제)만이다.
- `log_name`은 **한 번 정하면 바꾸지 마라.** 이벤트명이 바뀌면 대시보드 히스토리가 끊겨
  퍼널 비교가 불가능해진다 — 계측의 목적 자체가 사라진다.
- 이름은 `snake_case` 동사구로: `result_view`, `share_tap`, `record_save`.

### 노출 로그 — 뷰포트에 들어온 시점에
결과 카드·광고 슬롯처럼 **"실제로 보였는가"가 중요한** 요소에만 붙인다.

```tsx
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
  const el = ref.current;
  if (!el) return;
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { logImpression('result_card'); io.disconnect(); }
  }, { threshold: 0.5 });
  io.observe(el);
  return () => io.disconnect();
}, []);

// ref는 **DOM 노드**에 붙어야 한다. Card·SummaryHero 같은 함수 컴포넌트는 forwardRef가
// 아니라 ref를 받지 못한다(tsc 오류이고, 억지로 떼면 ref.current가 영원히 null →
// observer가 안 붙고 노출 로그가 **조용히 0**이 된다). 래퍼 div 한 겹을 두어라(레이아웃 무영향).
return (
  <div ref={ref}>
    <Card>{/* 결과 내용 */}</Card>
  </div>
);
```

**마운트 즉시 부르지 마라** — 화면 아래에 있어 사용자가 **보지 못한 것까지 집계**된다.
그러면 "보였는데 안 눌렀다"와 "아예 안 보였다"를 구분할 수 없어 로그가 거짓말을 한다.

### 리뷰 요청 — 시점이 전부다
`requestReviewOnce()`를 **핵심 태스크 완료 직후**에 부른다 — 결과 화면 도달, 목표 달성, 보상 획득
직후처럼 사용자 만족이 가장 높은 순간이다.

```tsx
useEffect(() => { if (result) requestReviewOnce(); }, [result]);   // 결과가 실제로 나온 뒤
```

- **화면 마운트 시점에 부르지 마라.** 아직 아무 가치도 못 받은 사용자에게 묻는 것이고,
  아래 스로틀 때문에 **그 사용자에게 쓸 수 있는 단 한 번을 버리는** 것이다.
- OS가 **표시를 보장하지 않고** 단기 반복을 스로틀한다. 호출이 resolve됐다고 사용자가 봤다는
  뜻이 아니므로 반환값으로 분기하지 마라.
- 앱 생애 1회 가드는 래퍼(`requestReviewOnce`)가 갖는다. 직접 카운터를 만들지 마라.

### 공유 — 결과 화면에 버튼 하나
```tsx
<Button onClick={() => { logClick('share_tap'); shareApp({ message: '내 결과를 확인해보세요', path: '/result' }); }}>
  공유하기
</Button>
```

- `path`는 미니앱 **내부 경로**다. 받는 사람이 그 화면으로 바로 들어온다.
- 공유 버튼은 **결과 화면에 하나**면 된다. 모든 화면에 달지 마라.
- `share`·`getTossShareLink`를 SDK에서 직접 import하지 마라 — 브릿지 없는 환경에서 던지는
  예외를 `shareApp`이 잡고, 링크 생성이 실패해도 **링크 없이 공유를 내보낸다**(공유 없음보다 낫다).

**계측은 새 기능이 아니다.** 기존 화면의 기존 버튼에 **한 줄**을 붙이는 일이다. 로그를 붙이려고
새 화면·새 설정·통계 대시보드를 만들지 마라.

## 인앱광고 수수료 정책 (2026.04.01~)
- 인앱광고(IAA) 수수료 15% 적용
- 순수익 = 총수익 × 0.85
- 외부 로깅/분석 솔루션 (GA, Amplitude 등) 사용 금지

## 출시 가이드 반복 위반 3종 (2026-09-10 공지 — 9/30부터 비게임 미니앱 전수 점검)

앱인토스가 2026-09-30부터 한 달간 **운영 중인 비게임 미니앱 전체**의 출시 가이드 준수 여부를
순차 점검한다. 결과는 콘솔·이메일로 개별 안내되고, 안내일로부터 **14일 안에 수정·재검수 승인**을
받지 못하면 노출이 중단된다. 공지가 "여러 미니앱에서 반복적으로 확인된 사례"로 아래 셋을 명시했다 —
추측이 아니라 **심사원이 실제로 보는 목록**이다.

### ① 상단 뒤로가기·닫기 버튼을 직접 만들지 마라 (중복 노출)
토스 내비게이션 바가 뒤로가기와 닫기를 **이미 제공한다**. 미니앱이 화면 상단에 같은 버튼을 또
그리면 중복 노출이고, 그것이 반복 확인 사례 ①이다.

- `<Top>`에는 title만 둔다. 좌측 `←`·우측 `✕` 아이콘 버튼을 넣지 마라.
- 상단 버튼의 onClick으로 `navigate(-1)`·`history.back()`·`window.history.back()`을 쓰지 마라.
  파이프라인 정책 스캔이 이 세 형태를 **[WARN]으로 센다**(차단은 아니다 — 아래 예외 때문이다).
- **예외 — 다단계 폼·위저드의 '이전'**: 본문 안에서 **단계 상태를 되돌리는** 버튼은 상단 내비가
  아니므로 괜찮다. 단 화면 상단이 아니라 본문/하단 CTA 영역에 두고, 라우터 히스토리가 아니라
  step 상태를 줄여라(`setStep(s => s - 1)`). 그러면 위 WARN도 뜨지 않는다.
- 앱 안에서 필요한 것은 **전진 경로**다 — '홈으로'·'다시 계산'·'다음'. 화면 밖으로 나가는 일은
  토스 내비게이션 바가 한다.

### ② 뒤로가기·닫기가 동작해야 한다
앱 스킴(`intoss://{appName}`)으로 진입한 뒤에도 토스 내비 바의 뒤로가기가 정상 동작해야 한다.
이건 라우팅 런타임 문제라 정적 스캔으로 잡을 수 없다 — **게이트가 없으니 여기서 막는다.**

- 라우터 basename과 브라우저 히스토리를 깨뜨리는 커스텀 네비게이션을 만들지 마라. 화면 이동은
  React Router의 `<Link>`와 `useNavigate()`만 쓴다. `src/main.tsx`·`src/App.tsx`의 basename 설정은
  `@AI:ANCHOR`이므로 수정 금지다(basename이 없으면 어떤 Route도 매칭되지 않아 흰 화면이 된다).
- `navigate(path, { replace: true })`를 일반 화면 이동에 쓰지 마라 — 히스토리가 쌓이지 않아 뒤로가기가
  죽는다. replace는 최초 진입 리다이렉트에만 쓴다.
- `history.pushState`/`popstate`를 직접 만지지 마라. React Router가 관리하는 히스토리와 어긋난다.
- 모달·바텀시트를 URL 없이 열었다면, 뒤로가기로 닫히지 않는다는 뜻이다. 닫기 버튼을 **본문 안에**
  두거나(모달 자체 UI는 상단 내비가 아니다) 라우트로 만들어라.

### ③ 테스트 광고 키·테스트 프로모션 키를 배포하지 마라
`slotId`(리워드·전면) · `adGroupId`(배너) · `sku`(인앱결제) · `promotionCode`(프로모션)는 전부
**앱인토스 콘솔이 발급하는 값**이다. 발급 전 자리표시자가 그대로 배포되면 반복 확인 사례 ③이다.

- 그 자리에 `"test…"`·`"sample…"`·`"demo…"`·`"dummy…"`·`"xxx"`·`"TODO"`·`"changeme"` 같은 값을
  리터럴로 쓰지 마라. 파이프라인 정책 스캔이 **[WARN]으로 센다**(차단은 아니다 — 이 공장은 아직
  env를 자동 주입하지 않아 네가 올바른 값을 넣을 방법이 없을 수 있다. 그래도 리터럴은 쓰지 마라).
  스캔이 보는 것은 `slotId`/`adGroupId`/`adUnitId`/`sku`/`promotionCode`/`offerId` **라는 이름**
  (또는 `DEFAULT_SLOT_ID`처럼 그 이름으로 끝나는 식별자) **바로 뒤에 붙은 문자열 리터럴**이다.
- 값은 `import.meta.env.VITE_*`로 주입받고, **값이 없으면 그 영역을 렌더하지 마라.** SDK 가드와
  같은 degrade 규칙이다 — 빈 영역이지 흰 화면이 아니다.
- 콘솔 발급값은 네가 알 수 없다. 그러니 광고·결제·프로모션을 **핵심 여정의 통과 조건으로 만들지
  마라** — 광고가 하나도 뜨지 않아도 사용자는 앱의 목적을 끝까지 달성할 수 있어야 한다.

## Native Vibe (토스 네이티브 품질 필수)
- **Haptic feedback**: 주요 CTA 버튼에 `generateHapticFeedback({ type: 'success' })`, Toggle/Chip에 `tickWeak`
  ```typescript
  import { generateHapticFeedback } from '@apps-in-toss/web-framework';
  ```
- **Dark mode**: HEX 색상(#FFFFFF, #333 등) 하드코딩 절대 금지 — TDS 컴포넌트 또는 `var(--tds-color-*)` CSS 변수만
- **Safe area**: `position: fixed` 하단 요소에 `paddingBottom: calc(Npx + env(safe-area-inset-bottom))` 필수. `height: 100vh` 단독 금지 → `100dvh`

## 생성형 AI 고지 의무 (해당 시 필수 — 위반 시 과태료 3,000만원)
앱이 AI 기반 결과물(추천/분석/요약/생성)을 사용자에게 노출하는 경우:
- 첫 이용 시 "이 서비스는 생성형 AI를 활용합니다" AlertDialog로 1회 고지
- AI 결과물에 "AI가 생성한 결과입니다" Paragraph.Text(typography="st13") 라벨 표시

## Bundle Limits
- Build output MUST be under 100MB
- Avoid heavy libraries: D3, Three.js, heavy charting libs
- Images/videos: use external CDN
