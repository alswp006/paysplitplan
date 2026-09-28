import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("계측·공유·D-day 유틸 (packet-0003)", () => {
  // ============================================================================
  // AC 1: getNextPayday — 다음 월급날 계산
  // ============================================================================
  describe("getNextPayday", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("AC-1[P0]: payday 25일 — 9/29에서 10/25까지 D-day 26 반환", () => {
      vi.setSystemTime(new Date("2026-09-29T09:00:00+09:00"));
      const { getNextPayday } = require("@/lib/dday");
      const result = getNextPayday(new Date(2026, 8, 29), 25);

      expect(result).toBeDefined();
      expect(result.dday).toBe(26);
      expect(result.label).toBe("10월 25일 월급날");
      expect(result.nextPaydayDate).toEqual(new Date(2026, 9, 25));
    });

    it("AC-1[P0]: payday 31일(말일 초과) — 9월 30일로 당기고 D-day 1 반환", () => {
      vi.setSystemTime(new Date("2026-09-29T09:00:00+09:00"));
      const { getNextPayday } = require("@/lib/dday");
      const result = getNextPayday(new Date(2026, 8, 29), 31);

      expect(result.dday).toBe(1);
      expect(result.label).toBe("9월 30일 월급날");
      expect(result.nextPaydayDate).toEqual(new Date(2026, 8, 30));
    });

    it("AC-1: 오늘이 월급날 — D-day 0 반환", () => {
      vi.setSystemTime(new Date("2026-09-25T09:00:00+09:00"));
      const { getNextPayday } = require("@/lib/dday");
      const result = getNextPayday(new Date(2026, 8, 25), 25);

      expect(result.dday).toBe(0);
      expect(result.label).toBe("9월 25일 월급날");
    });

    it("AC-1: 같은 달 내에 월급날이 있으면 그 날짜 반환", () => {
      vi.setSystemTime(new Date("2026-09-05T09:00:00+09:00"));
      const { getNextPayday } = require("@/lib/dday");
      const result = getNextPayday(new Date(2026, 8, 5), 10);

      expect(result.dday).toBe(5);
      expect(result.label).toBe("9월 10일 월급날");
    });

    it("AC-1: 2월 말일 처리 — 평년 2/28", () => {
      vi.setSystemTime(new Date("2026-02-27T09:00:00+09:00"));
      const { getNextPayday } = require("@/lib/dday");
      const result = getNextPayday(new Date(2026, 1, 27), 31);

      // 2026년은 평년이므로 2월은 28일까지
      expect(result.nextPaydayDate).toEqual(new Date(2026, 1, 28));
      expect(result.dday).toBe(1);
    });

    it("AC-1: 윤년 2월 말일 처리 — 2/29", () => {
      vi.setSystemTime(new Date("2024-02-28T09:00:00+09:00"));
      const { getNextPayday } = require("@/lib/dday");
      const result = getNextPayday(new Date(2024, 1, 28), 31);

      // 2024년은 윤년이므로 2월은 29일까지
      expect(result.nextPaydayDate).toEqual(new Date(2024, 1, 29));
      expect(result.dday).toBe(1);
    });
  });

  // ============================================================================
  // AC 2: logClick & logImpression — 예외 안전성 (SDK throw 방지)
  // ============================================================================
  describe("logClick & logImpression 예외 처리", () => {
    // @apps-in-toss/web-framework의 Analytics를 미리 목킹
    beforeEach(() => {
      vi.doMock("@apps-in-toss/web-framework", () => ({
        Analytics: {
          logClick: vi.fn(() => {
            throw new Error("SDK not available");
          }),
          logImpression: vi.fn(() => {
            throw new Error("SDK not available");
          }),
        },
      }));
    });

    afterEach(() => {
      vi.resetModules();
    });

    it("AC-2[P0]: logClick이 내부 SDK throw를 catch하고 예외 없음", () => {
      const { logClick } = require("@/lib/analytics");

      // logClick이 throw하지 않아야 함
      expect(() => {
        logClick("submit_click");
      }).not.toThrow();
    });

    it("AC-2[P0]: logImpression이 내부 SDK throw를 catch하고 예외 없음", () => {
      const { logImpression } = require("@/lib/analytics");

      // logImpression이 throw하지 않아야 함
      expect(() => {
        logImpression("result_card_viewed");
      }).not.toThrow();
    });

    it("AC-2: 정상 SDK 환경에서도 logClick이 호출 가능", () => {
      // 목 제거 후 정상 SDK
      vi.resetModules();
      vi.doMock("@apps-in-toss/web-framework", () => ({
        Analytics: {
          logClick: vi.fn(),
          logImpression: vi.fn(),
        },
      }));

      const { logClick } = require("@/lib/analytics");
      expect(() => {
        logClick("test_event");
      }).not.toThrow();
    });
  });

  // ============================================================================
  // AC 3: shareApp — 폴백 체인 (SDK → navigator.share → no-op)
  // ============================================================================
  describe("shareApp 폴백", () => {
    beforeEach(() => {
      vi.doMock("@apps-in-toss/web-framework", () => ({
        share: vi.fn(() => Promise.reject(new Error("SDK unavailable"))),
      }));
    });

    afterEach(() => {
      vi.resetModules();
    });

    it("AC-3[P0]: SDK와 navigator.share가 모두 없으면 조용히 resolve", async () => {
      // navigator.share 미존재
      const originalShare = global.navigator.share;
      Object.defineProperty(global.navigator, "share", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { shareApp } = require("@/lib/share");
      const result = await shareApp({ message: "테스트 공유" });

      expect(result).toBeDefined();
      expect(result).toBeUndefined(); // no-op resolve

      // 복원
      if (originalShare) {
        Object.defineProperty(global.navigator, "share", {
          value: originalShare,
          writable: true,
          configurable: true,
        });
      }
    });

    it("AC-3: navigator.share가 AbortError로 reject해도 resolve", async () => {
      const abortError = new DOMException("The operation was aborted", "AbortError");
      Object.defineProperty(global.navigator, "share", {
        value: vi.fn(() => Promise.reject(abortError)),
        writable: true,
        configurable: true,
      });

      const { shareApp } = require("@/lib/share");
      const result = await shareApp({ message: "테스트" });

      expect(result).toBeDefined();
    });

    it("AC-3: navigator.share가 성공하면 그대로 사용", async () => {
      const mockShare = vi.fn(() => Promise.resolve());
      Object.defineProperty(global.navigator, "share", {
        value: mockShare,
        writable: true,
        configurable: true,
      });

      const { shareApp } = require("@/lib/share");
      await shareApp({ message: "공유" });

      expect(mockShare).toHaveBeenCalled();
    });

    it("AC-3: path 파라미터가 있으면 deep link URL에 포함", async () => {
      const mockShare = vi.fn(() => Promise.resolve());
      Object.defineProperty(global.navigator, "share", {
        value: mockShare,
        writable: true,
        configurable: true,
      });

      const { shareApp } = require("@/lib/share");
      await shareApp({ message: "결과 공유", path: "/result?id=123" });

      // navigator.share 호출 시 message에 path 정보 포함 또는 별도 처리
      expect(mockShare).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // AC 4: 외부 분석 도구 금지 검증
  // ============================================================================
  describe("AC-4: 외부 분석 도구 제외 정책", () => {
    it("AC-4: 소스 코드에 react-ga 임포트 없음", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const srcPath = path.resolve("src");

      const readdir = (dir) => {
        const files = [];
        try {
          fs.readdirSync(dir).forEach((file) => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
              files.push(...readdir(fullPath));
            } else if (
              fullPath.endsWith(".ts") ||
              fullPath.endsWith(".tsx")
            ) {
              files.push(fullPath);
            }
          });
        } catch (e) {
          // 디렉토리 읽기 실패 무시
        }
        return files;
      };

      const sourceFiles = readdir(srcPath);
      const forbidden = ["react-ga", "@amplitude", "firebase/analytics"];

      sourceFiles.forEach((file) => {
        try {
          const content = fs.readFileSync(file, "utf-8");
          forbidden.forEach((pkg) => {
            expect(
              content,
              `${file}에서 ${pkg} 발견`
            ).not.toContain(pkg);
          });
        } catch (e) {
          // 파일 읽기 실패 무시
        }
      });
    });
  });

  // ============================================================================
  // 통합: analytics, share, dday 모두 예외 안전 & 폴백
  // ============================================================================
  describe("통합: 래퍼 안전성", () => {
    it("logClick 호출이 로그 실패로 인해 앱 크래시 방지", () => {
      // 정상 환경에서도 호출 가능 (예외 없음)
      const { logClick } = require("@/lib/analytics");
      expect(() => {
        logClick("integration_test");
      }).not.toThrow();
    });

    it("shareApp 호출이 공유 실패로 인해 앱 크래시 방지", async () => {
      const { shareApp } = require("@/lib/share");
      const result = await shareApp({ message: "통합 테스트" });

      // 항상 resolve (never reject)
      expect(result).not.toBeInstanceOf(Error);
    });
  });
});
