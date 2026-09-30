import { useEffect, useMemo, useRef } from "react";
import { Badge, ListRow, Paragraph, Spacing } from "@toss/tds-mobile";
import { Card } from "@/components/Card";
import { Sparkline } from "@/components/Sparkline";
import { logImpression } from "@/lib/analytics";
import { getToday } from "@/lib/date";
import { formatWon } from "@/lib/format";
import { getBracketScenarios, getTrend } from "@/lib/insights";
import { loadRecords } from "@/lib/storage";
import { BRAND, CARD_INSET, INLINE_BADGE, LIST_CARD_PADDING, SURFACE, TEXT_INSET_TOP } from "@/lib/theme";
import type { PlanDraft } from "@/lib/types";

export function LockedTierSection({
  plan,
}: {
  plan: Pick<PlanDraft, "salary" | "fixedCosts" | "ratios">;
}) {
  const rows = getBracketScenarios(plan);
  const trend = useMemo(() => getTrend(getToday(), loadRecords()), []);
  const chartData = trend.points.map((p) => p.rate);
  // Sparkline 점 아래에 달 이름(6칸) — 점이 몇 월인지 모르면 추이를 읽을 수 없다(N13).
  const monthLabels = trend.points.map((p) => `${Number(p.month.slice(5))}월`);

  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    logImpression("result_locked_tier");
  }, []);

  return (
    <>
      {/* 흰 바탕(결과 화면) 위의 카드는 sunken 회색 면 · 행은 x 36px 정렬선(horizontalPadding small). */}
      <Card testId="bracket-compare" style={{ padding: LIST_CARD_PADDING, backgroundColor: SURFACE.sunken }}>
        <div style={TEXT_INSET_TOP}>
          <Paragraph.Text typography="t4">월급이 다르면 저축은 얼마나 달라질까요?</Paragraph.Text>
        </div>
        <Spacing size={8} />
        {rows.map((r) => (
          <div key={r.salary} data-testid="bracket-row">
            <ListRow
              horizontalPadding="small"
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top={
                    // 요소를 넘길 땐 ListRow.Text로 — 벤더가 top 요소에 typography·fontWeight를 복제해 넣는다.
                    r.isCurrent ? (
                      <ListRow.Text>
                        {formatWon(r.salary)}{" "}
                        <span style={INLINE_BADGE}>
                          <Badge size="small" variant="weak" color="green">
                            내 월급
                          </Badge>
                        </span>
                      </ListRow.Text>
                    ) : (
                      formatWon(r.salary)
                    )
                  }
                  bottom={`연 ${formatWon(r.annualSaving)}`}
                />
              }
              // 오른쪽은 금액 하나만 — 막대·배지를 같이 두면 좁은 폭에서 금액이 두 줄로 꺾였다(D10).
              right={
                <Paragraph.Text typography="t5" style={{ whiteSpace: "nowrap" }}>
                  {formatWon(r.saving)}
                </Paragraph.Text>
              }
            />
          </div>
        ))}
      </Card>
      <Spacing size={24} />
      <Card testId="trend-block" style={{ padding: CARD_INSET, backgroundColor: SURFACE.sunken }}>
        <Paragraph.Text typography="t4">최근 6개월 이행 추이</Paragraph.Text>
        {trend.hasEnoughTrend ? (
          <>
            <div style={{ height: 12 }} aria-hidden />
            <Sparkline data={chartData} testId="trend-sparkline" color={BRAND.fill} />
            <div data-testid="trend-month-labels" style={{ display: "flex", justifyContent: "space-between" }}>
              {monthLabels.map((label, i) => (
                <Paragraph.Text key={`${label}-${i}`} typography="t7" color="var(--adaptiveGrey600)">
                  {label}
                </Paragraph.Text>
              ))}
            </div>
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
