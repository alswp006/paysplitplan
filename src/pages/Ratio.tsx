import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Top, Chip, ChipItem, TextField, Paragraph, Spacing, Toast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { Card } from "@/components/Card";
import { BUCKET_ORDER, BUCKET_LABEL, PRESETS, MSG } from "@/lib/constants";
import type { Bucket } from "@/lib/constants";
import { sumRatios, matchPreset } from "@/lib/calc";
import { clampRatio, formatWon, formatPercent, parseDigits } from "@/lib/format";
import { loadPlan, savePlan } from "@/lib/storage";
import { logClick } from "@/lib/analytics";
import type { Plan, RouteState } from "@/lib/types";

const PRESET_CHIPS = [
  { id: "basic_5311", label: "기본 5:3:1:1" },
  { id: "saving_4411", label: "저축 집중 4:4:1:1" },
  { id: "living_6211", label: "여유 생활 6:2:1:1" },
  { id: "custom", label: "직접 조정" },
] as const;

function tickHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

function computeBuckets(remaining: number, ratios: Record<Bucket, number>): Record<Bucket, number> {
  const floorToUnit = (n: number) => Math.floor(n / 1000) * 1000;
  const saving = floorToUnit(remaining * (ratios.saving / 100));
  const emergency = floorToUnit(remaining * (ratios.emergency / 100));
  const leisure = floorToUnit(remaining * (ratios.leisure / 100));
  const living = remaining - saving - emergency - leisure;
  return { living, saving, emergency, leisure };
}

export default function Ratio() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RouteState["/ratio"]) ?? undefined;
  const draft = state?.draft;
  const [storedPlan] = useState<Plan | null>(() => loadPlan());
  const hasData = Boolean(draft || storedPlan);

  useEffect(() => {
    if (!hasData) {
      navigate("/setup", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData]);

  const salary = draft?.salary ?? storedPlan?.salary ?? 0;
  const payday = draft?.payday ?? storedPlan?.payday ?? 25;
  const fixedCosts = draft?.fixedCosts ?? storedPlan?.fixedCosts ?? [];
  const fixedTotal = fixedCosts.reduce((sum, item) => sum + item.amount, 0);
  const remaining = salary - fixedTotal;

  const [ratios, setRatios] = useState<Record<Bucket, number>>(
    () => (storedPlan?.ratios as Record<Bucket, number>) ?? { ...PRESETS.basic_5311 },
  );
  const [toastOpen, setToastOpen] = useState(false);

  if (!hasData) return null;

  const activePresetId = matchPreset(ratios);
  const sum = sumRatios(ratios);
  const isValid = sum === 100;
  const buckets = computeBuckets(remaining, ratios);

  function handlePresetClick(id: string) {
    tickHaptic();
    if (id !== "custom") {
      setRatios({ ...PRESETS[id as keyof typeof PRESETS] });
    }
  }

  function handleRatioChange(bucket: Bucket, e: ChangeEvent<HTMLInputElement>) {
    const digits = parseDigits(e.target.value);
    setRatios((prev) => ({ ...prev, [bucket]: clampRatio(digits ?? 0) }));
  }

  function handleSave() {
    const now = new Date().toISOString();
    const plan: Plan = {
      version: 1,
      salary,
      fixedCosts,
      payday,
      presetId: activePresetId,
      ratios,
      createdAt: storedPlan?.createdAt ?? now,
      updatedAt: now,
    };

    const result = savePlan(plan);
    if (!result.ok) {
      setToastOpen(true);
      return;
    }

    logClick("plan_save");
    navigate("/result", { state: { justSaved: true } as RouteState["/result"] });
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>어떤 비율로 나눌까요?</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="이 비율로 저장" onClick={handleSave} disabled={!isValid} />}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Chip>
          {PRESET_CHIPS.map(({ id, label }) => (
            <ChipItem
              key={id}
              selected={activePresetId === id}
              onClick={() => handlePresetClick(id)}
            >
              {label}
            </ChipItem>
          ))}
        </Chip>
      </div>

      <Spacing size={16} />

      <Card>
        {BUCKET_ORDER.map((bucket, idx) => (
          <div key={bucket}>
            {idx > 0 && <Spacing size={12} />}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <TextField
                  variant="box"
                  label={BUCKET_LABEL[bucket]}
                  placeholder="0"
                  inputMode="numeric"
                  suffix="%"
                  value={String(ratios[bucket])}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleRatioChange(bucket, e)}
                  data-testid={`ratio-input-${bucket}`}
                />
              </div>
              <Paragraph.Text typography="st8" data-testid={`ratio-amount-${bucket}`}>
                {BUCKET_LABEL[bucket]} {formatPercent(ratios[bucket], 0)} · {formatWon(buckets[bucket])}
              </Paragraph.Text>
            </div>
          </div>
        ))}
      </Card>

      <Spacing size={16} />

      <Paragraph.Text
        typography="st9"
        data-testid="ratio-sum"
        color={isValid ? undefined : "var(--adaptiveRed500)"}
      >
        합계 {formatPercent(sum, 0)}
      </Paragraph.Text>

      <Spacing size={80} />

      <Toast open={toastOpen} position="bottom" text={MSG.quota} onClose={() => setToastOpen(false)} />
    </ScreenScaffold>
  );
}
