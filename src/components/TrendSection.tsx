import { Paragraph, Spacing } from "@toss/tds-mobile";
import { Card } from "@/components/Card";
import { Sparkline } from "@/components/Sparkline";
import { recentMonths } from "@/lib/records";
import type { MonthRecordMap } from "@/lib/types";

interface TrendSectionProps {
  records: MonthRecordMap;
  today: Date;
}

/**
 * 6개월 이행 추이 — History의 잠금 층 콘텐츠(게이트는 상위 컴포넌트가 감싼다).
 * 기록이 없는 달은 0으로 채우지 않고 제외한다.
 */
export function TrendSection({ records, today }: TrendSectionProps) {
  const months = recentMonths(records, today, 6).reverse();
  const rates = months.map((month) => records[month].rate);

  if (rates.length < 2) {
    return (
      <Card>
        <Paragraph.Text typography="t4">최근 6개월 이행 추이</Paragraph.Text>
        <Spacing size={12} />
        <Paragraph.Text typography="st9" color="var(--adaptiveGrey600)">
          두 달 이상 기록되면 추이를 보여드려요
        </Paragraph.Text>
      </Card>
    );
  }

  const avg = Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length);
  const fullCount = rates.filter((rate) => rate === 100).length;

  return (
    <Card>
      <Paragraph.Text typography="t4">최근 6개월 이행 추이</Paragraph.Text>
      <Spacing size={12} />
      <Sparkline data={rates} testId="trend-sparkline" />
      <Spacing size={12} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <Paragraph.Text typography="t3" data-testid="trend-avg">
            {`평균 ${avg}%`}
          </Paragraph.Text>
          <Paragraph.Text typography="st9" color="var(--adaptiveGrey600)">
            6개월 평균 이행률
          </Paragraph.Text>
        </div>
        <div>
          <Paragraph.Text typography="t3" data-testid="trend-full">
            {`100% 달성 ${fullCount}개월`}
          </Paragraph.Text>
          <Paragraph.Text typography="st9" color="var(--adaptiveGrey600)">
            완주한 달의 수
          </Paragraph.Text>
        </div>
      </div>
    </Card>
  );
}
