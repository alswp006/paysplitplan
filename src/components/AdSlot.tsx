import { useEffect, useRef } from "react";
import { TossAds } from "@apps-in-toss/web-framework";

interface AdSlotProps {
  /** 광고 그룹 ID — 앱인토스 콘솔에서 발급받아 입력 */
  adGroupId: string;
  className?: string;
  /** 'card' (기본) | 'expanded' */
  variant?: "card" | "expanded";
  /** 'auto' (기본 — 시스템 다크모드 추종) | 'light' | 'dark' */
  theme?: "auto" | "light" | "dark";
  /** 배너가 실제로 노출됐을 때(SDK `onAdImpression`) 1회 이상 불린다 — 노출 로그는 여기서 남긴다. */
  onImpression?: () => void;
}

let tossAdsInitialized = false;

// WebView 밖에서 SDK probe(isSupported)는 false를 "반환"하는 게 아니라 예외를 "던진다".
// 가드하지 않으면 throw가 effect를 탈출 → React 트리 전체 언마운트(첫 화면부터 흰 화면).
function isBannerSupported(): boolean {
  try {
    return TossAds.attachBanner.isSupported?.() === true;
  } catch {
    return false;
  }
}

function ensureInitialized() {
  if (tossAdsInitialized) return;
  try {
    if (!TossAds.initialize.isSupported?.()) return;
    TossAds.initialize({});
    tossAdsInitialized = true;
  } catch {
    /* WebView 밖 — 초기화 스킵 */
  }
}

/**
 * 배너 광고 슬롯 — TossAds.attachBanner의 React 래퍼.
 *
 * SDK는 imperative API: 빈 DOM 노드에 attachBanner(adGroupId, element)를
 * 호출하면 SDK가 해당 노드 안에 배너를 렌더링. cleanup은 result.destroy().
 *
 * 앱인토스 WebView 외 환경(로컬 브라우저, jsdom)에서는 isSupported가 예외를
 * 던지므로 try/catch로 가드 → 조용히 빈 영역 반환(트리 언마운트 방지).
 */
export function AdSlot({ adGroupId, className, variant, theme, onImpression }: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onImpressionRef = useRef(onImpression);
  onImpressionRef.current = onImpression;

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    // 콘솔 발급 ID가 없으면 붙일 배너가 없다 — 빈 ID로 SDK를 부르지 않는다.
    if (!adGroupId) return;
    if (!isBannerSupported()) return;

    ensureInitialized();

    let result: { destroy: () => void } | null = null;
    try {
      result = TossAds.attachBanner(adGroupId, target, {
        variant,
        theme,
        callbacks: {
          onAdImpression: () => {
            try {
              onImpressionRef.current?.();
            } catch {
              /* 로그 실패가 배너를 깨지 않게 */
            }
          },
        },
      });
    } catch {
      /* SDK unavailable or attach failed — silent */
    }

    return () => {
      try {
        result?.destroy();
      } catch {
        /* cleanup best-effort */
      }
    };
  }, [adGroupId, variant, theme]);

  return <div ref={containerRef} data-ad-group-id={adGroupId} className={className ?? "ad-slot"} />;
}
