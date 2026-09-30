import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ListRow, Paragraph, Spacing, TextField, Top, useToast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { RatioBlock } from "@/components/plan/RatioBlock";
import { FixedCostSheet } from "@/components/plan/FixedCostSheet";
import { logClick } from "@/lib/analytics";
import { formatAmountRaw, formatManwon, formatWon } from "@/lib/format";
import { PRESETS, resolvePresetId } from "@/lib/plan";
import { sumRatios } from "@/lib/ratioForm";
import {
  FIXED_COST_LIMIT,
  PAYDAY_HELP,
  buildDraft,
  formatAvailablePreview,
  getAvailable,
  sumFixedCosts,
  validatePaydayInput,
  validateSalaryInput,
} from "@/lib/planForm";
import { loadPlan } from "@/lib/storage";
import type { FixedCost, Ratios, RouteState } from "@/lib/types";

const DEFAULT_PAYDAY = "25";
// TDS 입력·리스트의 내장 좌우 패딩(20px)에 맞춘 맨 텍스트·버튼용 거터 — 정렬선을 20px 하나로 통일한다.
const GUTTER = { padding: "0 20px" } as const;
const MAX_FIXED_COST_TOAST = "고정비는 최대 10개까지 추가할 수 있어요";
// 비율 오류의 자세한 문구("…맞춰주세요 (현재 90%)")는 RatioBlock이 칸 바로 아래에 보여준다 — 하단 안내는 다음 행동만 말한다.
const RATIO_HINT = "비율 합계가 100%가 되면 결과를 볼 수 있어요";

function tickMedium() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickMedium" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

interface FormState {
  salaryRaw: string;
  paydayRaw: string;
  fixedCosts: FixedCost[];
  ratios: Ratios;
  presetId: string;
}

function initialState(): FormState {
  const plan = loadPlan();
  if (!plan) {
    return {
      salaryRaw: "",
      paydayRaw: DEFAULT_PAYDAY,
      fixedCosts: [],
      ratios: [...PRESETS.p532.ratios] as Ratios,
      presetId: PRESETS.p532.id,
    };
  }
  return {
    salaryRaw: plan.salary.toLocaleString("ko-KR"),
    paydayRaw: String(plan.payday),
    fixedCosts: plan.fixedCosts,
    ratios: [...plan.ratios] as Ratios,
    presetId: resolvePresetId(plan.ratios),
  };
}

export default function Plan() {
  const navigate = useNavigate();
  const { openToast } = useToast();
  const [form, setForm] = useState<FormState>(initialState);
  const [salaryTouched, setSalaryTouched] = useState(false);
  const [paydayTouched, setPaydayTouched] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { salaryRaw, paydayRaw, fixedCosts, ratios, presetId } = form;
  const fixedTotal = sumFixedCosts(fixedCosts);
  const salary = validateSalaryInput(salaryRaw, fixedTotal);
  const payday = validatePaydayInput(paydayRaw);
  const ratioSum = sumRatios(ratios);
  const ratioError = ratioSum === 100 ? null : `비율 합계를 100%로 맞춰주세요 (현재 ${ratioSum}%)`;

  // 월급 빈 값은 버튼을 막는 사유가 아니다 — 탭하면 에러를 보여준다
  const blockingError = (salary.empty ? null : salary.error) ?? payday.error ?? ratioError;
  const footerHint = blockingError === null ? undefined : blockingError === ratioError ? RATIO_HINT : blockingError;
  const salaryErrorShown = salary.error !== null && (salaryTouched || !salary.empty);
  const paydayErrorShown = payday.error !== null && paydayTouched;

  const setField = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const openSheet = () => {
    if (fixedCosts.length >= FIXED_COST_LIMIT) {
      openToast(MAX_FIXED_COST_TOAST);
      return;
    }
    setSheetOpen(true);
  };

  const addCost = (cost: FixedCost) => {
    setForm((prev) => ({ ...prev, fixedCosts: [...prev.fixedCosts, cost] }));
    setSheetOpen(false);
  };

  const removeCost = (id: string) => {
    tickMedium();
    setForm((prev) => ({ ...prev, fixedCosts: prev.fixedCosts.filter((c) => c.id !== id) }));
  };

  const submit = () => {
    setSalaryTouched(true);
    setPaydayTouched(true);
    const draft = buildDraft(form);
    if (!draft) return;
    logClick("plan_submit");
    const state: RouteState = { draft };
    navigate("/result", { state });
  };

  return (
    <ScreenScaffold
      flush
      top={<Top title={<Top.TitleParagraph>계획 짜기</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter
          label="배분 결과 보기"
          onClick={submit}
          disabled={blockingError !== null}
          hint={footerHint}
        />
      }
    >
      <TextField
        variant="box"
        label="월급"
        labelOption="sustain"
        aria-label="월급"
        placeholder="예: 3,000,000"
        inputMode="numeric"
        enterKeyHint="next"
        value={salaryRaw}
        onChange={(e) => {
          setSalaryTouched(true);
          setField({ salaryRaw: formatAmountRaw(e.target.value) });
        }}
        help={salaryErrorShown ? (salary.error ?? undefined) : formatManwon(salary.value) || undefined}
        hasError={salaryErrorShown}
      />
      <Spacing size={12} />
      <TextField
        variant="box"
        label="월급날"
        labelOption="sustain"
        aria-label="월급날"
        placeholder="예: 25"
        inputMode="numeric"
        enterKeyHint="done"
        suffix="일"
        value={paydayRaw}
        onChange={(e) => {
          setPaydayTouched(true);
          setField({ paydayRaw: e.target.value });
        }}
        help={paydayErrorShown ? (payday.error ?? undefined) : PAYDAY_HELP}
        hasError={paydayErrorShown}
      />
      <Spacing size={24} />
      <div style={GUTTER}>
        <Paragraph.Text typography="t4">고정비</Paragraph.Text>
      </div>
      <Spacing size={12} />
      {fixedCosts.length === 0 ? (
        <div style={GUTTER}>
          <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
            월세·통신비처럼 매달 나가는 돈을 넣어 주세요
          </Paragraph.Text>
          <Spacing size={12} />
        </div>
      ) : (
        fixedCosts.map((fc) => (
          <ListRow
            key={fc.id}
            contents={<ListRow.Texts type="2RowTypeA" top={fc.name} bottom={formatWon(fc.amount)} />}
            right={
              <Button
                variant="weak"
                size="small"
                color="danger"
                aria-label={`${fc.name} 삭제`}
                onClick={() => removeCost(fc.id)}
              >
                삭제
              </Button>
            }
          />
        ))
      )}
      <div style={GUTTER}>
        <Button variant="weak" size="medium" onClick={openSheet}>
          고정비 추가
        </Button>
      </div>
      <Spacing size={24} />
      <div style={GUTTER}>
        <Paragraph.Text data-testid="available-preview" typography="t4">
          {formatAvailablePreview(salaryRaw, fixedTotal)}
        </Paragraph.Text>
      </div>
      <Spacing size={24} />
      <div style={GUTTER}>
        <Paragraph.Text typography="t4">어떻게 나눌까요?</Paragraph.Text>
      </div>
      <Spacing size={12} />
      <RatioBlock
        ratios={ratios}
        presetId={presetId}
        available={getAvailable(salaryRaw, fixedTotal)}
        onChange={(nextRatios, nextPresetId) => setField({ ratios: nextRatios, presetId: nextPresetId })}
      />
      <Spacing size={128} />
      <FixedCostSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={addCost} />
    </ScreenScaffold>
  );
}
