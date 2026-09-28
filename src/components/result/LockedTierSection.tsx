import { useEffect, useMemo, useRef } from "react";
import { Badge, ListRow, Paragraph, Spacing } from "@toss/tds-mobile";
import { Card } from "@/components/Card";
import { MiniBar } from "@/components/MiniBar";
import { Sparkline } from "@/components/Sparkline";
import { logImpression } from "@/lib/analytics";
import { getToday } from "@/lib/date";
import { formatWon } from "@/lib/format";
import { getBracketScenarios, getTrend } from "@/lib/insights";
import { loadRecords } from "@/lib/storage";
import type { PlanDraft } from "@/lib/types";

export function LockedTierSection({
  plan,
}: {
  plan: Pick<PlanDraft, "salary" | "fixedCosts" | "ratios">;
}) {
  const rows = getBracketScenarios(plan);
  const trend = useMemo(() => getTrend(getToday(), loadRecords()), []);
  const maxSaving = Math.max(1, ...rows.map((r) => r.saving));
  const chartData = trend.points.map((p) => p.rate);

  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    logImpression("result_locked_tier");
  }, []);

  return (
    <>
      <div data-testid="bracket-compare">
        <Paragraph.Text typography="t4">월급이 다르면 저축은 얼마나 달라질까요?</Paragraph.Text>
        <Spacing size={12} />
        {rows.map((r) => (
          <div key={r.salary} data-testid="bracket-row">
            <ListRow
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top={formatWon(r.salary)}
                  bottom={`연 ${formatWon(r.annualSaving)}`}
                />
              }
              right={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Paragraph.Text typography="t5">{formatWon(r.saving)}</Paragraph.Text>
                  <div style={{ width: 48 }}>
                    <MiniBar ratio={r.saving / maxSaving} />
                  </div>
                  {r.isCurrent && (
                    <Badge size="small" variant="weak" color="blue">
                      내 월급
                    </Badge>
                  )}
                </div>
              }
            />
          </div>
        ))}
      </div>
      <Spacing size={24} />
      <Card testId="trend-block">
        <Paragraph.Text typography="t4">최근 6개월 이행 추이</Paragraph.Text>
        {trend.hasEnoughTrend ? (
          <>
            <Sparkline data={chartData} testId="trend-sparkline" />
            <Paragraph.Text typography="t6" data-testid="trend-average">
              6개월 평균 이행률 {trend.average}%
            </Paragraph.Text>
            <Paragraph.Text typography="t6" data-testid="trend-streak">
              연속 완료 {trend.streak}개월
            </Paragraph.Text>
          </>
        ) : (
          <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
            이행 기록이 2개월 이상 쌓이면 추이를 보여드려요
          </Paragraph.Text>
        )}
      </Card>
    </>
  );
}
