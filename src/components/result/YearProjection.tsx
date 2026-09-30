import { ListRow, Paragraph, Spacing } from "@toss/tds-mobile";
import { Card } from "@/components/Card";
import { CategoryBadge } from "@/components/CategoryBadge";
import { formatWon } from "@/lib/format";
import { calculateAllocation } from "@/lib/plan";
import { LIST_CARD_PADDING, SURFACE, TEXT_INSET_BOTTOM, TEXT_INSET_TOP, TEXT_SUBTLE_ON_TINT } from "@/lib/theme";
import type { CategoryKey, PlanDraft } from "@/lib/types";

/**
 * 잠금 층 — 이 계획대로 1년 옮기면 저축·비상금 통장에 모이는 돈(단순 합계: 월 금액 × 12).
 * 이자·물가는 넣지 않는다(가정을 캡션에 밝힌다). 금액이 0원인 통장 행은 그리지 않고, 둘 다 0원이면 카드도 없다.
 */
export function YearProjection({ plan }: { plan: Pick<PlanDraft, "salary" | "fixedCosts" | "ratios"> }) {
  const { amounts } = calculateAllocation(plan.salary, plan.fixedCosts, plan.ratios);
  const rows: { key: CategoryKey; label: string; total: number }[] = [
    { key: "saving" as const, label: "저축 통장", total: amounts.saving * 12 },
    { key: "emergency" as const, label: "비상금 통장", total: amounts.emergency * 12 },
  ].filter((r) => r.total > 0);
  if (rows.length === 0) return null;

  return (
    <Card testId="year-projection" style={{ padding: LIST_CARD_PADDING, backgroundColor: SURFACE.sunken }}>
      <div style={TEXT_INSET_TOP}>
        <Paragraph.Text typography="t4" role="heading" aria-level={2}>이 계획대로 1년이면</Paragraph.Text>
      </div>
      <Spacing size={8} />
      {rows.map((r) => (
        <ListRow
          key={r.key}
          horizontalPadding="small"
          left={<CategoryBadge kind={r.key} />}
          contents={<ListRow.Texts type="1RowTypeA" top={r.label} />}
          right={
            <Paragraph.Text typography="t5" style={{ whiteSpace: "nowrap" }}>
              {formatWon(r.total)}
            </Paragraph.Text>
          }
        />
      ))}
      <Spacing size={8} />
      <div style={TEXT_INSET_BOTTOM}>
        <Paragraph.Text typography="t6" color={TEXT_SUBTLE_ON_TINT}>
          매달 계획대로 옮긴다고 가정한 단순 합계예요
        </Paragraph.Text>
      </div>
    </Card>
  );
}
