/**
 * 토스 WebView 밖(일반 브라우저)에서만 나는 알려진 dev 에러 — 무시한다(실기기 WebView엔 안 남).
 * visual-smoke와 paysplit-walk가 같은 목록을 쓴다(스펙 파일끼리 import하면 Playwright가 거부한다).
 * 새 항목은 **출처를 주석에 적은 좁은 정규식**만 넣는다 — 넓은 패턴은 진짜 콘솔 에러를 가린다.
 */
export const IGNORED_CONSOLE: RegExp[] = [/SafeAreaInsets/i, /getSafeAreaInsets/i];
