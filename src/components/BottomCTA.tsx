import type { ReactNode } from "react";
import { FixedBottomCTA, Button, Paragraph } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

/**
 * 주요 CTA 햅틱 — 토스 네이티브 감각. SDK는 WebView 밖에서 throw하므로 가드 필수.
 * (이 한 번의 배선으로 거의 모든 1차 CTA가 자동으로 햅틱을 갖게 된다 — prose 규칙보다 강함.)
 */
function fireHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

/**
 * 단일 1차 CTA — 하단 고정. FixedBottomCTA가 safe-area + 하단 그라데이션을 자동 처리한다.
 *
 * Pre-built (재구현 금지): 폼 제출/다음 단계 등 화면의 1차 액션에 사용.
 * ⚠️ FixedBottomCTA는 그 자체가 <button>이다(.d.ts: HTMLButtonElement ref). 안에 또
 *   <Button>을 넣으면 <button><button>(무효 HTML/validateDOMNesting) → children에 라벨을 직접.
 * 탭 루트(하단 TabBar가 있는 메인 탭)에는 쓰지 마라 — 탭바와 겹친다. 그 경우 SummaryHero
 * 카드 내부 진입 버튼을 사용한다(역할 분리). 클릭 시 success 햅틱이 자동 발화된다.
 *
 * 버튼이 비활성이면 **이유 한 줄**을 hint로 준다 — 버튼 바로 위에 작은 회색 글씨로 뜬다:
 *   <SubmitFooter label="다음" onClick={next} disabled={!amount}
 *     hint={amount ? undefined : "금액을 입력하면 다음으로 갈 수 있어요"} />
 */
export function SubmitFooter({
  label,
  onClick,
  disabled,
  loading,
  hint,
}: {
  label: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** 제출 중 표시 — TDS ButtonProps.loading 패스스루. ui-design.md "제출 중 상태" 규칙의 실행 수단. */
  loading?: boolean;
  /**
   * CTA 바로 위 안내 한 줄(TDS FixedBottomCTA `topAccessory`). 비활성 이유를 말할 때 쓴다 —
   * ui-design.md "제출 버튼만 비활성이고 이유를 안 말하면 사용자는 막힌 이유를 모른다"의 실행 수단.
   * (예전엔 이 슬롯이 없어 규칙만 있고 수단이 없었다 — 앱마다 고정 버튼 위에 손으로 글을 얹었다.)
   */
  hint?: ReactNode;
}) {
  return (
    <FixedBottomCTA
      onClick={() => {
        fireHaptic("success");
        onClick();
      }}
      disabled={disabled || loading}
      loading={loading}
      // hint가 없으면 prop 자체를 넘기지 않는다 — 기존 호출부의 렌더 결과를 한 글자도 바꾸지 않는다.
      {...(hasHint(hint) ? { topAccessory: <SubmitFooterHint>{hint}</SubmitFooterHint> } : {})}
    >
      {label}
    </FixedBottomCTA>
  );
}

/** 빈 값(undefined·null·false·"")은 안내가 없는 것이다 — `hint={ok ? undefined : "…"}` 관용구를 그대로 받는다. */
function hasHint(hint: ReactNode): boolean {
  return hint !== undefined && hint !== null && hint !== false && hint !== "";
}

/**
 * 안내 줄 — 캡션 크기(t7) · adaptive 회색(다크 모드 자동). Paragraph.Text의 color는 **CSS 색 문자열**이다
 * (벤더 .d.ts `color?: string` → --tds-paragraph-color) — primary/secondary 같은 이름은 조용히 무시된다.
 * Paragraph.Text는 인라인 span이라 가운데 정렬·아래 여백은 감싼 div가 맡는다.
 */
function SubmitFooterHint({ children }: { children: ReactNode }) {
  return (
    <div data-testid="submit-footer-hint" style={{ textAlign: "center", paddingBottom: 8 }}>
      <Paragraph.Text typography="t7" color="var(--adaptiveGrey600)">
        {children}
      </Paragraph.Text>
    </div>
  );
}

/**
 * 2개 CTA(1차 fill + 2차 weak) — 하단 고정 + safe-area. FixedBottomCTA는 단일 버튼용이라 별도.
 * 두 버튼 모두 display="block"(전체폭).
 */
export function ButtonStack({
  primary,
  secondary,
}: {
  primary: { label: ReactNode; onClick: () => void; disabled?: boolean };
  secondary?: { label: ReactNode; onClick: () => void };
}) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "12px 16px calc(var(--toss-safe-area-bottom) + 12px)",
        backgroundColor: "var(--adaptiveBackground)",
      }}
    >
      <Button
        variant="fill"
        display="block"
        onClick={() => {
          fireHaptic("success");
          primary.onClick();
        }}
        disabled={primary.disabled}
      >
        {primary.label}
      </Button>
      {secondary && (
        <Button
          variant="weak"
          display="block"
          onClick={() => {
            fireHaptic("tickWeak");
            secondary.onClick();
          }}
        >
          {secondary.label}
        </Button>
      )}
    </div>
  );
}
