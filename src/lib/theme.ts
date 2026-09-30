import type { CategoryKey } from "./types";

/**
 * 이 앱의 색 원천 — 앱이 직접 그리는 요소(SplitBar·CategoryBadge·막대·탭)는 여기서만 색을 가져온다.
 * HEX를 쓰지 않는다(tds-colors adaptive 토큰만 — 다크 모드에서 저절로 바뀐다). 브랜드 HEX는
 * apps-in-toss.config.ts `brand.primaryColor` 하나이고, 그 값은 라이트 --adaptiveGreen800과 같다(theme.test가 대조).
 *
 * 콘셉트: "쓰는 돈은 흘러가고, 모이는 돈만 쌓인다." 저축은 브랜드와 같은 초록 계열, 고정비는 무채색이다.
 * 색은 항상 텍스트 라벨과 함께 쓴다(색만으로 뜻을 전하지 않는다). 여가에 노랑을 쓰지 않는 이유는 흰 바탕 대비가
 * 약 1.7:1이라서다(Teal500은 약 3:1).
 */
export type SplitKind = CategoryKey | "fixed";

/** 통장(과 고정비)별 막대·아이콘 색 */
export const CATEGORY_COLOR: Record<SplitKind, string> = {
  fixed: "var(--adaptiveGrey400)",
  living: "var(--adaptiveOrange500)",
  saving: "var(--adaptiveGreen600)",
  emergency: "var(--adaptivePurple500)",
  leisure: "var(--adaptiveTeal500)",
};

/** 통장 배지의 원형 배경 */
export const CATEGORY_TINT: Record<SplitKind, string> = {
  fixed: "var(--adaptiveGrey100)",
  living: "var(--adaptiveOrange50)",
  saving: "var(--adaptiveGreen50)",
  emergency: "var(--adaptivePurple50)",
  leisure: "var(--adaptiveTeal50)",
};

/** 브랜드 — accent는 글자·활성 탭(흰 바탕 대비 AA), fill은 막대, tint는 히어로 바탕 */
export const BRAND = {
  accent: "var(--adaptiveGreen800)",
  fill: "var(--adaptiveGreen600)",
  tint: "var(--adaptiveGreen50)",
} as const;

/**
 * 표면 — 라이트 모드에서 PageShell 배경(--adaptiveBackground)과 Card 배경(--adaptiveLayeredBackground)은 둘 다 흰색이라
 * 카드가 면으로 보이지 않는다. 홈·기록은 회색 바탕(grouped) 위 흰 카드(card), 흰 바탕 화면(결과)의 카드는 sunken.
 */
export const SURFACE = {
  grouped: "var(--adaptiveGreyBackground)",
  card: "var(--adaptiveLayeredBackground)",
  sunken: "var(--adaptiveGreyBackground)",
} as const;

/** 막대 범례·접근성 이름에 쓰는 짧은 이름 */
export const SPLIT_LABEL: Record<SplitKind, string> = {
  fixed: "고정비",
  living: "생활비",
  saving: "저축",
  emergency: "비상금",
  leisure: "여가",
};

/**
 * 정렬선 하나 — 본문 좌우 16px(ScreenScaffold) + 카드 안 20px = 텍스트·배지 기준선 x = 36px.
 * TDS ListRow 기본 좌우 패딩은 24px(medium)이라 카드 안 ListRow에는 horizontalPadding="small"(20px, 벤더 런타임 값)을 준다.
 *  - 맨 텍스트만 있는 카드: padding CARD_INSET
 *  - ListRow를 담은 카드: padding LIST_CARD_PADDING, 맨 텍스트는 TEXT_INSET(_TOP)로 감싼다
 */
export const CARD_INSET = 20;
export const LIST_CARD_PADDING = "12px 0";
export const TEXT_INSET = { padding: `0 ${CARD_INSET}px` } as const;
/** 카드 맨 위 텍스트 — 위 8px + 카드 패딩 12px = 히어로와 같은 20px */
export const TEXT_INSET_TOP = { padding: `8px ${CARD_INSET}px 0` } as const;
/** 카드 맨 아래 텍스트·버튼 — 아래 8px + 카드 패딩 12px = 20px */
export const TEXT_INSET_BOTTOM = { padding: `0 ${CARD_INSET}px 8px` } as const;

/** 텍스트 줄 안의 인라인 배지(완료·내 월급) 감싸개 — 음수 세로 여백으로 줄 상자를 키우지 않는다(배지 있는 행만 1px 높아졌다). */
export const INLINE_BADGE = { display: "inline-block", verticalAlign: "middle", margin: "-4px 0" } as const;
