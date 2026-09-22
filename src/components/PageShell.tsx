import type { CSSProperties, ReactNode } from "react";
import * as RouterDom from "react-router-dom";
import * as AnalyticsLib from "../lib/analytics";

/**
 * 네임스페이스에서 함수 하나를 **모듈 로드 시 1회만** 꺼낸다. 없으면 폴백을 쓴다.
 *
 * `try`가 반드시 필요하다 — `typeof` 가드만으로는 못 막는다. 테스트가
 * `vi.mock("react-router-dom", () => ({ useNavigate }))`처럼 **팩토리로 부분 목**을 걸면
 * vitest가 반환 객체를 Proxy로 감싸고, 팩토리에 없는 키를 **읽는 순간** throw한다
 * (`No "useInRouterContext" export is defined on the … mock` — 템플릿 vitest 3.2.4 · 루트 4.0.18 양쪽에서 실측).
 * 그 접근이 모듈 최상위에 있으면 PageShell 모듈 평가가 터져, 페이지를 import한 테스트 파일이
 * 케이스 하나가 아니라 **통째로** `no tests`로 죽는다. 그 앱의 코딩 에이전트는 자기가 만들지도
 * 않은 템플릿 파일에서 나는 오류라 고치지 못하고 픽스루프 콜만 태운다.
 *
 * 계측 한 줄이 화면(또는 테스트 파일)을 죽이는 것보다 계측 경로가 하나 줄어드는 쪽이 낫다
 * (무인 불변식 1). lib/analytics·review·share가 모든 SDK 접근을 try 안에 두는 것과 같은 규약이다.
 */
function pick<T>(ns: unknown, key: string, fallback: T): T {
  try {
    const fn = (ns as Record<string, unknown>)[key];
    return typeof fn === "function" ? (fn as T) : fallback;
  } catch {
    return fallback;
  }
}

/** 라우터 컨텍스트 존재 확인 훅. 모듈 로드 시 확정해 렌더마다 훅 순서가 바뀌지 않게 한다(조건부 훅 금지). */
type InRouterProbe = () => boolean;
const useInRouter: InRouterProbe = pick<InRouterProbe>(RouterDom, "useInRouterContext", () => false);

/**
 * 화면·체류 로그 훅. 같은 이유로 방어한다 — 이번 배치의 spec 프롬프트가 `logClick(...)`을 AC로
 * 내보내므로 TDD 테스터가 `vi.mock("@/lib/analytics", () => ({ logClick: vi.fn() }))`를 쓰기 쉽고,
 * 그러면 `useScreenLog` 접근이 던져 **PageShell로 감싼 모든 화면의 렌더 테스트**가 죽는다.
 * 폴백은 훅을 부르지 않는 no-op이며, 모듈 로드 시 한 번 확정되므로 훅 순서는 불변이다.
 * 올바른 목 형태는 `mocks.ts`의 `mockAnalytics()`와 `.claude/rules/testing.md`가 가르친다.
 */
type ScreenLogHook = (page: string) => void;
const useScreenLog: ScreenLogHook = pick<ScreenLogHook>(AnalyticsLib, "useScreenLog", () => {});

/**
 * 라우터 밖 폴백 경로. basename이 붙는 폰 미리보기에서는 앞에 `/<repo>/`가 섞이지만,
 * 미리보기에는 애초에 SDK가 실리지 않는다(심 빌드) — 운영에서는 항상 라우터 안이라
 * 이 경로를 밟지 않는다.
 */
function currentPathname(): string {
  try {
    return window.location?.pathname || "/";
  } catch {
    return "/";
  }
}

/**
 * `useLocation`도 같은 규약으로 꺼낸다 — 마지막 남은 맨몸 named import였다.
 * 폴백은 window 경로를 읽는다(라우터가 없다고 판정된 상황과 같은 값).
 */
type UseLocation = () => { pathname: string };
const useLocationSafe: UseLocation = pick<UseLocation>(RouterDom, "useLocation", () => ({
  pathname: currentPathname(),
}));

/**
 * 계측 전용 자식. `useLocation`은 Router 밖에서 **throw**하므로 훅 호출을 이 컴포넌트
 * 안에 가둔다 — 조건부로 훅을 부르는 대신 **컴포넌트를 조건부로 렌더**한다.
 */
function RoutedScreenLog() {
  const { pathname } = useLocationSafe();
  useScreenLog(pathname);
  return null;
}

function StaticScreenLog({ page }: { page: string }) {
  useScreenLog(page);
  return null;
}

/**
 * 페이지 SafeArea 래퍼 — 모든 페이지의 최상위 컨테이너.
 * 100dvh(NOT 100vh) + safe-area 패딩 + adaptive 배경을 일관되게 적용한다.
 *
 * **화면 로그는 여기서 자동으로 남는다.** 페이지 이름은 `useLocation().pathname`에서
 * 뽑는다 — 사람이 화면마다 이름을 지으면 밤마다 달라져 대시보드 히스토리가 끊긴다.
 * 직접 지정해야 하면 `page` prop이 우선한다.
 *
 * Pre-built (재구현 금지): 새 페이지는 이 컴포넌트로 감싸라.
 * 헤더/하단 CTA까지 한 번에 두려면 ScreenScaffold를 쓰라.
 */
export function PageShell({
  children,
  style,
  page,
}: {
  children: ReactNode;
  style?: CSSProperties;
  page?: string;
}) {
  const inRouter = useInRouter();

  return (
    <div
      style={{
        minHeight: "100dvh",
        paddingTop: "calc(var(--toss-safe-area-top) + 16px)",
        paddingBottom: "calc(var(--toss-safe-area-bottom) + 16px)",
        backgroundColor: "var(--adaptiveBackground)",
        ...style,
      }}
    >
      {page !== undefined ? (
        <StaticScreenLog page={page} />
      ) : inRouter ? (
        <RoutedScreenLog />
      ) : (
        <StaticScreenLog page={currentPathname()} />
      )}
      {children}
    </div>
  );
}
