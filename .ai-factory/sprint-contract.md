# Sprint Contract — Packet 0016: PlanStore Context

## 구현 항목
- **src/hooks/usePlanStore.tsx**: PlanStoreProvider, usePlanStore 훅
  - 마운트 시 loadPlan, isPlanCorrupted, loadRecords 호출
  - ensureMonthRecords 결과가 changed면 자동 저장
  - 노출: plan, corrupted, allocation, records, currentRecord, savePlan(plan), toggleBucket(k)
  - 저장 실패 → 이전 상태 롤백
- **src/hooks/__tests__/usePlanStore.test.tsx**: 3~5 focused tests (마운트/저장/롤백)

## 타입 (types.ts에서 import)
- Plan, PlanDraft, MonthRecord, MonthRecordMap, Allocation, SaveResult, BucketKey

## 검증
- `npx tsc --noEmit` 통과
- `npx vitest run` 통과
- usePlanStore를 최소 한 곳 이상에서 호출 가능한 상태 확인

## 금지사항
- main.tsx, App.tsx 수정 (0017이 배선)
- 로컬 상태에 savings/allocation 중복 계산 (lib/calc 유틸 활용)
- types.ts 타입 재정의 금지 (기존 types.ts 타입만 사용)
