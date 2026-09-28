import { useState } from "react";
import { ListRow, Paragraph, Spacing, Switch, useToast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import type { CategoryKey, SalaryPlan } from "@/lib/types";
import { Card } from "@/components/Card";
import { logClick } from "@/lib/analytics";
import { getToday } from "@/lib/date";
import { formatWon } from "@/lib/format";
import { buildChecklist, isCompletionTransition } from "@/lib/homeView";
import { CATEGORY_ORDER } from "@/lib/plan";
import { requestReviewOnce } from "@/lib/review";
import { toggleRecordItem } from "@/lib/recordToggle";
import { loadRecords } from "@/lib/storage";

const COMPLETE_TOAST = "이번 달 통장 쪼개기 완료!";
const FAIL_TOAST = "저장하지 못했어요. 다시 시도해주세요";

function haptic(type: "tickWeak" | "success") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

function stopBubble(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

export function ChecklistCard({ plan }: { plan: SalaryPlan }) {
  const toast = useToast();
  const [store, setStore] = useState(() => loadRecords());
  const view = buildChecklist(plan, store, getToday());

  const toggle = (key: CategoryKey) => {
    const row = view.rows.find((r) => r.key === key);
    if (!row) return;
    const next = !row.checked;

    haptic("tickWeak");
    logClick("checklist_toggle");
    const result = toggleRecordItem(key, next);
    if (!result.ok) {
      toast.openToast(FAIL_TOAST);
      return;
    }

    const nextStore = loadRecords();
    const nextView = buildChecklist(plan, nextStore, getToday());
    setStore(nextStore);
    if (isCompletionTransition(view.percent, nextView.percent)) {
      haptic("success");
      toast.openToast(COMPLETE_TOAST);
      requestReviewOnce();
    }
  };

  return (
    <Card testId="checklist-card">
      <Paragraph.Text typography="t4">이번 달 이체 체크</Paragraph.Text>
      <Spacing size={4} />
      <Paragraph.Text data-testid="progress-text" typography="t6" color="var(--adaptiveGrey600)">
        {view.progressText}
      </Paragraph.Text>
      <Spacing size={12} />
      {view.rows.map((row) => (
        <ListRow
          key={row.key}
          data-testid="checklist-row"
          onClick={() => toggle(row.key)}
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={`${row.label} · ${formatWon(row.amount)}`}
              bottom={`쓸 수 있는 돈의 ${plan.ratios[CATEGORY_ORDER.indexOf(row.key)]}%`}
            />
          }
          right={
            // 행 탭과 Switch 탭이 둘 다 토글하지 않도록 Switch 쪽 클릭은 여기서 끊는다.
            <span onClick={stopBubble} style={{ display: "flex" }}>
              <Switch checked={row.checked} onChange={() => toggle(row.key)} aria-label={`${row.label} 이체 완료`} />
            </span>
          }
        />
      ))}
    </Card>
  );
}
