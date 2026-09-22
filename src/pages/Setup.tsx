import { useRef, useState } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Top, TextField, Paragraph, Spacing, ListRow, Button } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import FixedCostSheet from "@/components/FixedCostSheet";
import { formatComma, formatWon, parseDigits } from "@/lib/format";
import { loadPlan } from "@/lib/storage";
import { validateSetup } from "@/lib/validation";
import { LIMITS } from "@/lib/constants";
import { logClick } from "@/lib/analytics";
import type { FixedCost, PlanDraft, RouteState } from "@/lib/types";

function focusIntoView(e: FocusEvent<HTMLInputElement>) {
  try {
    e.target.scrollIntoView({ block: "center" });
  } catch {
    /* jsdom 등 scrollIntoView 미구현 환경 — 무시 */
  }
}

export default function Setup() {
  const navigate = useNavigate();
  const [plan] = useState(() => loadPlan());

  const [salaryText, setSalaryText] = useState(() => (plan ? formatComma(plan.salary) : ""));
  const [paydayText, setPaydayText] = useState(() => String(plan?.payday ?? 25));
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>(() => plan?.fixedCosts ?? []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const salaryInputRef = useRef<HTMLInputElement>(null);
  const paydayInputRef = useRef<HTMLInputElement>(null);

  const salary = parseDigits(salaryText) ?? 0;
  const payday = parseDigits(paydayText) ?? 0;
  const fixedTotal = fixedCosts.reduce((sum, item) => sum + item.amount, 0);
  const remaining = salary - fixedTotal;
  const draft: PlanDraft = { salary, payday, fixedCosts };
  const errors = submitted ? validateSetup(draft) : {};

  function handleSalaryChange(e: ChangeEvent<HTMLInputElement>) {
    const digits = parseDigits(e.target.value);
    setSalaryText(digits === null ? "" : formatComma(digits));
  }

  function handlePaydayChange(e: ChangeEvent<HTMLInputElement>) {
    const digits = parseDigits(e.target.value);
    setPaydayText(digits === null ? "" : String(digits));
  }

  function handleDeleteFixedCost(id: string) {
    setFixedCosts((prev) => prev.filter((fc) => fc.id !== id));
  }

  function handleNext() {
    setSubmitted(true);
    const nextErrors = validateSetup(draft);
    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.salary) salaryInputRef.current?.focus();
      else if (nextErrors.payday) paydayInputRef.current?.focus();
      return;
    }

    logClick("setup_next");
    navigate("/ratio", { state: { draft } as RouteState["/ratio"] });
  }

  const fixedCostsFull = fixedCosts.length >= LIMITS.maxFixedCostItems;

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>월급과 고정비를 알려주세요</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="다음" onClick={handleNext} />}
    >
      <TextField
        ref={salaryInputRef}
        variant="box"
        label="월급"
        placeholder="예: 3,000,000"
        inputMode="numeric"
        enterKeyHint="next"
        value={salaryText}
        onChange={handleSalaryChange}
        onFocus={focusIntoView}
        help={errors.salary ?? "예: 3,000,000원 (300만원)"}
        hasError={!!errors.salary}
      />
      <Spacing size={12} />
      <TextField
        ref={paydayInputRef}
        variant="box"
        label="월급날"
        placeholder="예: 25"
        inputMode="numeric"
        enterKeyHint="done"
        value={paydayText}
        onChange={handlePaydayChange}
        onFocus={focusIntoView}
        help={errors.payday ?? "매달 월급을 받는 날짜예요"}
        hasError={!!errors.payday}
      />

      <Spacing size={24} />
      <Paragraph.Text typography="t4">매달 나가는 고정비</Paragraph.Text>
      <Spacing size={12} />

      {fixedCosts.length === 0 ? (
        <Paragraph.Text data-testid="fixed-empty" typography="st8" color="var(--adaptiveGrey600)">
          아직 고정비가 없어요. 월세·통신비처럼 매달 빠지는 돈을 추가해보세요
        </Paragraph.Text>
      ) : (
        fixedCosts.map((fc) => (
          <ListRow
            key={fc.id}
            contents={<ListRow.Texts type="1RowTypeA" top={`${fc.name} ${formatWon(fc.amount)}`} />}
            right={
              <Button
                size="small"
                variant="weak"
                color="dark"
                onClick={() => handleDeleteFixedCost(fc.id)}
              >
                삭제
              </Button>
            }
          />
        ))
      )}

      <Spacing size={12} />
      <Button
        variant="weak"
        size="large"
        display="block"
        disabled={fixedCostsFull}
        onClick={() => setSheetOpen(true)}
      >
        고정비 추가
      </Button>

      <Spacing size={24} />
      <Paragraph.Text data-testid="remaining-preview" typography="t5">
        쪼갤 수 있는 돈 {formatWon(remaining)}
      </Paragraph.Text>

      {errors.fixedTotal && (
        <>
          <Spacing size={8} />
          <Paragraph.Text typography="st9" color="var(--adaptiveRed500)" role="alert">
            {errors.fixedTotal}
          </Paragraph.Text>
        </>
      )}

      <Spacing size={80} />

      <FixedCostSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={(fc) => setFixedCosts((prev) => [...prev, fc])}
      />
    </ScreenScaffold>
  );
}
