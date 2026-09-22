import { ListRow, Paragraph, Badge, Spacing } from "@toss/tds-mobile";
import { buildIncomeScenarios } from "@/lib/calc";
import { formatWon } from "@/lib/format";
import { MiniBar } from "@/components/MiniBar";
import type { Plan } from "@/lib/types";

interface IncomeScenarioSectionProps {
  plan: Plan;
}

/**
 * 소득 구간 비교 — Result 화면의 잠금 층 콘텐츠(게이트는 상위 컴포넌트가 감싼다).
 * 외부 통계 없이 buildIncomeScenarios(현재 비율 기준)만 사용한다.
 */
export default function IncomeScenarioSection({ plan }: IncomeScenarioSectionProps) {
  const fixedTotal = plan.fixedCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const scenarios = buildIncomeScenarios(plan.salary, fixedTotal);
  const maxSaving = Math.max(1, ...scenarios.map((scenario) => scenario.saving));

  return (
    <div>
      <Paragraph.Text typography="t4">월급이 달라지면 얼마나 모을까요</Paragraph.Text>
      <Paragraph.Text typography="st9" color="var(--adaptiveGrey600)">
        같은 고정비·같은 비율로 계산했어요
      </Paragraph.Text>
      <Spacing size={12} />
      {scenarios.map((scenario) => {
        const isCurrent = scenario.salary === plan.salary;
        return (
          <div key={scenario.salary} data-testid="scenario-row">
            <ListRow>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  gap: 8,
                }}
              >
                <div>
                  <Paragraph.Text typography="st2">
                    {`월급 ${formatWon(scenario.salary)}`}
                  </Paragraph.Text>
                  <Paragraph.Text typography="st9" color="var(--adaptiveGrey600)">
                    {`월 저축 ${formatWon(scenario.saving)} · 연 ${formatWon(scenario.yearlySaving)}`}
                  </Paragraph.Text>
                </div>
                {isCurrent && (
                  <Badge size="small" variant="weak" color="blue">
                    지금
                  </Badge>
                )}
              </div>
            </ListRow>
            <Spacing size={4} />
            <MiniBar ratio={scenario.saving / maxSaving} />
            <Spacing size={12} />
          </div>
        );
      })}
    </div>
  );
}
