// SDK v3(2026-07-31)부터 설정 파일은 apps-in-toss.config.ts다 — granite.config.ts는
// ait build가 인식하지 않는다(실측: "apps-in-toss.config에 appName이 설정되어야 합니다").
// v3에서 displayName·icon은 콘솔 등록 정보로 이관됐다 — 여기 다시 넣지 마라(무시된다).
//
// @apps-in-toss/web-framework가 설치된 환경에서는 해당 패키지의 defineConfig를 사용합니다.
// Railway 등 외부 빌드 환경에서는 로컬 identity 함수로 대체합니다.
const defineConfig = <T>(config: T): T => config;

export default defineConfig({
  // 콘솔에 등록된 앱 이름과 대소문자까지 완벽 일치해야 한다(불일치 = 배포 4031)
  appName: 'paysplitplan',
  brand: {
    // 앱 강조색 = tds-colors 라이트 --adaptiveGreen800(흰 글자 대비 4.75:1 · AA). 토스 파랑(#3182F6)을 쓰지 않는다.
    // 실기기에서 TDS 버튼(fill·weak)에 적용된다 — 브라우저(WebView 밖)에서는 TDS가 기본 파랑으로 떨어지는 게 정상이다.
    // 앱이 직접 그리는 색(막대·배지·탭)은 src/lib/theme.ts 하나가 원천이다. 이 값을 바꾸면 theme.test가 대조한다.
    primaryColor: '#028450',
  },
  // 세팅표 금액 복사(setClipboardText)에만 쓴다 — 사용자가 누른 금액만 복사한다(콘솔 권한 사유와 같은 문장).
  permissions: [{ name: 'clipboard', access: 'write' }],
});
