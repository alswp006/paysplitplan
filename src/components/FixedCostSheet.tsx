import { useState } from "react";
import type { ChangeEvent, FocusEvent, KeyboardEvent } from "react";
import { BottomSheet, TextField, Button, Spacing } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { validateFixedCost } from "@/lib/validation";
import { formatComma, parseDigits, genId } from "@/lib/format";
import type { FixedCost } from "@/lib/types";

function fireSuccessHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "success" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

function focusIntoView(e: FocusEvent<HTMLInputElement>) {
  try {
    e.target.scrollIntoView({ block: "center" });
  } catch {
    /* jsdom 등 scrollIntoView 미구현 환경 — 무시 */
  }
}

interface FixedCostSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (fixedCost: FixedCost) => void;
}

export default function FixedCostSheet({ open, onClose, onAdd }: FixedCostSheetProps) {
  const [name, setName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [nameErr, setNameErr] = useState<string | undefined>();
  const [amountErr, setAmountErr] = useState<string | undefined>();

  function reset() {
    setName("");
    setAmountText("");
    setNameErr(undefined);
    setAmountErr(undefined);
  }

  function handleAdd() {
    const amount = parseDigits(amountText) ?? 0;
    const errors = validateFixedCost(name, amount);
    setNameErr(errors.name);
    setAmountErr(errors.amount);
    if (errors.name || errors.amount) return;

    fireSuccessHaptic();
    onAdd({ id: genId(), name: name.trim(), amount });
    reset();
    onClose();
  }

  function handleAmountChange(e: ChangeEvent<HTMLInputElement>) {
    const digits = parseDigits(e.target.value);
    setAmountText(digits === null ? "" : formatComma(digits));
  }

  function handleAmountKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleAdd();
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <TextField
        variant="box"
        label="항목 이름"
        placeholder="예: 월세"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={focusIntoView}
        help={nameErr}
        hasError={!!nameErr}
      />
      <Spacing size={12} />
      <TextField
        variant="box"
        label="금액"
        placeholder="예: 500,000"
        inputMode="numeric"
        enterKeyHint="done"
        value={amountText}
        onChange={handleAmountChange}
        onKeyDown={handleAmountKeyDown}
        onFocus={focusIntoView}
        help={amountErr}
        hasError={!!amountErr}
      />
      <Spacing size={16} />
      <Button variant="fill" size="large" display="block" onClick={handleAdd}>
        추가
      </Button>
    </BottomSheet>
  );
}
