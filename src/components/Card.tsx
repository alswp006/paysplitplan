import { Children, Fragment, isValidElement } from "react";
import type { CSSProperties, ReactNode } from "react";
import * as Tds from "@toss/tds-mobile";

/**
 * 카드 컨테이너 — adaptive 레이어드 배경 + 16px radius + 16px 패딩.
 *
 * Pre-built (재구현 금지): 핵심 정보(전략 비교, 지표, 결과 등)를 카드로 묶어 위계를 만들 때.
 * 결과/비교 화면은 항목을 맨 <div>로 나열하지 말고 이 Card로 감싸라.
 * 내부 텍스트는 TDS Paragraph.Text(typography)로 위계를 표현(핵심 값은 t2~t3 강조).
 *
 * **직접 자식은 세로로 쌓인다**(flex column). Paragraph.Text는 인라인 <span>, Amount는 inline-block이라
 * 맨 블록 안에 나란히 두면 한 줄로 붙는다('이번 회의 비용576원1분 · 6명' — 2026-09-24 실측 7쌍/4앱).
 * 그래서 라벨·값·캡션을 그냥 차례로 넣으면 된다:
 *   <Card>
 *     <Paragraph.Text typography="st11">이번 달 지출</Paragraph.Text>
 *     <Amount value={320000} unit="원" typography="t3" />
 *   </Card>
 * - 간격: 자식 사이 4px. 자식 사이에 <Spacing>을 두면 그 카드는 Spacing이 간격을 전부 정한다(4px를 더하지 않는다).
 * - 가로로 놓을 것(아이콘+텍스트, 값 두 개 나란히)은 자기 행 래퍼(<div style={{ display: "flex" }}>)로 감싼다.
 * - 예전 흐름 배치가 꼭 필요하면 style={{ display: "block" }} — style은 마지막에 합쳐져 이긴다.
 */
export function Card({
  children,
  style,
  testId,
}: {
  children: ReactNode;
  style?: CSSProperties;
  /** 레이아웃 테스트용 data-testid (예: getAllByTestId("strategy-card")) */
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: hasSpacingChild(children) ? 0 : 4,
        padding: 16,
        borderRadius: 16,
        backgroundColor: "var(--adaptiveLayeredBackground)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * TDS Spacing 컴포넌트 — **모듈 로드 시 1회, try 안에서** 꺼낸다(PageShell `pick`과 같은 규약).
 * 테스트가 `vi.mock("@toss/tds-mobile", () => ({ … }))`로 Spacing 없는 부분 목을 걸면 vitest 프록시가
 * 없는 키를 **읽는 순간** throw한다 — 그러면 Card를 쓰는 모든 화면의 테스트가 템플릿 파일에서 죽는다.
 * 못 꺼내면 undefined이고 간격은 기본 4px로 남는다(판정만 하나 줄 뿐 렌더는 산다).
 * 정적 멤버 접근이라 번들러의 트리 셰이킹도 그대로다.
 */
const SPACING_TYPE: unknown = (() => {
  try {
    return Tds.Spacing;
  } catch {
    return undefined;
  }
})();

/**
 * 직접 자식(프래그먼트는 펼친다) 중에 Spacing이 있나. 있으면 작성자가 세로 리듬을 Spacing으로 직접 잡은
 * 카드다(SummaryHero가 그렇다) — 거기에 gap을 더하면 모든 간격이 8px씩 벌어진다.
 */
function hasSpacingChild(children: ReactNode): boolean {
  if (SPACING_TYPE === undefined) return false;
  let found = false;
  Children.forEach(children, (child) => {
    if (found || !isValidElement(child)) return;
    if (child.type === SPACING_TYPE) {
      found = true;
    } else if (child.type === Fragment) {
      found = hasSpacingChild((child.props as { children?: ReactNode }).children);
    }
  });
  return found;
}
