import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Top } from "@toss/tds-mobile";
import { SearchX } from "lucide-react";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { BrandIcon } from "@/components/BrandIcon";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { EmptyState } from "@/components/StateView";
import { fireAndForget, logImpression } from "@/lib/analytics";

export default function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    logImpression("not_found");
  }, []);

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>월급쪼개기</Top.TitleParagraph>} />}>
      <EmptyState
        fill
        testId="not-found"
        // 번들에 포함된 lucide 아이콘 — 네트워크(static.toss.im)에서 받지 않아 오프라인·차단 환경에서도 깨지지 않는다.
        icon={
          <BrandIcon>
            <SearchX size={36} aria-hidden data-testid="not-found-icon" />
          </BrandIcon>
        }
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
    </ScreenScaffold>
  );
}
