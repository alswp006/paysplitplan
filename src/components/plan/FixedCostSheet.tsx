import { useEffect, useState } from "react";
import { BottomSheet, Spacing, TextField } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import type { FixedCost } from "@/lib/types";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/date";
import { validateFixedCostInput } from "@/lib/fixedCostForm";
import { logClick } from "@/lib/analytics";

function success() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "success" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export function FixedCostSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (cost: FixedCost) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  // 시트가 닫히면 입력을 초기화한다
  useEffect(() => {
    if (open) return;
    setName("");
    setAmount("");
    setNameError(null);
    setAmountError(null);
  }, [open]);

  const addCost = () => {
    const result = validateFixedCostInput(name, amount);
    setNameError(result.nameError);
    setAmountError(result.amountError);
    if (!result.valid) return;
    logClick("fixed_cost_add");
    success();
    const now = nowIso();
    onAdd({ id: createId(), name: result.name, amount: result.amount, createdAt: now, updatedAt: now });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={<BottomSheet.Header>고정비 추가</BottomSheet.Header>}
      cta={<BottomSheet.CTA onClick={addCost}>추가</BottomSheet.CTA>}
    >
      <TextField
        variant="box"
        label="항목 이름"
        labelOption="sustain"
        placeholder="예: 월세"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (nameError) setNameError(null);
        }}
        enterKeyHint="next"
        help={nameError ?? undefined}
        hasError={!!nameError}
      />
      <Spacing size={12} />
      <TextField
        variant="box"
        label="금액"
        labelOption="sustain"
        placeholder="예: 500,000"
        inputMode="numeric"
        enterKeyHint="done"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          if (amountError) setAmountError(null);
        }}
        help={amountError ?? undefined}
        hasError={!!amountError}
      />
    </BottomSheet>
  );
}
