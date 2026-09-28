# Sprint Contract — Packet 0019 (최종 통합 & 검수 폴리시)

## 만들 항목
1. **scripts/audit-rules.mjs** — AC-C1(뒤로가기 중복 /Top 자작 버튼), C3(외부 이탈 outlink), C4(console.error 0회), C5(테스트 키 리터럴: test*/sample*/demo*/dummy*/xxx/TODO/changeme), C6(외부 로깅 SDK: GA/Amplitude)의 grep 규칙 자동 검사
2. **src/__tests__/fullFlow.test.tsx** — 통합 E2E: / → /plan (데이터입력) → /result (저장) → / (체크 4개 검증) → /history (기록 조회) → /does-not-exist (404) → / (복귀). 광고env 비어있는 상태 + console.error 0회 assertion

## 사용 타입
- `SalaryPlan`, `MonthRecord`, `PlanDraft`, `CategoryKey`, `Ratios` (types.ts import)
- localStorage: salaryPlans (array), monthRecords (Record<string, MonthRecord>)

## 검증 방법
- `npm run audit` → audit-rules.mjs 실행, 위반 항목 리포팅
- `npx vitest run` fullFlow.test.tsx → console.error 수집 및 0회 assertion
- `npm run test:visual` → 흰 화면/버튼 중첩/빈 칸 확인

## 절대 금지
- **main.tsx/App.tsx 수정** — @AI:ANCHOR 파일
- 라우팅 변경 (/, /plan, /result, /history, * 고정)
- 테스트 키 hardcode (audit 스캔 대상)
