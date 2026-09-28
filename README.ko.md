🇰🇷 [English](./README.md)

# 월급쪼개기 — 월급 배분 및 예산 관리 추적기

사용자가 월급을 지출 카테고리에 따라 어떻게 배분할지 계획하고 추적하는 데 도움을 주는 미니앱입니다. 배분 계획을 만들고, 고정 비용을 설정하며, 월별 기록을 보고 예산을 효과적으로 관리하세요.

## 기능

- 📊 **월급 배분 계획** — 비율 및 고정 비용으로 월급을 나누기
- 📝 **계획 관리** — 여러 개의 배분 계획 생성, 편집, 저장
- 📈 **월별 추적** — 실제 지출이 계획과 어떻게 맞는지 기록하고 보기
- 🏠 **홈 대시보드** — 현재 계획의 빠른 개요 및 급여일 카운트다운
- 📋 **기록** — 지난달 기록 및 계획 스냅샷 조회
- 🎯 **계획 템플릿** — 일반적인 배분 패턴을 위한 빠른 시작 프리셋
- 🔔 **햅틱 피드백** — 주요 상호작용에서 물리적 피드백
- 🌙 **다크 모드** — 낮과 밤을 위한 적응형 색상

## 기술 스택

- **Frontend**: React 18 + TypeScript
- **Build**: Vite 6
- **Routing**: React Router DOM 7
- **UI**: Toss Design System (TDS Mobile)
- **Styling**: Emotion
- **Icons**: Lucide React
- **Platform**: App-in-Toss Web Framework (Toss 미니앱 SDK)
- **Testing**: Vitest + Playwright
- **Storage**: 브라우저 localStorage만 사용 (백엔드 없음)

## 시작하기

### 사전 요구사항

- Node.js 18+
- npm

### 설치

```bash
npm install
```

### 개발

타입 체크:
```bash
npx tsc --noEmit
```

테스트 실행:
```bash
npx vitest run
```

비주얼 회귀 테스트 실행:
```bash
npm run test:visual
```

### 프로덕션 빌드

정적 Vite 빌드의 경우:
```bash
npm run build
```

Toss App-in-Toss 배포의 경우:
```bash
npx ait build
```

빌드 결과물은 `dist/` 디렉토리에 생성되며, Toss CDN에 배포할 준비가 완료됩니다.

## 환경 변수

| 변수 | 설명 | 필수 |
|---|---|---|
| `VITE_SHARE_OG_URL` | 공유 미리보기용 Open Graph 이미지 URL (KakaoTalk, SMS) | 아니오 |
| `VITE_TOSS_AD_SLOT_ID` | Toss 콘솔의 리워드/전면광고 슬롯 ID | 아니오 |
| `VITE_TOSS_IAP_SKU` | Toss 콘솔의 인앱 결제 SKU | 아니오 |
| `VITE_TOSS_PROMOTION_CODE` | Toss 콘솔의 프로모션 보상 코드 | 아니오 |

`.env.example`을 `.env`로 복사하고 Toss 개발자 콘솔의 값을 입력하세요. 빈 값은 자동으로 처리됩니다 — 해당 기능을 사용할 수 없을 뿐입니다.

## 프로젝트 구조

```
src/
├── pages/           # 라우트 페이지 (Home, Plan, Result, History)
├── components/      # 재사용 가능한 TDS 컴포넌트 (ScreenScaffold, SummaryHero 등)
├── lib/             # 유틸리티 (저장소, 분석, 날짜, 포맷팅)
├── __tests__/       # Vitest 단위 및 통합 테스트
e2e/
├── visual-smoke.spec.ts   # Playwright 비주얼 회귀 테스트
├── __shots__/             # 기준 스크린샷
```

주요 유틸리티 모듈:
- `src/lib/storage.ts` — localStorage 지속성 (계획, 기록, 리뷰 요청 상태)
- `src/lib/analytics.ts` — Toss SDK 분석 래퍼
- `src/lib/date.ts` — 날짜 유틸리티 및 ISO 타임스탬프 헬퍼
- `src/lib/format.ts` — 통화 및 금액 파싱
- `src/lib/plan.ts` — 계획 비즈니스 로직 및 검증

## 배포

### 사전 요구사항

1. Toss App-in-Toss 개발자 콘솔에서 앱 등록
2. `appName` 획득 (대소문자가 정확히 일치해야 함)
3. `.env`에 환경 변수 설정

### 배포 단계

1. **빌드**:
   ```bash
   npm run build
   ```

2. **확인**:
   - TypeScript 에러 없음: `npx tsc --noEmit`
   - 테스트 실패 없음: `npx vitest run`
   - 비주얼 회귀 없음: `npm run test:visual`

3. **Toss 콘솔을 통해 배포**:
   - Toss App-in-Toss 개발자 콘솔에 로그인
   - `dist/` 폴더 업로드
   - 검수 신청

이 앱은 CSR (클라이언트 사이드 렌더링)만 실행됩니다 — 서버 사이드 렌더링은 없습니다. 모든 사용자 데이터는 브라우저 저장소에 로컬로 저장됩니다.

## 라이선스

MIT
