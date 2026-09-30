import { useState } from 'react';
import { Top, Paragraph, Spacing, Button } from '@toss/tds-mobile';
import { House, History as HistoryIcon, Landmark } from 'lucide-react';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { EmptyState } from '@/components/StateView';
import { ChecklistCard } from '@/components/home/ChecklistCard';
import { EmergencyGoalCard } from '@/components/home/EmergencyGoalCard';
import { SplitBar, SplitLegend } from '@/components/SplitBar';
import { logClick } from '@/lib/analytics';
import { getToday } from '@/lib/date';
import { buildHomeHero } from '@/lib/homeHero';
import { buildChecklist } from '@/lib/homeView';
import { PRESETS } from '@/lib/plan';
import { allocationSplit, checklistSplit, legendKinds } from '@/lib/split';
import { BRAND, CARD_INSET, SURFACE } from '@/lib/theme';
import { loadSetupState, setupNudge } from '@/lib/setupState';
import { loadPlan, loadRecords } from '@/lib/storage';
import type { SetupNudge } from '@/lib/types';

// 은행 세팅을 아직 안 했거나(복사 기록 없음) 계획이 바뀌어 은행 금액도 바꿔야 할 때 히어로 아래 한 줄.
const NUDGE_TEXT: Record<Exclude<SetupNudge, 'none'>, string> = {
  notYet: '은행 세팅 전이에요 · 세팅표에서 금액을 복사해 자동이체에 붙여 넣어요',
  changed: '계획이 바뀌었어요 · 은행 자동이체 금액도 바꿀 차례예요',
};

const TABS = [
  { label: '홈', path: '/', icon: <House size={22} aria-hidden /> },
  { label: '기록', path: '/history', icon: <HistoryIcon size={22} aria-hidden /> },
];

// 빈 홈의 예시 막대 — 월급 300만 원 · 고정비(월세) 60만 원 · 기본 5:3:1:1(캡션과 같은 값). 첫 화면에서 이 앱이
// 무엇을 하는지(월급 한 줄이 통장 조각으로 갈라진다) 숫자 입력 전에 보여 준다. 저장된 데이터가 아니라 예시다.
const EXAMPLE_SPLIT = allocationSplit(3_000_000, [{ amount: 600_000 }], PRESETS.p532.ratios);

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
  // 세팅표 복사 기록 — 복사는 결과 화면에서 하고, 돌아오면 홈이 다시 마운트되며 새로 읽는다.
  const [setupState] = useState(loadSetupState);

  const top = <Top title={<Top.TitleParagraph>월급쪼개기</Top.TitleParagraph>} />;

  const tabBar = <FloatingTabBar items={TABS} activeColor={BRAND.accent} />;

  if (!plan) {
    return (
      <ScreenScaffold top={top} bottom={tabBar} surface="grouped">
        <EmptyState
          fill
          icon={
            <div
              data-testid="example-split"
              style={{
                alignSelf: 'stretch',
                textAlign: 'left',
                padding: CARD_INSET,
                borderRadius: 16,
                backgroundColor: SURFACE.card,
              }}
            >
              {/* block — 인라인이면 360px에서 두 줄로 꺾일 때 부모 줄 높이를 따라 줄 사이가 벌어진다 */}
              <Paragraph.Text typography="t7" color="var(--adaptiveGrey600)" style={{ display: 'block' }}>
                예시 · 월급 300만 원, 고정비 60만 원, 기본 5:3:1:1
              </Paragraph.Text>
              <Spacing size={12} />
              <SplitBar height={16} segments={EXAMPLE_SPLIT.segments} ariaLabel={`예시 ${EXAMPLE_SPLIT.ariaLabel}`} />
              <Spacing size={10} />
              <SplitLegend kinds={legendKinds(EXAMPLE_SPLIT.segments)} />
            </div>
          }
          title="월급을 어디에 얼마씩 나눌지 정해볼까요?"
          description="통장별 금액을 정하고, 은행 앱에 붙여 넣고, 월급날마다 체크해요"
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

  const today = getToday();
  const hero = buildHomeHero(plan, store, today);
  const nudge = setupNudge(plan, setupState);
  // 시그니처 — 이번 달 통장 조각. 체크할 때마다 옮긴 통장이 채워진다(store는 토글 직후 갱신된다).
  const strip = checklistSplit(buildChecklist(plan, store, today).rows);

  return (
    <ScreenScaffold top={top} bottom={tabBar} surface="grouped">
      <Spacing size={16} />
      <SummaryHero
        testId="dday-hero"
        tone="brand"
        label={hero.label}
        value={
          <>
            <Paragraph.Text typography="t2">{hero.value}</Paragraph.Text>
            {/* 스크린리더·텍스트 추출에서 'D-1'과 '9월 30일'이 'D-19월'로 붙지 않게 한다 */}
            {' '}
          </>
        }
        caption={hero.caption}
        extra={
          <>
            <SplitBar testId="split-strip" height={14} segments={strip.segments} ariaLabel={strip.ariaLabel} />
            {nudge === 'none' ? null : (
              <>
                <Spacing size={12} />
                <div data-testid="setup-nudge" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ display: 'flex', paddingTop: 2, color: BRAND.accent }}>
                    <Landmark size={16} aria-hidden />
                  </span>
                  <Paragraph.Text typography="t6" color="var(--adaptiveGrey700)">
                    {NUDGE_TEXT[nudge]}
                  </Paragraph.Text>
                </div>
              </>
            )}
          </>
        }
        action={
          <Button
            variant="weak"
            size="medium"
            display="block"
            onClick={() => {
              haptic('tickWeak');
              logClick('home_open_setup');
              navigate('/result');
            }}
          >
            세팅표 보기
          </Button>
        }
      />
      <Spacing size={24} />
      <ChecklistCard plan={plan} onStoreChange={setStore} />
      <Spacing size={24} />
      <EmergencyGoalCard plan={plan} store={store} />
      <Spacing size={24} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
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
