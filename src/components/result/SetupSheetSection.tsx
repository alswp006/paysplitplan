import { Button, ListRow, Paragraph, Spacing, useToast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { Card } from "@/components/Card";
import { logClick } from "@/lib/analytics";
import { copyText, type CopyResult } from "@/lib/clipboard";
import { formatWon } from "@/lib/format";
import { buildSetupRows, buildSetupSheetText, setupSignature, transferDayLabel } from "@/lib/setup";
import { markSetupCopied } from "@/lib/setupState";
import type { PlanDraft } from "@/lib/types";

const DENIED_TOAST = "클립보드 권한이 없어 복사하지 못했어요. 금액을 길게 눌러 복사해 주세요";
const FAILED_TOAST = "복사하지 못했어요. 금액을 길게 눌러 복사해 주세요";
const TOAST_OPTIONS = { higherThanCTA: true } as const;

function tickWeak() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

/**
 * 은행 앱에 옮길 세팅표 — 결과 화면 무료 층의 본문. 통장마다 금액 복사 버튼, 아래에 전체 복사.
 * 무료 층에서 통장 금액이 **텍스트 노드로 나오는 유일한 자리**다(각 행 오른쪽 금액 한 번씩 — 테스트가 유일성을 잰다).
 * 금액은 user-select: text라 클립보드 권한이 없어도 길게 눌러 복사할 수 있다.
 */
export function SetupSheetSection({ draft }: { draft: PlanDraft }) {
  const toast = useToast();
  const rows = buildSetupRows(draft);
  const dayLabel = transferDayLabel(draft.payday);
  const signature = setupSignature(draft);

  const report = (result: CopyResult, successText: string) => {
    if (result === "ok") {
      tickWeak();
      toast.openToast(successText, TOAST_OPTIONS);
    } else {
      toast.openToast(result === "denied" ? DENIED_TOAST : FAILED_TOAST, TOAST_OPTIONS);
    }
  };

  const copyRow = async (index: number) => {
    const row = rows[index];
    logClick("setup_copy_row");
    const result = await copyText(row.copyText);
    if (result === "ok") markSetupCopied(signature, [row.key]);
    report(result, `${row.label} ${formatWon(row.amount)}을 복사했어요`);
  };

  const copyAll = async () => {
    logClick("setup_copy_all");
    const result = await copyText(buildSetupSheetText(draft));
    if (result === "ok") markSetupCopied(signature, rows.map((r) => r.key));
    report(result, "세팅표를 복사했어요");
  };

  return (
    <Card testId="setup-sheet">
      <Paragraph.Text typography="t4">은행 앱에 옮길 세팅표</Paragraph.Text>
      <Spacing size={4} />
      <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
        {`자동이체나 모으기 통장에 금액을 붙여 넣어요 · 이체는 ${dayLabel}`}
      </Paragraph.Text>
      <Spacing size={8} />
      {rows.map((row, i) => (
        <div key={row.key} data-testid="allocation-card">
          <ListRow
            contents={
              // 이체일은 행마다 반복하지 않는다 — 모든 통장이 같은 날이고 바로 위 캡션이 말한다. 반복하면 360px에서
              // 아랫줄이 세 줄로 꺾였다(실측). 복사하는 세팅표 문자열에는 첫 줄에 이체일이 들어간다.
              <ListRow.Texts type="2RowTypeA" top={row.label} bottom={`나눌 돈의 ${row.ratio}%`} />
            }
            right={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Paragraph.Text typography="t5" style={{ userSelect: "text", whiteSpace: "nowrap" }}>
                  {formatWon(row.amount)}
                </Paragraph.Text>
                <Button size="small" variant="weak" aria-label={`${row.label} 금액 복사`} onClick={() => void copyRow(i)}>
                  복사
                </Button>
              </div>
            }
          />
        </div>
      ))}
      <Spacing size={12} />
      <Button variant="weak" size="large" display="block" onClick={() => void copyAll()}>
        세팅표 전체 복사
      </Button>
    </Card>
  );
}
