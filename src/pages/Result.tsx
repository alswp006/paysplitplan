import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Spacing, Top } from "@toss/tds-mobile";
import { ChartPie } from "lucide-react";
import { BrandIcon } from "@/components/BrandIcon";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { EmptyState } from "@/components/StateView";
import { SummaryHero } from "@/components/SummaryHero";
import { CountUp } from "@/components/CountUp";
import { SplitBar, SplitLegend } from "@/components/SplitBar";
import { TossRewardAd } from "@/components/TossRewardAd";
import { LockedTierSection } from "@/components/result/LockedTierSection";
import { ResultSaveFooter } from "@/components/result/ResultSaveFooter";
import { SetupSheetSection } from "@/components/result/SetupSheetSection";
import { YearProjection } from "@/components/result/YearProjection";
import { logClick } from "@/lib/analytics";
import { buildRatioShareMessage, ratioParam, toIntossPath } from "@/lib/deeplink";
import { formatWon } from "@/lib/format";
import { calculateAllocation } from "@/lib/plan";
import { shareApp } from "@/lib/share";
import { allocationSplit, legendKinds } from "@/lib/split";
import { loadPlan } from "@/lib/storage";
import { useImpressionRef } from "@/lib/useImpression";
import { isValidDraft } from "@/lib/validate";
import type { PlanDraft } from "@/lib/types";

// env 이름(VITE_TOSS_AD_SLOT_ID)은 옛 이름 그대로 두지만, 담는 값은 **보상형 광고 그룹 ID(adGroupId)**다 — 콘솔 발급값.
// 비어 있으면 TossRewardAd가 SDK를 부르지 않고 게이트를 연다(fail-open). 이름을 바꾸면 이미 넣어 둔 .env가 조용히 무시된다.
const REWARD_AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_SLOT_ID ?? "";

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

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const [source] = useState(() => resolveSource(location.state));
  const freeRef = useImpressionRef("result_free_tier");

  const top = <Top title={<Top.TitleParagraph>통장별 세팅표</Top.TitleParagraph>} />;

  if (!source) {
    return (
      <ScreenScaffold top={top}>
        <EmptyState
          fill
          icon={
            <BrandIcon>
              <ChartPie size={36} aria-hidden />
            </BrandIcon>
          }
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
  // 잠금 층이 약속하는 것은 "모이는 돈"이다. 저축·비상금이 둘 다 0원이면 1년 합계 카드가 없고 구간 비교도 내 월급 한 줄뿐이라
  // 광고를 보여 줄 값어치가 없다 — 게이트 없이 연다(빈 약속으로 광고를 보게 하지 않는다). 저축만 0원이면 문구를 맞춘다.
  const lockedHasPayoff = amounts.saving + amounts.emergency > 0;
  const gateDescription =
    amounts.saving > 0
      ? "광고를 보면 1년 뒤 모이는 돈과 월급 구간별 저축 비교를 볼 수 있어요"
      : "광고를 보면 1년 뒤 모이는 비상금과 최근 이행 추이를 볼 수 있어요";
  // 시그니처 — 월급 한 줄이 고정비와 통장 4개로 갈라진다. 금액은 막대의 aria-label에만(무료 층 금액 텍스트는 세팅표 행 하나).
  const split = allocationSplit(draft.salary, draft.fixedCosts, draft.ratios);

  // 월급·금액은 보내지 않고 비율만 보낸다. 받은 사람은 /plan?r=로 들어와 자기 월급으로 계산한다.
  const onShare = () => {
    logClick("result_share");
    void shareApp({
      message: buildRatioShareMessage(draft.ratios),
      path: toIntossPath(`/plan?r=${ratioParam(draft.ratios)}`),
    });
  };

  return (
    <ScreenScaffold top={top} bottom={<ResultSaveFooter draft={draft} initiallySaved={fromSavedPlan} />}>
      <Spacing size={16} />
      <div data-testid="free-tier" ref={freeRef}>
        <SummaryHero
          testId="available-hero"
          tone="brand"
          label="나눌 돈"
          value={<CountUp value={available} unit="원" typography="t1" durationMs={0} />}
          caption={`월급 ${formatWon(draft.salary)} − 고정비 ${formatWon(fixedTotal)}`}
          extra={
            <>
              <SplitBar testId="split-hero-bar" height={20} animate segments={split.segments} ariaLabel={split.ariaLabel} />
              <Spacing size={10} />
              <SplitLegend testId="split-legend" kinds={legendKinds(split.segments)} />
            </>
          }
        />
        <Spacing size={16} />
        {/* 무료 층의 본문 — 은행 앱에 붙여 넣을 통장별 금액. 통장 금액 텍스트는 여기에서만 한 번씩 나온다. */}
        <SetupSheetSection draft={draft} />
        <Spacing size={16} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Button variant="weak" size="large" display="block" onClick={onShare}>
            비율 공유하기
          </Button>
        </div>
      </div>
      <Spacing size={32} />
      <TossRewardAd adGroupId={lockedHasPayoff ? REWARD_AD_GROUP_ID : ""}
        description={gateDescription}
        buttonText="광고 보고 더 보기"
      >
        <div data-testid="locked-tier">
          <YearProjection plan={draft} />
          <Spacing size={24} />
          <LockedTierSection plan={draft} />
        </div>
      </TossRewardAd>
      {/* 하단 고정 저장 버튼(FixedBottomCTA)과 그 위 그라데이션에 마지막 콘텐츠가 가리지 않게 넉넉히 둔다(D3). */}
      <Spacing size={120} />
    </ScreenScaffold>
  );
}
