import { Button, Chip, ChipItem, ListRow, Paragraph, Spacing } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import type { Ratios } from "@/lib/types";
import { CATEGORY_LABEL, CATEGORY_ORDER, PRESETS } from "@/lib/plan";
import { RATIO_STEP, getRatioRowText, stepRatio, sumRatios } from "@/lib/ratioForm";

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

  return (
    <div>
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
          contents={<ListRow.Texts type="1RowTypeA" top={getRatioRowText(key, ratios, available)} />}
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
