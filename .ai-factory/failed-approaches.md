
## 엔티티 타입과 RouteState 계약 정의 — fix loop 2026-09-22T15:56:17.846Z
- 시도 횟수: 1
- 트리아지: trivial (2 minor tsc errors)
- 에러 변화:
  Attempt 1: initial errors — tsc:2|lint:0|test:0
- 비용: $0.1743
- 수정된 파일:
 .ai-factory/shared-context.md                  | 77 +++++++++++++++++++++++++-
 src/__tests__/page-shell-partial-mock.test.tsx | 13 ++++-
 src/lib/contract.ts                            |  5 ++
 src/lib/types.ts                               | 66 +++++++++++++++++++++-
 4 files changed, 157 inserti
