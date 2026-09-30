import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, ListRow, Paragraph, Spacing, TextField, Top, useToast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { RatioBlock } from "@/components/plan/RatioBlock";
import { FixedCostSheet } from "@/components/plan/FixedCostSheet";
import { Card } from "@/components/Card";
import { CategoryBadge } from "@/components/CategoryBadge";
import { SplitBar } from "@/components/SplitBar";
import { logClick, logImpression } from "@/lib/analytics";
import { parseSharedRatios, ratioLine } from "@/lib/deeplink";
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
import { ratioSplit } from "@/lib/split";
import { loadPlan } from "@/lib/storage";
import { BRAND } from "@/lib/theme";
import type { FixedCost, Ratios, RouteState, SalaryPlan } from "@/lib/types";

const DEFAULT_PAYDAY = "25";
// TDS 입력의 내장 좌우 패딩(20px)과 ListRow horizontalPadding="small"(20px — 기본 medium은 24px)에 맞춘
// 맨 텍스트·버튼용 거터 — 이 화면(flush)의 정렬선을 20px 하나로 통일한다.
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

/**
 * 폼 초기값. 저장된 계획이 있으면 월급·고정비·월급날·비율을 채우고, 없으면 기본값(월급 빈칸 · 25일 · 기본 5:3:1:1).
 * 받은 링크의 비율(`?r=`)이 유효하면 비율과 프리셋만 그것으로 덮는다 — 월급·고정비는 받은 사람의 것이다.
 * 이 화면은 저장하지 않는다(저장은 결과 화면의 "이 계획 저장하기"뿐) — 받은 비율로 들어와도 기존 계획은 그대로다.
 */
function initialState(plan: SalaryPlan | null, shared: Ratios | null): FormState {
  const base: FormState = plan
    ? {
        salaryRaw: plan.salary.toLocaleString("ko-KR"),
        paydayRaw: String(plan.payday),
        fixedCosts: plan.fixedCosts,
        ratios: [...plan.ratios] as Ratios,
        presetId: resolvePresetId(plan.ratios),
      }
    : {
        salaryRaw: "",
        paydayRaw: DEFAULT_PAYDAY,
        fixedCosts: [],
        ratios: [...PRESETS.p532.ratios] as Ratios,
        presetId: PRESETS.p532.id,
      };
  if (!shared) return base;
  return { ...base, ratios: [...shared] as Ratios, presetId: resolvePresetId(shared) };
}

/** 받은 비율 배너 — 공유 링크(`/plan?r=`)로 들어왔을 때 맨 위에 한 번 보인다. */
function SharedRatioBanner({ ratios, hasPlan }: { ratios: Ratios; hasPlan: boolean }) {
  const split = ratioSplit(ratios);
  return (
    <Card testId="shared-ratio-banner" style={{ backgroundColor: BRAND.tint }}>
      <Paragraph.Text typography="t5">받은 비율로 채웠어요</Paragraph.Text>
      <Spacing size={10} />
      <SplitBar testId="shared-ratio-bar" height={12} segments={split.segments} ariaLabel={`받은 비율 ${split.ariaLabel}`} />
      <Spacing size={8} />
      {/* 막대 색의 텍스트 뜻 — 바로 아래 비율 한 줄이 범례 역할을 한다(색만으로 뜻을 전하지 않는다). */}
      <Paragraph.Text typography="t6">{ratioLine(ratios)}</Paragraph.Text>
      <Spacing size={4} />
      <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
        {hasPlan ? "저장하기 전까지 기존 계획은 그대로예요" : "월급과 고정비를 넣으면 금액이 나와요"}
      </Paragraph.Text>
    </Card>
  );
}

export default function Plan() {
  const navigate = useNavigate();
  const { openToast } = useToast();
  const location = useLocation();
  // 받은 링크의 비율은 진입 때 한 번만 읽는다 — 무효 값(합 110·5의 배수 아님 등)은 조용히 무시한다.
  const [entry] = useState(() => {
    const plan = loadPlan(); // 마운트 때 1회
    const shared = parseSharedRatios(location.search);
    return { shared, hasPlan: plan !== null, form: initialState(plan, shared) };
  });
  const { shared, hasPlan } = entry;
  const [form, setForm] = useState<FormState>(entry.form);
  const openLogged = useRef(false);
  useEffect(() => {
    if (!shared || openLogged.current) return;
    openLogged.current = true;
    logImpression("ratio_link_open");
  }, [shared]);
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
      {shared ? (
        <>
          <div style={GUTTER}>
            <SharedRatioBanner ratios={shared} hasPlan={hasPlan} />
          </div>
          <Spacing size={16} />
        </>
      ) : null}
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
            horizontalPadding="small"
            left={<CategoryBadge kind="fixed" />}
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
