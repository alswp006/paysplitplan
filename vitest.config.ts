import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // 테스트는 src/ 아래에만 둔다(규칙서: src/__tests__). vitest 기본 include는 점(.) 디렉토리까지
    // 훑어서, 이 폴더에 들어 있는 **vitest가 아닌** 테스트 파일을 수집하다 전체 실행이 exit 1로 끝난다.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // include를 누가 넓혀도 아래는 vitest 대상이 아니다(각자 자기 러너가 돈다):
    //  - e2e/**         : Playwright 비주얼 스펙(e2e/visual-smoke.spec.ts — Playwright가 돈다)
    //  - .ai-factory/** : 파이프라인 QA 팩. 공장 레포의 nightcrew pack(apps/orchestrator/src/nightcrew/pack.ts —
    //                     이 앱 안의 파일이 아니다)이 빌드 검증 끝에 .ai-factory/qa-pack/scenarios/smoke.spec.ts
    //                     (Playwright)를 쓰고 그대로 커밋된다
    //  - scripts/**     : scripts/__tests__/forbidden-patterns.test.mjs(node:test — vitest로 돌리면
    //                     "No test suite found"로 실패로 세어진다)
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '.ai-factory/**', 'scripts/**'],
    // 워커 폭발 방지(실사고 2026-07-21 global OOM/exit 137): vitest 기본은 CPU 코어 수만큼
    // 포크를 띄운다(16스레드 머신=최대 16개, 각 수백 MB) → jsdom 로드까지 겹쳐 WSL 총 메모리
    // 소진. 미니앱은 테스트 파일이 3~5개라 2포크로 충분하고 메모리를 8배 이상 줄인다.
    pool: 'forks',
    poolOptions: { forks: { minForks: 1, maxForks: 2 } },
  },
});
