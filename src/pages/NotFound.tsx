import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Asset, Button } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { PageShell } from "@/components/PageShell";
import { EmptyState } from "@/components/StateView";
import { fireAndForget, logImpression } from "@/lib/analytics";

export default function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    logImpression("not_found");
  }, []);

  return (
    <PageShell>
      <EmptyState
        fill
        testId="not-found"
        icon={<Asset.ContentIcon name="icon-search-bold-mono" alt="" style={{ width: 48, height: 48 }} />}
        title="페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 없는 화면이에요"
        action={
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
        }
      />
    </PageShell>
  );
}
