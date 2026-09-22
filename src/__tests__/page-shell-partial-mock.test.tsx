/**
 * **부분 목 회귀** — `vi.mock(path, factory)`은 팩토리가 돌려주지 않은 export를 **읽는 순간**
 * throw한다(vitest 프록시 get 트랩). `PageShell`이 모듈 최상위에서 `react-router-dom`과
 * `@/lib/analytics`의 심볼을 꺼내므로, 코딩 에이전트가 습관대로 부분 목을 걸면 예전에는
 * **그 테스트 파일이 통째로** `no tests`로 죽었다(케이스 실패가 아니라 수집 단계 실패).
 * 화면 패킷 전부가 대상이고, 오류는 에이전트가 만들지도 않은 템플릿 파일을 가리킨다.
 *
 * 아래 두 목은 **일부러 불완전하게** 걸었다. 렌더가 살아 있으면 방어가 유효한 것이다.
 * (올바른 목 형태는 `__helpers__/mocks.ts`의 `mockAnalytics()`·`mockRouter()`를 써라 —
 *  이 파일은 "틀리게 써도 밤이 안 죽는가"를 무는 자리다.)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// useInRouterContext·useLocation 없음 — 예전 코드에서 모듈 평가가 터지던 모양.
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
// useScreenLog 없음 — 이번 배치의 spec 프롬프트가 유도하는 모양.
vi.mock("@/lib/analytics", () => ({ logClick: vi.fn() }));

import { PageShell } from "@/components/PageShell";

describe("PageShell — 불완전한 부분 목에서도 살아남는다", () => {
  it("모듈 평가가 터지지 않고 children을 렌더한다", () => {
    render(<PageShell><p>본문</p></PageShell>);
    expect(screen.getByText("본문")).toBeInTheDocument();
  });

  it("page prop 경로도 같다", () => {
    render(<PageShell page="/result"><p>결과</p></PageShell>);
    expect(screen.getByText("결과")).toBeInTheDocument();
  });
});
