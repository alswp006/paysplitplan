# Sprint Contract: 라우팅 연결 (App.tsx 단일 소유)

## 만들 항목
- **src/App.tsx**: 스캐폴드가 기본 라우트를 깔았으므로, 전역 Provider(TDS, Toast 필요시)를 `<Routes>` 감싸는 자리에 추가만 함. 라우트 경로는 변경하지 않음 ('/', '/plan', '/result', '/history', '*' 순서 유지, NotFound가 마지막).
- **src/__tests__/routes.test.tsx**: 라우트 진입점 테스트 (모든 경로 접근 가능 확인, state 전달 확인)

## 사용할 타입
src/lib/types.ts에서 import: `SalaryPlan`, `MonthRecord`, `PresetId`, `Ratios`, `PlanDraft`, `CategoryKey`

## 검증 방법
```bash
npx tsc --noEmit          # TypeScript 타입 에러 0개
npx vitest run            # routes.test.tsx 포함 전체 테스트 통과
npm run test:visual       # 시각 스모크 통과
```

## 절대 금지
- `src/main.tsx` 수정 금지 (@AI:ANCHOR)
- 라우트 경로 순서 변경 금지 (NotFound `*`는 항상 마지막)
- Router basename 변경 금지 (main.tsx 설정 따름)
- TDS/Toast Provider 중복 추가 금지 (템플릿에 이미 있으면 그대로 둠)

## 완료 조건
- App.tsx가 정확히 5개 라우트 정의 (/, /plan, /result, /history, *)
- routes.test.tsx가 모든 경로 접근 + state 전달 케이스 커버
- `npm run build` 성공
