import { useState } from 'react';
import { Top, ListRow, Badge, Paragraph, Button, Spacing } from '@toss/tds-mobile';
import { CalendarCheck, House, History as HistoryIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { Card } from '@/components/Card';
import { CountUp } from '@/components/CountUp';
import { MiniBar } from '@/components/MiniBar';
import { AdSlot } from '@/components/AdSlot';
import { EmptyState } from '@/components/StateView';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { logClick } from '@/lib/analytics';
import { getToday, monthKey } from '@/lib/date';
import { formatMonthLabel, formatWon } from '@/lib/format';
import { withLiveCurrentMonth } from '@/lib/homeView';
import { getStreaks, movedTotal } from '@/lib/insights';
import { loadRecords, peekPlan } from '@/lib/storage';
import { useImpressionRef } from '@/lib/useImpression';

const TABS = [
  { label: '홈', path: '/', icon: <House size={22} aria-hidden /> },
  { label: '기록', path: '/history', icon: <HistoryIcon size={22} aria-hidden /> },
];

// 배너 광고 그룹 ID — 콘솔 발급값. 비어 있으면 배너가 뜰 수 없으니 노출 로그도 남기지 않는다.
const BANNER_AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? '';

function HistoryBanner() {
  const ref = useImpressionRef('history_banner', BANNER_AD_GROUP_ID !== '');
  return (
    <div ref={ref}>
      <AdSlot adGroupId={BANNER_AD_GROUP_ID} />
    </div>
  );
}

export default function History() {
  const navigate = useNavigate();
  // 읽기 전용 — 마운트 때 1회만 읽고 저장소에 쓰지 않는다(peekPlan은 깨진 계획도 지우지 않는다).
  // 손상된 레코드는 loadRecords가 걸러 준다.
  const [store] = useState(() => loadRecords());
  const [plan] = useState(() => peekPlan());
  // 이번 달은 홈과 같은 기준(현재 계획)으로 다시 센다 — 계획을 바꾼 달에 홈 75% · 기록 100%로 갈리지 않게.
  const view = plan ? withLiveCurrentMonth(store, plan, getToday()) : store;

  const top = <Top title={<Top.TitleParagraph>이행 기록</Top.TitleParagraph>} />;
  const monthsDesc = Object.keys(view.records).sort().reverse();

  if (monthsDesc.length === 0) {
    return (
      <ScreenScaffold top={top} bottom={<FloatingTabBar items={TABS} />}>
        <EmptyState
          fill
          icon={<CalendarCheck size={48} color="var(--adaptiveGrey500)" aria-hidden />}
          title="아직 기록이 없어요"
          description="월급날 통장별로 옮기고 체크하면 여기에 쌓여요"
          action={
            <Button
              variant="fill"
              size="large"
              display="block"
              onClick={() => {
                logClick('history_go_check');
                navigate('/');
              }}
            >
              이번 달 체크하러 가기
            </Button>
          }
        />
      </ScreenScaffold>
    );
  }

  const today = getToday();
  const thisMonth = view.records[monthKey(today)];
  const thisRate = thisMonth ? thisMonth.rate : 0;
  // 연속 기록·옮긴 돈 — 기록 탭이 "쌓였다"는 증거를 보여 준다(손실이 아니라 이어 온 것을 말한다).
  const { current, best } = getStreaks(view, today);
  const moved = movedTotal(view);
  const heroCaption = !thisMonth
    ? '이번 달은 아직 체크 전이에요'
    : current >= 1
      ? `${current}개월 연속 지켰어요 · 가장 긴 기록 ${best}개월`
      : best >= 1
        ? `가장 긴 기록 ${best}개월`
        : undefined;

  return (
    <ScreenScaffold top={top} bottom={<FloatingTabBar items={TABS} />}>
      <Spacing size={16} />
      <SummaryHero
        testId="history-hero"
        label="이번 달 이행률"
        value={<CountUp value={thisRate} unit="%" />}
        caption={heroCaption}
      />
      {moved > 0 ? (
        <>
          <Spacing size={12} />
          <Card testId="moved-total">
            <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
              저축·비상금 통장에 옮긴 돈
            </Paragraph.Text>
            <Paragraph.Text typography="t3">{formatWon(moved)}</Paragraph.Text>
            <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
              직접 체크한 이체 기준이에요 · 최근 24개월
            </Paragraph.Text>
          </Card>
        </>
      ) : null}
      <Spacing size={24} />
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {monthsDesc.map((month) => {
          const { rate, eligible, checked } = view.records[month];
          const doneCount = eligible.filter((k) => checked[k]).length;
          return (
            <ListRow
              key={month}
              data-testid="month-row"
              contents={<ListRow.Texts
                  type="2RowTypeA"
                  top={formatMonthLabel(month)}
                  bottom={`이체 ${eligible.length}개 중 ${doneCount}개 완료`}
                />}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Paragraph.Text typography="t5">{`${rate}%`}</Paragraph.Text>
                  <div style={{ width: 64 }}>
                    <MiniBar ratio={rate / 100} />
                  </div>
                  {rate === 100 && (
                    <Badge size="small" variant="weak" color="green">
                      완료
                    </Badge>
                  )}
                </div>
              }
            />
          );
        })}
      </ul>
      <Spacing size={16} />
      <HistoryBanner />
      <Spacing size={80} />
    </ScreenScaffold>
  );
}
