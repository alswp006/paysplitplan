import { setClipboardText } from "@apps-in-toss/web-framework";

export type CopyResult = "ok" | "denied" | "failed";

/**
 * SDK 권한 에러의 name — web-framework 3.6.0 런타임은 `${methodName} permission error`로 짓는다.
 * 에러 클래스(SetClipboardTextPermissionError)를 import하지 않고 이름으로 판정한다(테스트 목에 클래스가 없어도 된다).
 */
const PERMISSION_ERROR_NAME = "setClipboardText permission error";

function isPermissionDenied(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { name?: unknown }).name === PERMISSION_ERROR_NAME;
}

/**
 * 텍스트를 클립보드에 복사한다. **절대 throw·reject하지 않는다.**
 *  1. SDK `setClipboardText(text)` — 토스 WebView 안의 정식 경로(config에 clipboard write 권한 선언).
 *  2. 사용자가 권한을 거부했으면 "denied" — 거부를 우회하지 않는다(브라우저 폴백을 쓰지 않는다).
 *  3. 그 밖의 실패(WebView 밖이라 브리지가 없음 등)면 `navigator.clipboard.writeText`로 한 번 더 — 성공 "ok", 실패 "failed".
 * SDK 호출에는 타임아웃을 두지 않는다 — 권한 창을 보고 고민하는 사용자를 기다리는 동안 폴백으로 새면 거부를 우회하게 된다.
 */
export async function copyText(text: string): Promise<CopyResult> {
  try {
    await setClipboardText(text);
    return "ok";
  } catch (e) {
    if (isPermissionDenied(e)) return "denied";
  }
  try {
    const clip = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clip || typeof clip.writeText !== "function") return "failed";
    await clip.writeText(text);
    return "ok";
  } catch {
    return "failed";
  }
}
