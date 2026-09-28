import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Paragraph, Spacing, Top } from "@toss/tds-mobile";
import { ChartPie } from "lucide-react";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { EmptyState } from "@/components/StateView";
import { SummaryHero } from "@/components/SummaryHero";
import { CountUp } from "@/components/CountUp";
import { Card } from "@/components/Card";
import { MiniBar } from "@/components/MiniBar";
import { TossRewardAd } from "@/components/TossRewardAd";
import { LockedTierSection } from "@/components/result/LockedTierSection";
import { ResultSaveFooter } from "@/components/result/ResultSaveFooter";
import { logClick, logImpression } from "@/lib/analytics";
import { formatWon } from "@/lib/format";
import { CATEGORY_LABEL, CATEGORY_ORDER, calculateAllocation } from "@/lib/plan";
import { shareApp } from "@/lib/share";
import { loadPlan } from "@/lib/storage";
import { isValidDraft } from "@/lib/validate";
import type { PlanDraft } from "@/lib/types";

// 슬롯 ID는 콘솔 발급값 — 비어 있으면 TossRewardAd가 게이트를 자동으로 연다(fail-open).
const REWARD_SLOT_ID = import.meta.env.VITE_TOSS_AD_SLOT_ID ?? "";

interface Source {
  draft: PlanDraft;
  fromSavedPlan: boolean;
}

// state.draft가 유효하면 그 초안, 아니면 저장된 계획, 둘 다 없으면 null
function resolveSource(state: unknown): Source | null {
  const draft = (state as { draft?: unknown } | null | undefined)?.draft;
  if (state && typeof state === "object" && isValidDraft(draft)) {
    return { draft, fromSavedPlan: false };
  }
  const plan = loadPlan();
  if (!plan) return null;
  const { salary, fixedCosts, presetId, ratios, payday } = plan;
  return { draft: { salary, fixedCosts, presetId, ratios, payday }, fromSavedPlan: true };
}

function useImpressionRef(name: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          logImpression(name);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [name]);
  return ref;
}

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const [source] = useState(() => resolveSource(location.state));
  const freeRef = useImpressionRef("result_free_tier");

  const top = <Top title={<Top.TitleParagraph>배분 결과</Top.TitleParagraph>} />;

  if (!source) {
    return (
      <ScreenScaffold top={top}>
        <EmptyState
          fill
          icon={<ChartPie size={48} color="var(--adaptiveGrey500)" aria-hidden />}
          title="아직 계획이 없어요"
          description="월급과 고정비를 넣으면 통장별 이체 금액을 계산해 드려요"
          action={
            <Button variant="fill" size="large" display="block" onClick={() => navigate("/plan")}>
              월급 계획 짜기
            </Button>
          }
        />
      </ScreenScaffold>
    );
  }

  const { draft, fromSavedPlan } = source;
  const { fixedTotal, available, amounts } = calculateAllocation(draft.salary, draft.fixedCosts, draft.ratios);
  const visibleKeys = CATEGORY_ORDER.filter((k) => amounts[k] > 0);

  const onShare = () => {
    logClick("result_share");
    void shareApp({
      message: `월급 ${formatWon(draft.salary)}, 이렇게 나눴어요`,
      path: "/result",
    });
  };

  return (
    <ScreenScaffold top={top} bottom={<ResultSaveFooter draft={draft} initiallySaved={fromSavedPlan} />}>
      <Spacing size={16} />
      <div data-testid="free-tier" ref={freeRef}>
        <SummaryHero
          testId="available-hero"
          label="남는 돈"
          value={<CountUp value={available} unit="원" typography="t1" durationMs={0} />}
          caption={`월급 ${formatWon(draft.salary)} − 고정비 ${formatWon(fixedTotal)}`}
        />
        <Spacing size={16} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visibleKeys.map((key) => {
            const ratio = draft.ratios[CATEGORY_ORDER.indexOf(key)];
            return (
              <Card key={key} testId="allocation-card">
                <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
                  {`${CATEGORY_LABEL[key]} · ${ratio}%`}
                </Paragraph.Text>
                <Spacing size={4} />
                <div>
                  <Paragraph.Text typography="t3">{formatWon(amounts[key])}</Paragraph.Text>
                </div>
                <Spacing size={8} />
                <MiniBar ratio={ratio / 100} />
              </Card>
            );
          })}
        </div>
        <Spacing size={16} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Button variant="weak" size="large" display="block" onClick={onShare}>
            친구에게 공유하기
          </Button>
        </div>
      </div>
      <Spacing size={32} />
      <TossRewardAd
        slotId={REWARD_SLOT_ID}
        description="광고를 보면 월급 구간별 저축 비교와 6개월 추이를 볼 수 있어요"
        buttonText="광고 보고 비교 보기"
      >
        <div data-testid="locked-tier">
          <LockedTierSection plan={draft} />
        </div>
      </TossRewardAd>
      <Spacing size={80} />
    </ScreenScaffold>
  );
}
