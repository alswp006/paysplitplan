import { describe, it, expect, vi, afterEach } from "vitest";
import { mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { setClipboardText } from "@apps-in-toss/web-framework";
import { copyText } from "@/lib/clipboard";

mockAppsInToss();

const sdkCopy = vi.mocked(setClipboardText);

/** jsdom에는 navigator.clipboard가 없다 — 필요한 테스트만 심는다. undefined면 지운다. */
function setNavigatorClipboard(value: { writeText: (t: string) => Promise<void> } | undefined) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

function permissionError(): Error {
  // SDK 런타임의 PermissionError와 같은 이름(`${methodName} permission error`) — 클래스는 import하지 않는다.
  const e = new Error("클립보드 쓰기 권한이 거부되었어요.");
  e.name = "setClipboardText permission error";
  return e;
}

afterEach(() => {
  setNavigatorClipboard(undefined);
});

describe("copyText — 클립보드 래퍼(절대 throw·reject하지 않는다)", () => {
  it("SDK가 resolve하면 'ok'이고, setClipboardText에는 문자열 하나를 넘긴다", async () => {
    await expect(copyText("720000")).resolves.toBe("ok");
    expect(sdkCopy).toHaveBeenCalledTimes(1);
    expect(typeof sdkCopy.mock.calls[0][0]).toBe("string");
    expect(sdkCopy.mock.calls[0][0]).toBe("720000");
  });

  it("권한 에러면 'denied'이고 브라우저 클립보드로 우회하지 않는다", async () => {
    const writeText = vi.fn(async () => {});
    setNavigatorClipboard({ writeText });
    sdkCopy.mockRejectedValueOnce(permissionError());
    await expect(copyText("720000")).resolves.toBe("denied");
    expect(writeText).toHaveBeenCalledTimes(0);
  });

  it("그 밖의 SDK 에러(WebView 밖)면 navigator.clipboard로 복사하고 'ok'", async () => {
    const writeText = vi.fn(async () => {});
    setNavigatorClipboard({ writeText });
    sdkCopy.mockRejectedValueOnce(new Error("apps-in-toss 웹뷰 환경이 아니에요."));
    await expect(copyText("862000")).resolves.toBe("ok");
    expect(writeText).toHaveBeenCalledWith("862000");
  });

  it("SDK도 navigator.clipboard도 실패하면 'failed'", async () => {
    setNavigatorClipboard({ writeText: vi.fn(async () => Promise.reject(new Error("NotAllowedError"))) });
    sdkCopy.mockRejectedValueOnce(new Error("no bridge"));
    await expect(copyText("1")).resolves.toBe("failed");
  });

  it("navigator.clipboard가 없어도 'failed'이고 throw하지 않는다", async () => {
    sdkCopy.mockRejectedValueOnce(new Error("no bridge"));
    await expect(copyText("1")).resolves.toBe("failed");
    sdkCopy.mockImplementationOnce(() => {
      throw new Error("sync throw");
    });
    await expect(copyText("1")).resolves.toBe("failed");
  });
});
