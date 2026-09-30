import { useState } from "react";
import { ListRow, Paragraph, Spacing, Switch, useToast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import type { CategoryKey, RecordStore, SalaryPlan } from "@/lib/types";
import { Card } from "@/components/Card";
import { CategoryBadge } from "@/components/CategoryBadge";
import { logClick } from "@/lib/analytics";
import { getToday } from "@/lib/date";
import { formatWon } from "@/lib/format";
import { buildChecklist, isCompletionTransition } from "@/lib/homeView";
import { CATEGORY_ORDER } from "@/lib/plan";
import { requestReviewOnce } from "@/lib/review";
import { toggleRecordItem } from "@/lib/recordToggle";
import { loadRecords } from "@/lib/storage";
import { LIST_CARD_PADDING, TEXT_INSET_TOP } from "@/lib/theme";

const completeToast = (month: number) => `${month}월 이체를 모두 체크했어요`;
const FAIL_TOAST = "저장 공간이 부족해 체크하지 못했어요. 잠시 뒤 다시 눌러 주세요";

function haptic(type: "tickWeak" | "success") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

/**
 * 이번 달 이체 체크 카드. 토글은 행 오른쪽 Switch 하나로만 한다(행 전체를 버튼으로 두면 버튼 안에
 * 스위치가 들어가 스크린리더가 "버튼 안의 스위치"로 읽는다).
 * `onStoreChange`를 주면 토글이 저장된 직후 새 기록으로 불린다(홈 히어로가 바로 따라오게).
 */
export function ChecklistCard({
  plan,
  onStoreChange,
}: {
  plan: SalaryPlan;
  onStoreChange?: (store: RecordStore) => void;
}) {
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
      toast.openToast(FAIL_TOAST, { higherThanCTA: true });
      return;
    }

    const today = getToday();
    const nextStore = loadRecords();
    const nextView = buildChecklist(plan, nextStore, today);
    setStore(nextStore);
    onStoreChange?.(nextStore);
    if (isCompletionTransition(view.percent, nextView.percent)) {
      haptic("success");
      toast.openToast(completeToast(today.getMonth() + 1), { higherThanCTA: true });
      requestReviewOnce();
    }
  };

  return (
    // 정렬선: 제목·배지가 x = 16 + 20 = 36px(ListRow horizontalPadding="small" = 20px, 벤더 런타임 값).
    <Card testId="checklist-card" style={{ padding: LIST_CARD_PADDING }}>
      <div style={TEXT_INSET_TOP}>
        <Paragraph.Text typography="t4">이번 달 이체 체크</Paragraph.Text>
        <Spacing size={4} />
        <Paragraph.Text data-testid="progress-text" typography="t6" color="var(--adaptiveGrey600)">
          {view.progressText}
        </Paragraph.Text>
      </div>
      <Spacing size={8} />
      {view.rows.map((row) => (
        <ListRow
          key={row.key}
          data-testid="checklist-row"
          horizontalPadding="small"
          left={<CategoryBadge kind={row.key} />}
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={`${row.label} · ${formatWon(row.amount)}`}
              bottom={`쓸 수 있는 돈의 ${plan.ratios[CATEGORY_ORDER.indexOf(row.key)]}%`}
            />
          }
          right={<Switch checked={row.checked} onChange={() => toggle(row.key)} aria-label={`${row.label} 이체 완료`} />}
        />
      ))}
    </Card>
  );
}
