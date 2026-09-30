import { useEffect, useRef } from "react";
import { logImpression } from "@/lib/analytics";

/**
 * 요소가 뷰포트에 절반 이상 들어온 순간 노출 로그를 1회 남긴다.
 * 돌려받은 ref는 **DOM 노드**(div 등)에 붙인다 — Card 같은 함수 컴포넌트는 ref를 받지 못한다.
 * `enabled`가 false면 관찰하지 않는다(예: 광고 ID가 없어 배너가 실제로 뜰 수 없는 빌드).
 */
export function useImpressionRef(name: string, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          logImpression(name);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [name, enabled]);
  return ref;
}
