import { useEffect, useState } from "react";
import { Paragraph } from "@toss/tds-mobile";
import { BRAND, CATEGORY_COLOR, SPLIT_LABEL, TEXT_SUBTLE_ON_TINT, type SplitKind } from "@/lib/theme";
import type { SplitSegment } from "@/lib/split";

// 조각 모양은 lib/split.ts가 원천이다(막대 모델을 만드는 순수 함수와 같은 파일) — 컴포넌트 쪽 이름으로도 내보낸다.
export type { SplitSegment } from "@/lib/split";

const GAP = 2;
const MIN_SEGMENT = 4;
const DURATION_MS = 600;
const STAGGER_MS = 60;

/** 애니메이션을 건너뛸 환경 — 모션 줄이기 설정, matchMedia가 없는 환경(jsdom). 판정이 던지면 건너뛴다. */
function skipMotion(): boolean {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/**
 * 시그니처 막대 — 월급 한 줄이 통장 조각으로 갈라진다("쓰는 돈은 흘러가고, 모이는 돈만 쌓인다").
 * 조각 폭은 값에 비례한다(flex-grow = 값, basis 0). 0인 조각은 그리지 않는다.
 * 금액은 **aria-label에만** 싣는다 — 화면 텍스트로 금액을 또 내면 같은 금액이 두 번 보인다(결과 무료 층 유일성).
 * 색은 항상 텍스트 라벨과 함께 쓴다 — 막대 옆에 범례(SplitLegend)나 라벨 있는 행을 둔다.
 *
 * `animate`(결과 히어로만): 첫 프레임은 브랜드색 한 줄, 다음 프레임에 조각으로 갈라진다. 모션 줄이기·jsdom에서는
 * 처음부터 최종 상태다.
 */
export function SplitBar({
  segments,
  height = 12,
  ariaLabel,
  testId,
  animate = false,
  remainder = 0,
}: {
  segments: SplitSegment[];
  height?: number;
  ariaLabel: string;
  testId?: string;
  animate?: boolean;
  /**
   * 아직 나누지 않은 몫(조각과 같은 단위). 0보다 크면 막대 끝에 빈 회색 조각으로 그린다 — 비율 합계가 100% 미만인데
   * 네 조각이 막대를 꽉 채우면 "다 나눴다"로 읽혔다(바로 아래 빨간 오류 문구와 모순).
   */
  remainder?: number;
}) {
  const [settled, setSettled] = useState(() => !animate || skipMotion());

  useEffect(() => {
    if (settled) return;
    // 두 프레임을 기다린다 — 한 프레임이면 첫 상태가 칠해지기 전에 최종 상태로 바뀌어 전환이 보이지 않는다.
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setSettled(true));
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = segments.filter((s) => s.value > 0);
  const rest = remainder > 0 ? remainder : 0;
  const radius = height / 2;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      data-testid={testId}
      style={{
        display: "flex",
        gap: GAP,
        height,
        width: "100%",
        borderRadius: visible.length === 0 && rest === 0 ? radius : undefined,
        backgroundColor: visible.length === 0 && rest === 0 ? "var(--adaptiveGrey100)" : undefined,
      }}
    >
      {visible.map((s, i) => {
        const first = i === 0;
        const last = i === visible.length - 1 && rest === 0;
        const delay = i * STAGGER_MS;
        return (
          <div
            key={s.key}
            data-testid="split-segment"
            data-key={s.key}
            data-filled={s.filled === false ? "false" : "true"}
            style={{
              flexGrow: settled ? s.value : first ? 1 : 0,
              flexBasis: 0,
              minWidth: MIN_SEGMENT,
              backgroundColor: settled ? CATEGORY_COLOR[s.key] : BRAND.fill,
              opacity: s.filled === false ? 0.28 : 1,
              borderTopLeftRadius: first ? radius : 0,
              borderBottomLeftRadius: first ? radius : 0,
              borderTopRightRadius: last ? radius : 0,
              borderBottomRightRadius: last ? radius : 0,
              transition: animate
                ? `flex-grow ${DURATION_MS}ms ease ${delay}ms, background-color ${DURATION_MS}ms ease ${delay}ms`
                : undefined,
            }}
          />
        );
      })}
      {rest > 0 ? (
        <div
          data-testid="split-segment"
          data-key="rest"
          data-filled="false"
          style={{
            flexGrow: rest,
            flexBasis: 0,
            minWidth: MIN_SEGMENT,
            backgroundColor: "var(--adaptiveGrey200)",
            borderTopLeftRadius: visible.length === 0 ? radius : 0,
            borderBottomLeftRadius: visible.length === 0 ? radius : 0,
            borderTopRightRadius: radius,
            borderBottomRightRadius: radius,
          }}
        />
      ) : null}
    </div>
  );
}

/** 막대 범례 — 색 점 + 라벨(금액 없음). 막대의 색에 텍스트 뜻을 붙인다. 0인 조각은 뺀다. */
export function SplitLegend({ kinds, testId }: { kinds: SplitKind[]; testId?: string }) {
  return (
    // aria-hidden — 막대(role=img)의 이름이 같은 조각 이름을 이미 읽는다. 스크린리더가 두 번 듣지 않게.
    <div aria-hidden data-testid={testId} style={{ display: "flex", flexWrap: "wrap", columnGap: 12, rowGap: 4 }}>
      {kinds.map((k) => (
        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            aria-hidden
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CATEGORY_COLOR[k], flexShrink: 0 }}
          />
          <Paragraph.Text typography="t7" color={TEXT_SUBTLE_ON_TINT}>
            {SPLIT_LABEL[k]}
          </Paragraph.Text>
        </span>
      ))}
    </div>
  );
}
