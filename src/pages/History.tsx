import { useState } from 'react';
import { Top, ListRow, Badge, Paragraph, Button, Spacing } from '@toss/tds-mobile';
import { CalendarCheck, House, History as HistoryIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { CountUp } from '@/components/CountUp';
import { MiniBar } from '@/components/MiniBar';
import { AdSlot } from '@/components/AdSlot';
import { EmptyState } from '@/components/StateView';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { logClick } from '@/lib/analytics';
import { getToday, monthKey } from '@/lib/date';
import { formatMonthLabel } from '@/lib/format';
import { loadRecords } from '@/lib/storage';

const TABS = [
  { label: '홈', path: '/', icon: <House size={22} aria-hidden /> },
  { label: '기록', path: '/history', icon: <HistoryIcon size={22} aria-hidden /> },
];

export default function History() {
  const navigate = useNavigate();
  // 읽기 전용 — 마운트 때 1회만 읽는다. 손상된 레코드는 loadRecords가 걸러 준다.
  const [store] = useState(() => loadRecords());

  const top = <Top title={<Top.TitleParagraph>이행 기록</Top.TitleParagraph>} />;
  const monthsDesc = Object.keys(store.records).sort().reverse();

  if (monthsDesc.length === 0) {
    return (
      <ScreenScaffold top={top} bottom={<FloatingTabBar items={TABS} />}>
        <EmptyState
          fill
          icon={<CalendarCheck size={48} color="var(--adaptiveGrey500)" aria-hidden />}
          title="아직 기록이 없어요"
          description="월말에 통장별 이체를 체크하면 여기에 쌓여요"
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

  const thisMonth = store.records[monthKey(getToday())];
  const thisRate = thisMonth ? thisMonth.rate : 0;

  return (
    <ScreenScaffold top={top} bottom={<FloatingTabBar items={TABS} />}>
      <Spacing size={16} />
      <SummaryHero
        testId="history-hero"
        label="이번 달 이행률"
        value={<CountUp value={thisRate} unit="%" />}
        caption={thisMonth ? undefined : '이번 달은 아직 체크 전이에요'}
      />
      <Spacing size={24} />
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {monthsDesc.map((month) => {
          const { rate, eligible, checked } = store.records[month];
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
      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID ?? ''} />
      <Spacing size={80} />
    </ScreenScaffold>
  );
}
