import { useLayoutEffect, type ReactNode } from "react";
import { PageShell } from "./PageShell";
import { SURFACE } from "../lib/theme";

/**
 * 골든 화면 골격 — PageShell + (선택)헤더 슬롯 + 본문(좌우 16px 패딩) + (선택)하단 CTA 슬롯.
 *
 * Pre-built (재구현 금지): 새 페이지는 이 골격으로 시작하라.
 *   <ScreenScaffold
 *     top={<Top title={<Top.TitleParagraph>제목</Top.TitleParagraph>} />}
 *     bottom={<SubmitFooter label="다음" onClick={...} />}
 *   >
 *     ...본문...
 *   </ScreenScaffold>
 *
 * top을 주면 <Top/>이 자체 safe-area를 처리하므로 상단 패딩을 제거한다.
 */
export function ScreenScaffold({
  top,
  children,
  bottom,
  flush,
  surface = "plain",
}: {
  top?: ReactNode;
  children: ReactNode;
  bottom?: ReactNode;
  /**
   * 본문 좌우 패딩을 없앤다. TDS TextField·ListRow·Chip은 자체 좌우 20px 패딩을 갖고 있어
   * 16px 패딩과 겹치면 36px로 들여써지고, 맨 텍스트(16px)와 정렬선이 어긋난다.
   * 그런 폼 화면은 flush로 두고 맨 텍스트만 20px 거터로 감싸 정렬선을 20px 하나로 맞춘다.
   */
  flush?: boolean;
  /**
   * 페이지 바탕. "grouped"면 회색 바탕(--adaptiveGreyBackground) — 흰 카드가 면으로 보인다(라이트 모드에서
   * 기본 배경과 카드 배경은 둘 다 흰색이다). 기본 "plain"은 지금과 같다(PageShell 배경 그대로).
   * 하단 FixedBottomCTA(흰 그라데이션)가 있는 화면은 plain으로 둔다.
   */
  surface?: "plain" | "grouped";
}) {
  // 화면(라우트)이 바뀌면 맨 위에서 시작한다 — 라우터는 스크롤을 되돌리지 않아, 긴 계획 화면 끝에서
  // "결과 보기"를 누르면 결과 화면이 중간부터 열렸다. window.scrollTo는 jsdom이 console.error를
  // 찍어 쓰지 않는다. App.tsx·main.tsx는 건드리지 않고 모든 화면이 지나는 이 골격에서 한다.
  useLayoutEffect(() => {
    try {
      (document.scrollingElement ?? document.documentElement).scrollTop = 0;
    } catch {
      /* noop */
    }
  }, []);

  return (
    <PageShell
      style={
        top || surface === "grouped"
          ? {
              ...(top ? { paddingTop: 0 } : null),
              ...(surface === "grouped" ? { backgroundColor: SURFACE.grouped } : null),
            }
          : undefined
      }
    >
      {top}
      <div style={{ padding: flush ? "16px 0 0" : "16px 16px 0" }}>{children}</div>
      {bottom}
    </PageShell>
  );
}
