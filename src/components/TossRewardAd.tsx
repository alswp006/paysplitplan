import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Paragraph } from "@toss/tds-mobile";
import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";
import { CARD_INSET, SURFACE, TEXT_SUBTLE_ON_TINT } from "@/lib/theme";

interface TossRewardAdProps {
  /** 보상형 광고 그룹 ID(adGroupId) — 앱인토스 콘솔 발급값. 비어 있으면 게이트는 그냥 열린다. */
  adGroupId: string;
  /** 광고를 끝까지 본 뒤 보여줄 콘텐츠 */
  children: ReactNode;
  /** 광고를 보기 전에 보여줄 안내 문구 */
  description?: string;
  /** 광고가 준비됐을 때의 버튼 문구 */
  buttonText?: string;
  /** 보상을 받았을 때만 불린다(`userEarnedReward`). 광고를 띄울 수 없어 게이트가 열린 경우에는 부르지 않는다. */
  onRewarded?: () => void;
  /** 로드·재생 시작을 기다리는 시간(ms). 넘기면 게이트를 연다. */
  timeoutMs?: number;
}

type Status = "loading" | "ready" | "showing" | "open";

const RETRY_DESCRIPTION = "광고를 끝까지 봐야 열려요. 다시 볼 수 있어요";

/** WebView 밖에서 isSupported는 false를 돌려주는 대신 throw한다 — 둘 다 "지원 안 함"으로 본다. */
function adsSupported(): boolean {
  try {
    return loadFullScreenAd.isSupported() === true && showFullScreenAd.isSupported() === true;
  } catch {
    return false;
  }
}

function safeCall(fn: (() => void) | null): void {
  try {
    fn?.();
  } catch {
    /* 구독 해제 실패는 무시한다 */
  }
}

/**
 * 보상형 광고 게이트. 광고를 끝까지 봐서 `userEarnedReward`가 오면 children을 연다.
 *
 * **fail-open이 계약이다** — 광고를 띄울 수 없으면(ID 없음·미지원 환경·로드 실패·타임아웃·재생 실패)
 * 게이트는 열린다. 그러니 핵심 답(무료 층)은 이 컴포넌트 **바깥**에 두고, 안에는 더 깊은 층만 넣는다.
 * 사용자가 보상 없이 광고를 닫으면(`dismissed`) 잠금은 유지하고 다시 볼 수 있게 한다.
 *
 * SDK 모양(web-framework 3.6.0 .d.ts): `loadFullScreenAd` / `showFullScreenAd`는
 * `{ options: { adGroupId }, onEvent, onError }`를 받고 구독 해제 함수를 돌려준다.
 * 모든 SDK 호출은 try/catch 안에 있다 — 여기서 던지면 화면 전체가 흰 화면이 된다.
 */
export function TossRewardAd({
  adGroupId,
  children,
  description = "광고를 보면 결과를 확인할 수 있어요",
  buttonText = "광고 보고 확인하기",
  onRewarded,
  timeoutMs = 15000,
}: TossRewardAdProps) {
  const [status, setStatus] = useState<Status>(() => (!adGroupId || !adsSupported() ? "open" : "loading"));
  const [retry, setRetry] = useState(false);

  const mountedRef = useRef(false);
  const doneRef = useRef(false);
  const unsubLoadRef = useRef<(() => void) | null>(null);
  const unsubShowRef = useRef<(() => void) | null>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRewardedRef = useRef(onRewarded);
  onRewardedRef.current = onRewarded;

  const clearLoadTimer = () => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    loadTimerRef.current = null;
  };
  const clearShowTimer = () => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    showTimerRef.current = null;
  };

  /** 광고를 띄울 수 없었다 — 사용자가 안 본 게 아니므로 콘텐츠를 인질로 잡지 않는다. onRewarded는 부르지 않는다. */
  const failOpen = () => {
    if (!mountedRef.current || doneRef.current) return;
    doneRef.current = true;
    clearLoadTimer();
    clearShowTimer();
    setStatus("open");
  };

  const reward = () => {
    if (!mountedRef.current || doneRef.current) return;
    doneRef.current = true;
    clearLoadTimer();
    clearShowTimer();
    setStatus("open");
    onRewardedRef.current?.();
  };

  const startLoad = () => {
    if (!mountedRef.current || doneRef.current) return;
    safeCall(unsubLoadRef.current);
    unsubLoadRef.current = null;
    clearLoadTimer();
    setStatus("loading");
    loadTimerRef.current = setTimeout(failOpen, timeoutMs);
    try {
      const unsubscribe = loadFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          if (event.type !== "loaded" || !mountedRef.current || doneRef.current) return;
          clearLoadTimer();
          setStatus("ready");
        },
        onError: () => failOpen(),
      });
      unsubLoadRef.current = typeof unsubscribe === "function" ? unsubscribe : null;
    } catch {
      failOpen();
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    doneRef.current = false;
    if (!adGroupId || !adsSupported()) {
      doneRef.current = true;
      setStatus("open");
    } else {
      startLoad();
    }
    return () => {
      mountedRef.current = false;
      clearLoadTimer();
      clearShowTimer();
      safeCall(unsubLoadRef.current);
      safeCall(unsubShowRef.current);
      unsubLoadRef.current = null;
      unsubShowRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adGroupId]);

  if (status === "open") {
    return <>{children}</>;
  }

  const handleWatch = () => {
    if (status !== "ready" || doneRef.current) return;
    setStatus("showing");
    safeCall(unsubShowRef.current);
    unsubShowRef.current = null;
    clearShowTimer();
    // 재생이 시작조차 안 되면 연다. 화면에 뜬 신호(show·impression 등)가 오면 해제한다 — 30초짜리 영상 도중에
    // 열리지 않게. `requested`는 해제하지 않는다: 요청만 받고 호스트가 멈추면(네이티브 멈춤·백그라운드 전환)
    // 버튼이 "광고를 보여 주고 있어요"로 영영 잠겼다(fail-open 위반).
    showTimerRef.current = setTimeout(failOpen, timeoutMs);
    try {
      const unsubscribe = showFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          if (event.type !== "requested") clearShowTimer();
          switch (event.type) {
            case "userEarnedReward":
              reward();
              break;
            case "dismissed":
              // 보상 없이 닫았다 — 잠금을 유지하고 다음 광고를 다시 불러온다.
              if (!doneRef.current && mountedRef.current) {
                setRetry(true);
                startLoad();
              }
              break;
            case "failedToShow":
              failOpen();
              break;
            default:
              // requested · show · impression · clicked — 진행 신호일 뿐 상태를 바꾸지 않는다.
              break;
          }
        },
        onError: () => failOpen(),
      });
      unsubShowRef.current = typeof unsubscribe === "function" ? unsubscribe : null;
    } catch {
      failOpen();
    }
  };

  const label =
    status === "loading"
      ? "광고를 준비하고 있어요"
      : status === "showing"
        ? "광고를 보여 주고 있어요"
        : retry
          ? "광고 다시 보기"
          : buttonText;

  return (
    // 결과 화면(흰 바탕)의 다른 카드와 같은 sunken 면 · 텍스트는 x 36px 정렬선(패딩 20).
    <div
      data-testid="reward-gate"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: CARD_INSET,
        borderRadius: 16,
        backgroundColor: SURFACE.sunken,
      }}
    >
      <Paragraph.Text typography="t6" color={TEXT_SUBTLE_ON_TINT}>
        {retry ? RETRY_DESCRIPTION : description}
      </Paragraph.Text>
      <Button variant="weak" size="large" display="block" disabled={status !== "ready"} onClick={handleWatch}>
        {label}
      </Button>
    </div>
  );
}
