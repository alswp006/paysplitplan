import { useState } from 'react';
import { Top, Paragraph, Spacing, Button, Asset } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { ChecklistCard } from '@/components/home/ChecklistCard';
import { logClick } from '@/lib/analytics';
import { getToday } from '@/lib/date';
import { getNextPayday } from '@/lib/dday';
import { loadPlan } from '@/lib/storage';

const TABS = [
  { label: '홈', path: '/' },
  { label: '기록', path: '/history' },
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

  const top = <Top title={<Top.TitleParagraph>월급 쪼개기</Top.TitleParagraph>} />;

  if (!plan) {
    return (
      <ScreenScaffold top={top} bottom={<FloatingTabBar items={TABS} />}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Spacing size={48} />
          <Asset.ContentIcon name="icon-plus-small-mono" alt="" style={{ width: 48, height: 48 }} />
          <Spacing size={16} />
          <Paragraph.Text typography="t3">월급을 어디에 얼마씩 나눌지 정해볼까요?</Paragraph.Text>
          <Spacing size={24} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'stretch' }}>
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
          </div>
          <Spacing size={80} />
        </div>
      </ScreenScaffold>
    );
  }

  const { dday, label } = getNextPayday(getToday(), plan.payday);

  return (
    <ScreenScaffold top={top} bottom={<FloatingTabBar items={TABS} />}>
      <Spacing size={16} />
      <SummaryHero
        testId="dday-hero"
        label="다음 월급날까지"
        value={
          <>
            <Paragraph.Text typography="t2">{`D-${dday}`}</Paragraph.Text>
            {/* 스크린리더·텍스트 추출에서 'D-1'과 '9월 30일'이 'D-19월'로 붙지 않게 한다 */}
            {' '}
          </>
        }
        caption={label}
      />
      <Spacing size={24} />
      <ChecklistCard plan={plan} />
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
