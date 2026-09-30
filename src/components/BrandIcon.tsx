import type { ReactNode } from "react";
import { BRAND } from "@/lib/theme";

/**
 * 빈 상태·404의 아이콘 받침 — 브랜드 틴트 원 + 브랜드색 아이콘(lucide, stroke=currentColor). 공장 기본값(회색 아이콘만)
 * 대신 앱의 색으로 빈 화면도 이 앱임을 알린다. 장식이다(aria-hidden) — 뜻은 옆의 제목·설명이 전한다.
 */
export function BrandIcon({ children, size = 72 }: { children: ReactNode; size?: number }) {
  return (
    <span
      aria-hidden
      data-testid="brand-icon"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: BRAND.tint,
        color: BRAND.accent,
      }}
    >
      {children}
    </span>
  );
}
