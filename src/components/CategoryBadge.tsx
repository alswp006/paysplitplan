import { Coffee, PiggyBank, ReceiptText, ShieldCheck, ShoppingBag, type LucideIcon } from "lucide-react";
import { CATEGORY_COLOR, CATEGORY_TINT, type SplitKind } from "@/lib/theme";

// 번들에 포함된 lucide 아이콘(오프라인 안전) — 토스 아이콘 CDN·Tossface·Asset.*는 쓰지 않는다.
const ICONS: Record<SplitKind, LucideIcon> = {
  fixed: ReceiptText,
  living: ShoppingBag,
  saving: PiggyBank,
  emergency: ShieldCheck,
  leisure: Coffee,
};

/**
 * 통장 배지 — 원형 틴트 배경 + 통장 색 아이콘. 장식이다(aria-hidden): 뜻은 항상 옆의 텍스트 라벨이 전한다.
 * ListRow의 `left` 슬롯에 넣는다(벤더가 left와 본문 사이에 12px를 둔다 — 정렬선은 이 배지의 왼쪽 끝이다).
 */
export function CategoryBadge({ kind, size = 32 }: { kind: SplitKind; size?: number }) {
  const Icon = ICONS[kind];
  return (
    <span
      aria-hidden
      data-testid="category-badge"
      data-kind={kind}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: CATEGORY_TINT[kind],
        // 아이콘은 stroke="currentColor"(lucide 기본)라 여기 color를 따른다.
        color: CATEGORY_COLOR[kind],
      }}
    >
      <Icon size={18} aria-hidden />
    </span>
  );
}
