# App-in-Toss Development Master Guide for AI Agents

This document contains the absolute rules from the latest official Toss documentation (2026) for developing mini-apps that run inside the Toss app. The AI MUST prioritize these rules above all else when generating code.

## GROUND TRUTH
**For exact SDK API usage, read `.ai-factory/apps-in-toss-essential.txt` — it contains verified exports from the installed `@apps-in-toss/web-framework` `.d.ts` files.** Do not guess SDK API names; if not in that reference, it doesn't exist.

## 1. Architecture & Runtime Environment
- **Rendering:** App-in-Toss WebView supports SSG or CSR ONLY. **Dynamic SSR strictly forbidden.** Next.js requires `output: 'export'` in `next.config.mjs`.
- **Minimum OS support:** Android 7+, iOS 16+.
- **Routing scheme:** `intoss://{appName}` for sandbox and production testing.

## 2. Dependencies & Package Installation
- **Package name:** `@apps-in-toss/web-framework` (NOT `@apps-in-toss/framework` — that's a legacy/wrong name)
- **Install command:** `npm install @apps-in-toss/web-framework@latest @toss/tds-mobile@latest @emotion/react@^11`
- Always use `@latest` for Toss packages — hardcoded old versions cause ETARGET errors.
- **TDS is mandatory:** Custom UI to mimic TDS components → instant review rejection.

## 3. Configuration (`apps-in-toss.config.ts` — SDK v3, 2026-07-31~)
- 설정 파일명이 v3에서 `granite.config.ts` → `apps-in-toss.config.ts`로 바뀌었다. **이 파일을 수정하거나 granite.config.ts를 새로 만들지 마라** — 스캐폴드가 이미 올바른 값으로 생성했다.
- `appName`: English app ID registered in console (case-sensitive — mismatch causes 4031 deploy error). **수정 금지.**
- `brand.primaryColor`: TDS theme color (RGB HEX, e.g., `#3182F6`)
- `permissions`: Device permissions array (e.g., `{ name: "clipboard", access: "write" }`)
- v2에 있던 `displayName`·`icon`은 v3에서 **콘솔 등록 정보로 이관** — config에 넣어도 무시된다.

## 4. TDS (Toss Design System) Absolute Rules
- **NEVER override margin/padding:** TDS components have built-in padding. Use TDS `Spacing` (size prop required) for gaps. ListRow has NO padding prop.
- **Use auto-layout:** Flexbox `gap` only.
- **No external fonts:** Toss Products Sans auto-applied.

## 5. Core API & SDK Integration

**Import from `@apps-in-toss/web-framework`.** All SDK APIs are **imperative functions with `onEvent`/`onError` callbacks**, not React hooks.

**There are NO `useTossLogin`, `useTossAd`, `useTossPayment` hooks in the SDK.**

### Haptic feedback
```typescript
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
generateHapticFeedback({ type: "tickWeak" });    // Toggle, Chip
generateHapticFeedback({ type: "success" });      // Major CTA
```

### Storage (native persistence)
```typescript
import { Storage } from '@apps-in-toss/web-framework';
await Storage.setItem('key', 'stringValue');
const value = await Storage.getItem('key');  // string | null
await Storage.removeItem('key');
```

### Promotion (user rewards)
```typescript
import { grantPromotionReward } from '@apps-in-toss/web-framework';
await grantPromotionReward({
  promotionCode: import.meta.env.VITE_TOSS_PROMOTION_CODE,  // 콘솔 발급값 — 리터럴 금지
  amount: 1000,                       // ≤ 5000 per user (cumulative)
});
```

### Ads — imperative only, NOT React components
- Banner: `TossAds` namespace — `TossAds.initialize({})` once, then `TossAds.attachBanner(adGroupId, targetEl, options?)` returns `{ destroy }` for cleanup
- Reward/Interstitial: `loadFullScreenAd` + `showFullScreenAd` — top-level functions with `onEvent` / `onError` callbacks
- All TossAds methods have `.isSupported()` for capability check before use
- **NO `loadAdMob` / `showAdMob` / `isAdMobLoaded` exports** — those names do not exist in the SDK
- **NO `TossRewardAd` or `AdSlot` in the SDK.** If needed as React component, wrap the imperative API in `src/components/` yourself. See `.ai-factory/apps-in-toss-essential.txt`.

### Login — 붙이지 마라. 사용자 식별은 식별키(anonKey)다
Toss app provides user session automatically. NO `useTossLogin` or `login()` to call.

**토스 로그인 연동을 새로 붙이지 마라**(2026-07-23 앱인토스 안내). 대부분의 미니앱은
**사용자 식별키(anonKey)**로 충분하다 — 서버 연동·사용자 동의 절차 **없이** 미니앱 안에서 바로
발급되고, 미니앱마다 고유하며 같은 사용자는 항상 같은 값을 받는다(검증 API 제공). 그것만으로
스마트발송·프로모션·토스페이가 된다. 토스 로그인은 **본인 확인·중복가입 방지처럼 앱인토스 밖
계정과 같은 사람인지 연결해야 할 때만** 필요하고, 동의 화면 이탈률이 절반에 가까운 미니앱도
있었다 — 이 앱은 데이터가 전부 기기 안에 있으므로 로그인은 순수 마찰이다.

- 식별키는 **`getAnonymousKey()` 하나**다(파라미터 없음 · 권한 불필요). 반환이 3분기이므로
  `{ type: 'HASH', hash }` / `'ERROR'` / `undefined`를 **전부 처리**하라 — 시그니처는
  `.ai-factory/apps-in-toss-essential.txt` §5.1에 있다. `getUserKeyForGame()`은 deprecated 별칭
  (타입·동작 동일)이므로 새 코드에서 쓰지 마라.
- `getIsTossLoginIntegratedService()`는 **연동 상태 조회**이지 로그인이 아니다 — 그대로 써도 된다
  (콘솔에서 설정한다).

### In-App Purchase (IAP)
```typescript
// ⚠️ IAP는 `IAP` 네임스페이스 아래에 있다. 최상위 createOneTimePurchaseOrder import는 존재하지 않음.
import { IAP } from '@apps-in-toss/web-framework';
const cleanup = IAP.createOneTimePurchaseOrder({   // 반환: cleanup 함수 (종료 시 호출)
  options: {
    sku: import.meta.env.VITE_TOSS_IAP_SKU,   // 콘솔 발급값 — 리터럴 금지
    processProductGrant: async ({ orderId }) => true,  // backend call
  },
  onEvent: (event) => { /* event.type==='success', event.data */ },
  onError: (error) => { /* ... */ },
});
```
Subscriptions: `IAP.createSubscriptionPurchaseOrder` (same shape + `offerId`).
NO `useTossPayment` hook. React 앱은 `src/components/TossPurchase.tsx` 래퍼 권장.

### Analytics / Review / Share — 템플릿 래퍼를 써라 (SDK 직접 호출 금지)
계측·리뷰·공유는 `src/lib/{analytics,review,share}.ts`가 이미 감싸 두었다. 래퍼는 절대 throw하지
않으므로 호출부에 try/catch가 필요 없다(SDK 원본은 WebView 밖에서 throw → 흰 화면).

```typescript
import { logClick, logImpression } from '@/lib/analytics';
import { requestReviewOnce } from '@/lib/review';
import { shareApp } from '@/lib/share';
```

- **화면 로그는 자동**이다 — `PageShell`/`ScreenScaffold`가 `useScreenLog`로 진입·체류(3초)를
  남긴다. 페이지에서 또 부르면 중복 집계다.
- `logClick`은 **핵심 전환 지점**(제출·결과 보기·저장·공유·결제)의 `onClick` 안에서.
- `logImpression`은 **뷰포트 진입 시점**에(IntersectionObserver). 마운트 즉시 부르면 사용자가
  보지 못한 것까지 집계된다.
- `requestReviewOnce()`는 **핵심 태스크 완료 직후**에. 마운트 시 호출 금지 — OS가 표시를
  보장하지 않고 단기 반복을 스로틀하므로 그 한 번을 버리게 된다.
- `log_name`은 한 번 정하면 바꾸지 마라(히스토리 연속성).
- 상세 패턴과 근거는 `.claude/rules/toss-mini-app.md`의 '계측 · 리뷰 · 공유' 절. 시그니처는
  `.ai-factory/apps-in-toss-essential.txt` §7·§7.1.

## 6. 인앱광고 수수료 정책 (2026.04.01~)
- 인앱광고(IAA) 수수료 15% 적용 — 수익 UI에 순수익/총수익 구분 표시 권장
- 순수익 = 총수익 × 0.85
- 외부 로깅/분석 솔루션 (GA, Amplitude 등) 금지 — 반드시 SDK `Analytics` 사용

## 7. Deployment
- Deploy to Toss CDN (NOT Vercel, AWS, external clouds).
- 배포는 **파이프라인이 실행한다** — `ait` 명령을 직접 실행하지 마라(이 환경에 설치돼 있지 않아 시도는 턴만 태운다). 참고용 명령: ait deploy --api-key <KEY>

## 8. Review Checklist (Must Pass All)
- Users must be 19+ — no minor-targeted content
- No external domain navigation (outlinks) — all flows within the app
- Zero console.error in production build
- Zero CORS errors on external API calls
  - SDK v3 앱의 실행 origin은 두 개다 — 외부 API 서버를 쓰는 설계라면 그쪽 CORS 허용목록에 **둘 다** 있어야 한다:
    운영 `https://<appName>.web.tossmini.com` · QR 테스트 `https://<appName>.private-web.tossmini.com`
    (테스트에서만 CORS로 죽는 앱은 이 둘 중 private-web이 빠진 것)
- Android 7+ / iOS 16+ compatible Web APIs only
- 외부 로깅/분석 솔루션 사용 금지 — SDK `Analytics`만 (앱 코드는 `src/lib/analytics.ts` 래퍼 경유)
- **핵심 전환 지점에 클릭 로그**, 결과 화면에 **공유 버튼**과 **리뷰 요청**이 있을 것 — 검수
  항목이 아니라 출시 후 개선·유통의 전제다(로그가 없으면 이탈 지점을 찾을 수 없고, 리뷰는
  미니앱 상세 페이지에 공개된다). 위 'Analytics / Review / Share' 절 참고
- HEX 색상 하드코딩 금지 — TDS 컴포넌트 또는 `var(--tds-color-*)` CSS 변수만 (다크모드 필수)
- 앱 설치 유도 금지
- 프로모션 지급 한도 — `grantPromotionReward` amount ≤ 5000
- 토스 로그인 연동 추가 금지 — 사용자 식별이 필요하면 사용자 식별키(anonKey). 위 Login 절 참고
- **상단 뒤로가기·닫기 버튼 자체 구현 금지** — 토스 내비게이션 바가 제공한다(중복 노출 = 위반)
- **뒤로가기·닫기가 실제로 동작할 것** — 라우터 basename·히스토리를 깨는 커스텀 네비게이션 금지
- **테스트 광고 키·테스트 프로모션 키 배포 금지** — `slotId`/`adGroupId`/`sku`/`promotionCode`는
  콘솔 발급값이며 `import.meta.env.VITE_*`로 주입한다. 자리표시자 하드코딩 금지
  - 이 앱이 읽는 `VITE_*` 전부와 빈 값의 본보기는 레포 루트 `.env.example`에 있다(운영자가
    `.env`로 복사해 채운다). 공유 미리보기 이미지 `VITE_SHARE_OG_URL`도 여기 있다 —
    **코드에 URL을 하드코딩하지 마라.** 값이 없으면 `shareApp`이 링크만 붙이고 넘어간다

> 위 세 줄(뒤로가기 중복·뒤로가기 미동작·테스트 키)은 2026-09-10 공지가 "여러 미니앱에서
> **반복적으로 확인된 사례**"로 명시한 것이다. 앱인토스는 2026-09-30부터 한 달간 운영 중인
> **비게임 미니앱 전체**를 점검하고, 안내일로부터 14일 안에 수정·재검수 승인을 받지 못한 앱은
> 노출을 중단한다. 상세는 `.claude/rules/toss-mini-app.md`의 '출시 가이드 반복 위반 3종' 절.
