import { useEffect, useMemo, useRef } from "react";
import { Badge, ListRow, Paragraph, Spacing } from "@toss/tds-mobile";
import { Card } from "@/components/Card";
import { Sparkline } from "@/components/Sparkline";
import { logImpression } from "@/lib/analytics";
import { getToday } from "@/lib/date";
import { formatWon } from "@/lib/format";
import { withLiveCurrentMonth } from "@/lib/homeView";
import { getBracketScenarios, getTrend } from "@/lib/insights";
import { loadRecords, peekPlan } from "@/lib/storage";
import {
  BRAND,
  CARD_INSET,
  INLINE_BADGE,
  LIST_CARD_PADDING,
  SUBTLE_ON_TINT_ROW,
  SURFACE,
  TEXT_INSET_TOP,
  TEXT_SUBTLE_ON_TINT,
} from "@/lib/theme";
import type { PlanDraft } from "@/lib/types";

export function LockedTierSection({
  plan,
}: {
  plan: Pick<PlanDraft, "salary" | "fixedCosts" | "ratios">;
}) {
  const rows = getBracketScenarios(plan);
  // 이번 달은 홈·기록 탭과 같은 기준(저장된 계획으로 다시 센 이행률)으로 읽는다 — 읽기만 한다(peekPlan은 쓰지 않는다).
  const trend = useMemo(() => {
    const today = getToday();
    const store = loadRecords();
    const saved = peekPlan();
    return getTrend(today, saved ? withLiveCurrentMonth(store, saved, today) : store);
  }, []);
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
          <Paragraph.Text typography="t4" role="heading" aria-level={2}>월급이 다르면 저축은 얼마나 달라질까요?</Paragraph.Text>
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
                  bottomProps={SUBTLE_ON_TINT_ROW}
                />
              }
              // 오른쪽은 금액 하나만 — 막대·배지를 같이 두면 좁은 폭에서 금액이 두 줄로 꺾였다(D10).
              // "월"을 붙인다 — 아랫줄이 "연 …원"이라 단위 없는 오른쪽 숫자가 무엇인지 알 수 없었다.
              right={
                <Paragraph.Text typography="t5" style={{ whiteSpace: "nowrap" }}>
                  {`월 ${formatWon(r.saving)}`}
                </Paragraph.Text>
              }
            />
          </div>
        ))}
      </Card>
      <Spacing size={24} />
      <Card testId="trend-block" style={{ padding: CARD_INSET, backgroundColor: SURFACE.sunken }}>
        <Paragraph.Text typography="t4" role="heading" aria-level={2}>최근 6개월 이행 추이</Paragraph.Text>
        {trend.hasEnoughTrend ? (
          <>
            <div style={{ height: 12 }} aria-hidden />
            {/* 세로축은 0~100% 고정 — 자기 최솟값·최댓값으로 늘이면 전부 100%인 달이 바닥선(기록 없음 점과 같은 자리)에
                그려지고, 25%인 달이 0%처럼 보였다. */}
            <Sparkline data={chartData} domain={[0, 100]} testId="trend-sparkline" color={BRAND.fill} />
            {/* 달 이름은 점 바로 아래 가운데에 — space-between이면 양 끝 이름이 점에서 10px쯤 비켜났다. */}
            <div data-testid="trend-month-labels" style={{ position: "relative", height: 20, marginTop: 6 }}>
              {monthLabels.map((label, i) => (
                <span
                  key={`${label}-${i}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: `${monthLabels.length > 1 ? (i / (monthLabels.length - 1)) * 100 : 50}%`,
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Paragraph.Text typography="t7" color={TEXT_SUBTLE_ON_TINT}>
                    {label}
                  </Paragraph.Text>
                </span>
              ))}
            </div>
            <Spacing size={8} />
            <Paragraph.Text typography="t6" data-testid="trend-average">
              6개월 평균 이행률 {trend.average}%
            </Paragraph.Text>
            <Paragraph.Text typography="t6" data-testid="trend-streak">
              연속 완료 {trend.streak}개월
            </Paragraph.Text>
          </>
        ) : (
          <Paragraph.Text typography="t6" color={TEXT_SUBTLE_ON_TINT}>
            이행 기록이 2개월 이상 쌓이면 추이를 보여드려요
          </Paragraph.Text>
        )}
      </Card>
    </>
  );
}
