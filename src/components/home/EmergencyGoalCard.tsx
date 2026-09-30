import { useEffect, useState } from "react";
import { BottomSheet, Button, Paragraph, ProgressBar, SegmentedControl, Spacing, TextField, useToast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { Card } from "@/components/Card";
import { logClick } from "@/lib/analytics";
import { getToday } from "@/lib/date";
import { formatAmountRaw, formatMonthLabel, formatWon, parseAmountInput } from "@/lib/format";
import {
  GOAL_BALANCE_MAX,
  GOAL_MONTH_OPTIONS,
  adjustBalance,
  createGoal,
  essentialOf,
  formatMonthsCovered,
  isGoalMonths,
  loadGoal,
  saveGoal,
  summarizeGoal,
  withMonths,
} from "@/lib/goal";
import type { EmergencyGoal, GoalMonths, RecordStore, SalaryPlan } from "@/lib/types";

const SAVE_FAIL_TOAST = "저장 공간이 부족해 저장하지 못했어요";
const BALANCE_HELP = "이번 달 이체까지 포함한 금액이에요";

function haptic(type: "tickWeak" | "success") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

/** 잔액 입력 원문 검증 — 0원은 유효하다(비상금이 아직 없을 수 있다). */
function validateBalance(raw: string): { value: number; error: string | null } {
  const parsed = parseAmountInput(raw);
  if (parsed.kind === "empty") return { value: 0, error: "금액을 입력해 주세요" };
  if (parsed.kind !== "ok") return { value: 0, error: "숫자만 입력해 주세요" };
  if (parsed.value > GOAL_BALANCE_MAX) return { value: 0, error: "100억 원 이하로 입력해 주세요" };
  return { value: parsed.value, error: null };
}

function BalanceSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (balance: number) => void }) {
  const [raw, setRaw] = useState("");
  const [touched, setTouched] = useState(false);
  const check = validateBalance(raw);
  const errorShown = touched && check.error !== null;

  // 시트가 닫히면 입력을 초기화한다
  useEffect(() => {
    if (open) return;
    setRaw("");
    setTouched(false);
  }, [open]);

  const submit = () => {
    setTouched(true);
    if (check.error !== null) return;
    onSave(check.value);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={<BottomSheet.Header>지금 비상금 통장 잔액</BottomSheet.Header>}
      cta={<BottomSheet.CTA onClick={submit}>잔액 저장</BottomSheet.CTA>}
    >
      <div data-testid="balance-sheet">
        <TextField
          variant="box"
          label="비상금 통장 잔액"
          labelOption="sustain"
          aria-label="비상금 통장 잔액"
          placeholder="예: 1,000,000"
          inputMode="numeric"
          enterKeyHint="done"
          value={raw}
          onChange={(e) => {
            setTouched(true);
            setRaw(formatAmountRaw(e.target.value));
          }}
          help={errorShown ? (check.error ?? undefined) : BALANCE_HELP}
          hasError={errorShown}
        />
      </div>
    </BottomSheet>
  );
}

/**
 * 비상금 N개월 목표 — 홈 체크리스트 아래. 목표는 "한 달 필수 지출(고정비 + 생활비) × N개월"이다.
 * 추천 개월 수·"권장" 문구는 두지 않는다(3·6·12는 사용자가 고른다 — 통계가 아니라 선택지다).
 * store는 홈의 기록 상태를 받는다 — 비상금 스위치를 켜면 모은 돈이 바로 따라온다.
 */
export function EmergencyGoalCard({ plan, store }: { plan: SalaryPlan; store: RecordStore }) {
  const toast = useToast();
  const [goal, setGoal] = useState<EmergencyGoal | null>(() => loadGoal());
  const [sheetOpen, setSheetOpen] = useState(false);

  const persist = (next: EmergencyGoal): boolean => {
    const result = saveGoal(next);
    if (!result.ok) {
      toast.openToast(SAVE_FAIL_TOAST, { higherThanCTA: true });
      return false;
    }
    setGoal(next);
    return true;
  };

  const title = <Paragraph.Text typography="t4">비상금 목표</Paragraph.Text>;

  if (!goal) {
    const { fixedTotal, living, essential } = essentialOf(plan);
    const pick = (months: GoalMonths) => {
      if (persist(createGoal(months, getToday()))) {
        haptic("tickWeak");
        logClick("goal_set");
      }
    };
    return (
      <Card testId="emergency-goal">
        {title}
        <Spacing size={8} />
        {essential > 0 ? (
          <>
            <Paragraph.Text typography="t5">{`한 달 필수 지출 ${formatWon(essential)}`}</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
              {`고정비 ${formatWon(fixedTotal)} + 생활비 ${formatWon(living)} · 몇 달 치를 모을까요?`}
            </Paragraph.Text>
            <Spacing size={12} />
            <div style={{ display: "flex", gap: 8 }}>
              {GOAL_MONTH_OPTIONS.map((m) => (
                <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <Button variant="weak" size="medium" display="block" onClick={() => pick(m)}>
                    {`${m}개월치`}
                  </Button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
            고정비나 생활비를 넣으면 한 달 필수 지출로 목표를 정할 수 있어요
          </Paragraph.Text>
        )}
      </Card>
    );
  }

  const s = summarizeGoal(goal, plan, store, getToday());

  const changeMonths = (v: string) => {
    const months = Number(v);
    if (!isGoalMonths(months) || months === goal.months) return;
    if (persist(withMonths(goal, months))) {
      haptic("tickWeak");
      logClick("goal_months");
    }
  };

  const saveBalance = (balance: number) => {
    if (persist(adjustBalance(goal, balance, getToday()))) {
      haptic("success");
      logClick("goal_balance_adjust");
      setSheetOpen(false);
    }
  };

  const headline =
    s.saved === 0
      ? "아직 모은 비상금이 없어요"
      : s.monthsCovered === null
        ? `비상금 ${formatWon(s.saved)} 모았어요`
        : `${formatMonthsCovered(s.monthsCovered)}개월치 모았어요`;
  const reachText = s.reached
    ? "목표를 채웠어요"
    : s.monthlyEmergency === 0
      ? "비상금 비율을 올리면 채우는 시점을 계산해요"
      : s.reachMonth
        ? `지금 계획대로면 ${formatMonthLabel(s.reachMonth)}쯤 채워요`
        : null;

  return (
    <Card testId="emergency-goal">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {title}
        <Button variant="weak" size="small" onClick={() => setSheetOpen(true)}>
          잔액 맞추기
        </Button>
      </div>
      <Spacing size={8} />
      <Paragraph.Text typography="t3">{headline}</Paragraph.Text>
      {s.target > 0 ? (
        <>
          <Spacing size={4} />
          <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
            {`${formatWon(s.saved)} / 목표 ${formatWon(s.target)}`}
          </Paragraph.Text>
          <Spacing size={12} />
          <ProgressBar
            progress={s.progress}
            size="normal"
            color="var(--adaptivePurple500)"
            aria-label="비상금 목표 진행률"
          />
        </>
      ) : null}
      {s.thisMonthAdded > 0 ? (
        <>
          <Spacing size={8} />
          <Paragraph.Text typography="t6">{`이번 달 +${formatWon(s.thisMonthAdded)}`}</Paragraph.Text>
        </>
      ) : null}
      {s.target > 0 && reachText ? (
        <>
          <Spacing size={4} />
          <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
            {reachText}
          </Paragraph.Text>
        </>
      ) : null}
      {s.target > 0 ? (
        <>
          <Spacing size={16} />
          <SegmentedControl size="small" value={String(goal.months)} onChange={changeMonths}>
            {GOAL_MONTH_OPTIONS.map((m) => (
              <SegmentedControl.Item key={m} value={String(m)}>
                {`${m}개월`}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl>
        </>
      ) : null}
      <BalanceSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSave={saveBalance} />
    </Card>
  );
}
