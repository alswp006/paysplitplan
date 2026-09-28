import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDialog, useToast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import type { PlanDraft } from "@/lib/types";
import { SubmitFooter } from "@/components/BottomCTA";
import { isSamePlan } from "@/lib/plan";
import { loadPlan, savePlan } from "@/lib/storage";
import { logClick } from "@/lib/analytics";
import { requestReviewOnce } from "@/lib/review";

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
      toast.openToast("계획을 저장했어요", { higherThanCTA: true });
      requestReviewOnce();
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
          description: "지금 계획으로 바뀌고, 이전 계획은 되돌릴 수 없어요. 이체 체크 기록은 그대로 남아요.",
          confirmButton: "바꾸기",
          cancelButton: "취소",
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
