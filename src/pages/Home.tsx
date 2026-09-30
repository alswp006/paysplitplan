import { useState } from 'react';
import { Top, Paragraph, Spacing, Button } from '@toss/tds-mobile';
import { House, History as HistoryIcon, Wallet } from 'lucide-react';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { EmptyState } from '@/components/StateView';
import { ChecklistCard } from '@/components/home/ChecklistCard';
import { logClick } from '@/lib/analytics';
import { getToday } from '@/lib/date';
import { buildHomeHero } from '@/lib/homeHero';
import { loadPlan, loadRecords } from '@/lib/storage';

const TABS = [
  { label: '홈', path: '/', icon: <House size={22} aria-hidden /> },
  { label: '기록', path: '/history', icon: <HistoryIcon size={22} aria-hidden /> },
];

function haptic(type: 'tickWeak' | 'success') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export default function Home() {
  const navigate = useNavigate();
  // 마운트 때 1회만 읽는다. 손상된 계획은 loadPlan이 키를 지우고 null을 돌려준다.
  const [plan] = useState(() => loadPlan());
  // 히어로가 체크 토글에 바로 반응하도록 기록을 여기서도 들고 있는다(쓰기는 ChecklistCard의 토글뿐).
  const [store, setStore] = useState(loadRecords);

  const top = <Top title={<Top.TitleParagraph>월급쪼개기</Top.TitleParagraph>} />;

  if (!plan) {
    return (
      <ScreenScaffold top={top} bottom={<FloatingTabBar items={TABS} />}>
        <EmptyState
          fill
          icon={<Wallet size={48} color="var(--adaptiveGrey500)" aria-hidden />}
          title="월급을 어디에 얼마씩 나눌지 정해볼까요?"
          action={
            <Button
              variant="fill"
              size="large"
              display="block"
              onClick={() => {
                haptic('success');
                logClick('home_start_plan');
                navigate('/plan');
              }}
            >
              월급 계획 짜기
            </Button>
          }
        />
      </ScreenScaffold>
    );
  }

  const hero = buildHomeHero(plan, store, getToday());

  return (
    <ScreenScaffold top={top} bottom={<FloatingTabBar items={TABS} />}>
      <Spacing size={16} />
      <SummaryHero
        testId="dday-hero"
        label={hero.label}
        value={
          <>
            <Paragraph.Text typography="t2">{hero.value}</Paragraph.Text>
            {/* 스크린리더·텍스트 추출에서 'D-1'과 '9월 30일'이 'D-19월'로 붙지 않게 한다 */}
            {' '}
          </>
        }
        caption={hero.caption}
      />
      <Spacing size={24} />
      <ChecklistCard plan={plan} onStoreChange={setStore} />
      <Spacing size={24} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button
          variant="fill"
          size="large"
          display="block"
          onClick={() => {
            haptic('success');
            navigate('/result');
          }}
        >
          배분 결과 보기
        </Button>
        <Button
          variant="weak"
          size="large"
          display="block"
          onClick={() => {
            haptic('tickWeak');
            navigate('/plan');
          }}
        >
          계획 수정
        </Button>
      </div>
      <Spacing size={80} />
    </ScreenScaffold>
  );
}
