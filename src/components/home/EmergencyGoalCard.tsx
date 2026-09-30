import { useEffect, useState } from "react";
import { BottomSheet, Button, Paragraph, ProgressBar, SegmentedControl, Spacing, TextField, useToast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { Card } from "@/components/Card";
import { CARD_INSET } from "@/lib/theme";
import { logClick } from "@/lib/analytics";
import { getToday, monthKey } from "@/lib/date";
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

// 맨 텍스트만 있는 카드 — 패딩 20이면 제목이 x = 16 + 20 = 36px 정렬선에 선다(체크리스트 제목·배지와 같은 선).
const GOAL_CARD_STYLE = { padding: CARD_INSET } as const;
const SAVE_FAIL_TOAST = "목표를 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요";
// 잔액을 이번 달 이체 전으로 볼지 후로 볼지는 이번 달 비상금 체크가 정한다(goal.adjustBalance) — 안내도 그 기준을 말한다.
const BALANCE_HELP_CHECKED = "이번 달 이체까지 들어간 지금 잔액으로 저장해요";
const BALANCE_HELP_UNCHECKED = "이번 달 이체 전 잔액으로 저장해요. 이미 옮겼다면 이체 완료를 먼저 켜 주세요";

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

function BalanceSheet({
  open,
  help,
  onClose,
  onSave,
}: {
  open: boolean;
  help: string;
  onClose: () => void;
  onSave: (balance: number) => void;
}) {
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
          help={errorShown ? (check.error ?? undefined) : help}
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

  // 기록이 바뀔 때마다(체크 토글) 저장된 목표를 다시 읽는다 — 24개월 정리가 지운 달의 비상금을 목표(baseBalance)에
  // 합쳐 두는데(storage.writeMonthRecord → goal.foldPrunedIntoGoal), 메모리의 낡은 사본으로 화면을 그리거나 그 사본을
  // 다시 저장하면 합친 금액이 영영 사라진다.
  useEffect(() => {
    setGoal((prev) => {
      const fresh = loadGoal();
      return JSON.stringify(fresh) === JSON.stringify(prev) ? prev : fresh;
    });
  }, [store]);

  const persist = (next: EmergencyGoal): boolean => {
    const result = saveGoal(next);
    if (!result.ok) {
      toast.openToast(SAVE_FAIL_TOAST, { higherThanCTA: true });
      return false;
    }
    setGoal(next);
    return true;
  };

  const title = <Paragraph.Text typography="t4" role="heading" aria-level={2}>비상금 목표</Paragraph.Text>;

  if (!goal) {
    const { fixedTotal, living, essential } = essentialOf(plan);
    const pick = (months: GoalMonths) => {
      if (persist(createGoal(months, getToday()))) {
        haptic("tickWeak");
        logClick("goal_set");
      }
    };
    return (
      <Card testId="emergency-goal" style={GOAL_CARD_STYLE}>
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

  const today = getToday();
  const s = summarizeGoal(goal, plan, store, today);
  const checkedThisMonth = store.records[monthKey(today)]?.checked?.emergency === true;
  // 쓰기는 항상 저장소의 최신 목표 위에서 한다(메모리 사본이 정리 합산보다 낡았을 수 있다).
  const latest = (): EmergencyGoal => loadGoal() ?? goal;

  const changeMonths = (v: string) => {
    const months = Number(v);
    if (!isGoalMonths(months) || months === goal.months) return;
    if (persist(withMonths(latest(), months))) {
      haptic("tickWeak");
      logClick("goal_months");
    }
  };

  const saveBalance = (balance: number) => {
    if (persist(adjustBalance(latest(), balance, getToday(), checkedThisMonth))) {
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
    <Card testId="emergency-goal" style={GOAL_CARD_STYLE}>
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
            // 벤더 기본 aria-valuetext는 progress×100 원값("15.925…%")이라 읽기 어렵다 — 정수 %로 덮는다.
            aria-valuetext={`목표의 ${Math.floor(s.progress * 100)}%`}
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
          {/* 벤더 SegmentedControl은 좌우 24px 안쪽 여백을 갖는다 — 감싸개에서 되돌려 트랙이 카드 정렬선(x 36px)에 서게 한다.
              감싸개 role=group + aria-label: 벤더 라디오 묶음에는 이름이 없다. */}
          <div role="group" aria-label="비상금 목표 기간" style={{ margin: "0 -24px" }}>
            <SegmentedControl size="small" value={String(goal.months)} onChange={changeMonths}>
              {GOAL_MONTH_OPTIONS.map((m) => (
                <SegmentedControl.Item key={m} value={String(m)}>
                  {`${m}개월치`}
                </SegmentedControl.Item>
              ))}
            </SegmentedControl>
          </div>
        </>
      ) : null}
      <BalanceSheet
        open={sheetOpen}
        help={checkedThisMonth ? BALANCE_HELP_CHECKED : BALANCE_HELP_UNCHECKED}
        onClose={() => setSheetOpen(false)}
        onSave={saveBalance}
      />
    </Card>
  );
}
