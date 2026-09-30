import { Button, Chip, ChipItem, ListRow, Paragraph, Spacing } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import type { Ratios } from "@/lib/types";
import { CategoryBadge } from "@/components/CategoryBadge";
import { SplitBar } from "@/components/SplitBar";
import { ratioSplit } from "@/lib/split";
import { CATEGORY_LABEL, CATEGORY_ORDER, PRESETS } from "@/lib/plan";
import { RATIO_STEP, getRatioRowBody, stepRatio, sumRatios } from "@/lib/ratioForm";

const CUSTOM_ID = "custom";
const PRESET_LIST = [PRESETS.p532, PRESETS.p442, PRESETS.p622];

function tickWeak() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export function RatioBlock({
  ratios,
  presetId,
  available,
  onChange,
}: {
  ratios: Ratios;
  presetId: string;
  available: number | null;
  onChange: (ratios: Ratios, presetId: string) => void;
}) {
  const sum = sumRatios(ratios);

  const pickPreset = (id: string, next: Ratios) => {
    tickWeak();
    onChange([...next] as Ratios, id);
  };

  const step = (index: number, delta: number) => {
    const current = ratios[index];
    const nextValue = stepRatio(current, delta);
    if (nextValue === current) return;
    tickWeak();
    const next = [...ratios] as Ratios;
    next[index] = nextValue;
    onChange(next, CUSTOM_ID);
  };

  const preview = ratioSplit(ratios);
  // 합계가 100%가 아니면 막대도 그 사실을 보여 준다 — 모자라면 남은 몫을 빈 조각으로, 넘치면 막대를 흐리게.
  const previewLabel = sum === 100 ? preview.ariaLabel : `${preview.ariaLabel} · 합계 ${sum}%`;

  return (
    <div>
      {/* 비율 미리보기 — 칩·+/-를 누르면 바로 조각 폭이 바뀐다. 아래 비율 행(배지 + 이름)이 색의 뜻을 말한다. */}
      <div style={{ padding: "0 20px", opacity: sum > 100 ? 0.35 : 1 }} data-over={sum > 100 ? "true" : undefined}>
        <SplitBar
          testId="ratio-preview-bar"
          height={12}
          segments={preview.segments}
          remainder={sum < 100 ? 100 - sum : 0}
          ariaLabel={previewLabel}
        />
      </div>
      <Spacing size={16} />
      <Chip kind="select" wrap>
        {PRESET_LIST.map((p) => (
          // aria-pressed: 벤더 ChipItem은 선택 상태를 색으로만 그리고 접근성 속성을 달지 않는다(2.5.1 런타임).
          // div 속성은 버튼으로 그대로 펼쳐지므로 여기서 넘겨 스크린리더가 "선택됨"을 읽게 한다.
          <ChipItem
            key={p.id}
            selected={presetId === p.id}
            aria-pressed={presetId === p.id}
            onClick={() => pickPreset(p.id, p.ratios)}
          >
            {p.name}
          </ChipItem>
        ))}
        <ChipItem
          selected={presetId === CUSTOM_ID}
          aria-pressed={presetId === CUSTOM_ID}
          onClick={() => pickPreset(CUSTOM_ID, ratios)}
        >
          직접 조정
        </ChipItem>
      </Chip>
      <Spacing size={12} />
      {CATEGORY_ORDER.map((key, index) => (
        <ListRow
          key={key}
          horizontalPadding="small"
          left={<CategoryBadge kind={key} />}
          contents={
            <ListRow.Texts type="2RowTypeA" top={CATEGORY_LABEL[key]} bottom={getRatioRowBody(key, ratios, available)} />
          }
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="weak"
                size="small"
                aria-label={`${CATEGORY_LABEL[key]} ${RATIO_STEP}% 줄이기`}
                disabled={ratios[index] <= 0}
                onClick={() => step(index, -RATIO_STEP)}
              >
                -
              </Button>
              <Button
                variant="weak"
                size="small"
                aria-label={`${CATEGORY_LABEL[key]} ${RATIO_STEP}% 늘리기`}
                disabled={ratios[index] >= 100}
                onClick={() => step(index, RATIO_STEP)}
              >
                +
              </Button>
            </div>
          }
        />
      ))}
      <Spacing size={8} />
      <div style={{ padding: "0 20px" }}>
        <Paragraph.Text data-testid="ratio-sum" typography="t5">
          합계 {sum}%
        </Paragraph.Text>
      </div>
      {sum !== 100 ? (
        <div style={{ padding: "0 20px" }}>
          <Spacing size={4} />
          <Paragraph.Text typography="t6" color="var(--adaptiveRed500)">
            비율 합계를 100%로 맞춰주세요 (현재 {sum}%)
          </Paragraph.Text>
        </div>
      ) : null}
    </div>
  );
}
