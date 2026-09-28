import { useState, useEffect, useRef } from "react";
import {
  loadFullScreenAd,
  showFullScreenAd,
} from "@apps-in-toss/web-framework";
import "@/styles/reward-ad.css";

interface TossRewardAdProps {
  /** 광고 슬롯 ID (앱인토스 콘솔에서 발급) */
  slotId: string;
  /** 광고 시청 완료 후 보여줄 콘텐츠 */
  children: React.ReactNode;
  /** 광고 시청 전 표시할 안내 문구 */
  description?: string;
  /** 광고 버튼 텍스트 */
  buttonText?: string;
  /** 광고 시청 완료 콜백 */
  onRewarded?: () => void;
  /** 광고 로드 타임아웃 (ms). 초과 시 자동 언락 */
  timeoutMs?: number;
}

/**
 * 보상형 광고 게이트 컴포넌트.
 * 광고 시청 완료 전까지 children을 숨기고, 시청 후 노출합니다.
 * 광고 로드 실패 / 타임아웃 / 슬롯 ID 미설정 / 앱인토스 외 환경(개발 브라우저 등) → 자동 언락.
 * **fail-open이 계약이다** — 광고를 띄울 수 없으면 게이트는 열린다. 그러니 핵심 답(무료 층)은
 * 이 컴포넌트 **바깥**에 두고, 안에는 더 깊은 층만 넣어라.
 *
 * SDK는 loadFullScreenAd + showFullScreenAd를 imperative API로 제공하므로
 * 이 컴포넌트가 React 래핑 레이어 역할을 합니다.
 *
 * ```tsx
 * // 무료 층(핵심 답) — 게이트 바깥
 * <CoreAnswer data={result} />
 * // 잠금 층(더 깊은 층) — 게이트 안
 * <TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>
 *   <DeepDiveSection data={result} />
 * </TossRewardAd>
 * ```
 */
export function TossRewardAd({
  slotId,
  children,
  description = "광고를 시청하면 결과를 확인할 수 있어요",
  buttonText = "광고 보고 확인하기",
  onRewarded,
  timeoutMs = 15000,
}: TossRewardAdProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [isShowing, setIsShowing] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // setState 업데이터는 순수해야 한다(StrictMode가 두 번 부른다) — 로드 여부는 ref로 읽는다.
  const adLoadedRef = useRef(false);

  // Load the ad on mount
  useEffect(() => {
    // ── fail-open #1: 슬롯 ID가 없으면 SDK를 부르지 않고 연다 ──
    // 슬롯 ID는 앱인토스 콘솔 발급값이라 **지금 배포되는 앱에는 없다**(.env.example의
    // VITE_TOSS_AD_SLOT_ID는 빈 값). 그때 SDK를 부르면 onError도 throw도 안 나는 환경에서
    // unlocked=false·adLoaded=false로 굳어 "광고 준비 중..." 비활성 버튼만 영구히 남는다 —
    // 게이트가 fail-CLOSED가 되어 잠금 층이 아무에게도 안 보인다.
    // rules/toss-mini-app.md의 `if (!slotId) return;`과 같은 가드다.
    if (!slotId) {
      setUnlocked(true);
      onRewarded?.();
      return;
    }

    // ── fail-open #2: 로드 콜백이 영영 안 오면 연다 ──
    // onEvent/onError/throw 중 아무것도 오지 않는 환경(토스 호스트 밖의 vite preview 등)에서
    // 마운트 타임아웃이 없으면 버튼이 영원히 disabled다. 광고를 **띄울 수 없었던** 것이지
    // 사용자가 안 본 것이 아니므로 콘텐츠를 인질로 잡지 않는다.
    adLoadedRef.current = false;
    loadTimeoutRef.current = setTimeout(() => {
      if (adLoadedRef.current) return;
      setUnlocked(true);
      onRewarded?.();
    }, timeoutMs);

    try {
      loadFullScreenAd({
        slotId,
        onEvent: () => {
          adLoadedRef.current = true;
          if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
          setAdLoaded(true);
        },
        onError: () => {
          // Load failed (e.g., local browser) — auto-unlock
          if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
          setUnlocked(true);
          onRewarded?.();
        },
      } as Parameters<typeof loadFullScreenAd>[0]);
    } catch {
      // SDK not available (e.g., jsdom) — auto-unlock
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      setUnlocked(true);
      onRewarded?.();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId]);

  if (unlocked) {
    return <>{children}</>;
  }

  const handleWatch = () => {
    setIsShowing(true);

    // Timeout fallback
    timeoutRef.current = setTimeout(() => {
      setUnlocked(true);
      onRewarded?.();
    }, timeoutMs);

    try {
      showFullScreenAd({
        slotId,
        onEvent: (event: { type?: string }) => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          // event.type === 'rewarded' indicates completion (SDK version-dependent)
          // For safety, unlock on any event that finishes the ad
          setUnlocked(true);
          setIsShowing(false);
          if (event?.type === "rewarded" || event?.type === "completed") {
            onRewarded?.();
          } else {
            // dismissed or other — still unlock for UX (policy: gate only final payoff)
            onRewarded?.();
          }
        },
        onError: () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          // Playback failed — unlock as fallback
          setUnlocked(true);
          setIsShowing(false);
          onRewarded?.();
        },
      } as Parameters<typeof showFullScreenAd>[0]);
    } catch {
      // SDK call threw — unlock
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setUnlocked(true);
      setIsShowing(false);
      onRewarded?.();
    }
  };

  return (
    <div className="reward-ad-gate">
      <p className="reward-ad-description">{description}</p>
      <button
        className={`reward-ad-button${isShowing ? " reward-ad-button--loading" : ""}`}
        onClick={handleWatch}
        disabled={isShowing || !adLoaded}
        aria-label={buttonText}
      >
        {isShowing ? "광고 재생 중..." : !adLoaded ? "광고 준비 중..." : buttonText}
      </button>
    </div>
  );
}
