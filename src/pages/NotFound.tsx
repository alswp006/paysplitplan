import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Asset, Button, Paragraph, Spacing } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { PageShell } from "@/components/PageShell";
import { fireAndForget, logImpression } from "@/lib/analytics";

export default function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    logImpression("not_found");
  }, []);

  return (
    <PageShell>
      <div
        data-testid="not-found"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "0 24px" }}
      >
        <Spacing size={80} />
        <Asset.ContentIcon name="icon-search-bold-mono" alt="" style={{ width: 48, height: 48 }} />
        <Spacing size={16} />
        <Paragraph.Text typography="t3">페이지를 찾을 수 없어요</Paragraph.Text>
        <Spacing size={8} />
        <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
          주소가 바뀌었거나 없는 화면이에요
        </Paragraph.Text>
        <Spacing size={24} />
        <div style={{ display: "flex", flexDirection: "column", alignSelf: "stretch" }}>
          <Button
            variant="fill"
            size="large"
            display="block"
            onClick={() => {
              fireAndForget(() => generateHapticFeedback({ type: "success" }));
              navigate("/", { replace: true });
            }}
          >
            홈으로 가기
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
