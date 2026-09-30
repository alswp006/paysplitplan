import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDialog, useToast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import type { PlanDraft } from "@/lib/types";
import { SubmitFooter } from "@/components/BottomCTA";
import { isSamePlan } from "@/lib/plan";
import { loadPlan, peekPlan, savePlan } from "@/lib/storage";
import { logClick } from "@/lib/analytics";
import { resyncCurrentMonth } from "@/lib/recordToggle";

function tickConfirm() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickMedium" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export function ResultSaveFooter({
  draft,
  initiallySaved,
}: {
  draft: PlanDraft;
  initiallySaved: boolean;
}) {
  const navigate = useNavigate();
  const dialog = useDialog();
  const toast = useToast();
  const [saved, setSaved] = useState(initiallySaved);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const doSave = () => {
    const result = savePlan(draft);
    if (result.ok) {
      logClick("plan_save");
      // 이번 달 체크는 그대로 두고 금액·이행률만 새 계획으로 다시 센다(홈·기록이 같은 숫자를 보게).
      // 실패해도 계획 저장은 이미 끝났다 — 토스트를 띄우지 않는다.
      const savedPlan = peekPlan();
      if (savedPlan) resyncCurrentMonth(savedPlan);
      // 짧게 — 홈으로 넘어가 탭 바를 덮지 않게. 리뷰 요청은 첫 이체 체크 100% 순간에만 한다(ChecklistCard).
      toast.openToast("계획을 저장했어요", { higherThanCTA: true, duration: 2000 });
      setSaved(true);
    } else {
      toast.openToast("저장 공간이 부족해 저장하지 못했어요", { higherThanCTA: true });
    }
  };

  const onPrimary = async () => {
    if (saved) {
      navigate("/");
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const existing = loadPlan();
      if (existing && !isSamePlan(draft, existing)) {
        const ok = await dialog.openConfirm({
          title: "저장된 계획을 바꿀까요?",
          description: "지금 계획으로 바뀌어요. 지난 기록은 그대로 두고, 이번 달 체크만 새 금액으로 다시 세요.",
          confirmButton: "바꾸기",
          cancelButton: "닫기",
        });
        if (!ok) return;
        tickConfirm();
        logClick("plan_overwrite_confirm");
      }
      doSave();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <SubmitFooter
      label={saved ? "홈에서 이체 체크하기" : "이 계획 저장하기"}
      onClick={onPrimary}
      loading={busy}
    />
  );
}
