import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "./logger";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("error", () => {
    it("delegates to console.error with the [ERROR] prefix", () => {
      logger.error("something broke");
      expect(console.error).toHaveBeenCalledWith("[ERROR]", "something broke");
    });

    it("includes safe context fields", () => {
      logger.error("something broke", { provider: "gemini", code: "AI_ADAPTER_NETWORK_ERROR" });
      expect(console.error).toHaveBeenCalledWith(
        "[ERROR]",
        "something broke",
        { provider: "gemini", code: "AI_ADAPTER_NETWORK_ERROR" },
      );
    });

    it("redacts sensitive keys in context", () => {
      logger.error("auth failure", { provider: "claude", apiKey: "sk-real-key", token: "bearer-abc" });
      expect(console.error).toHaveBeenCalledWith(
        "[ERROR]",
        "auth failure",
        { provider: "claude", apiKey: "[REDACTED]", token: "[REDACTED]" },
      );
    });

    it("omits the third argument when no context is provided", () => {
      logger.error("bare error");
      const call = vi.mocked(console.error).mock.calls[0];
      expect(call).toHaveLength(2);
    });
  });

  describe("warn", () => {
    it("delegates to console.warn with the [WARN] prefix", () => {
      logger.warn("rate limited");
      expect(console.warn).toHaveBeenCalledWith("[WARN]", "rate limited");
    });

    it("includes safe context fields", () => {
      logger.warn("service unavailable", { provider: "gemini", model: "gemini-2.0-flash" });
      expect(console.warn).toHaveBeenCalledWith(
        "[WARN]",
        "service unavailable",
        { provider: "gemini", model: "gemini-2.0-flash" },
      );
    });

    it("redacts sensitive keys in context", () => {
      logger.warn("invalid key", { aiKey: "secret-key", password: "hunter2" });
      expect(console.warn).toHaveBeenCalledWith(
        "[WARN]",
        "invalid key",
        { aiKey: "[REDACTED]", password: "[REDACTED]" },
      );
    });

    it("omits the third argument when no context is provided", () => {
      logger.warn("bare warning");
      const call = vi.mocked(console.warn).mock.calls[0];
      expect(call).toHaveLength(2);
    });
  });

  describe("redaction", () => {
    it("leaves non-sensitive keys untouched", () => {
      logger.error("test", { provider: "gemini", model: "gemini-flash", code: "ERR_001" });
      expect(console.error).toHaveBeenCalledWith(
        "[ERROR]",
        "test",
        { provider: "gemini", model: "gemini-flash", code: "ERR_001" },
      );
    });

    it("does not mutate the original context object", () => {
      const ctx = { provider: "gemini", apiKey: "real-key" };
      logger.error("test", ctx);
      expect(ctx.apiKey).toBe("real-key");
    });

    it("redacts all registered sensitive key names", () => {
      const sensitiveContext = {
        apiKey: "v1",
        aiKey: "v2",
        key: "v3",
        token: "v4",
        secret: "v5",
        password: "v6",
        authorization: "v7",
      };
      logger.error("test", sensitiveContext);
      expect(console.error).toHaveBeenCalledWith("[ERROR]", "test", {
        apiKey: "[REDACTED]",
        aiKey: "[REDACTED]",
        key: "[REDACTED]",
        token: "[REDACTED]",
        secret: "[REDACTED]",
        password: "[REDACTED]",
        authorization: "[REDACTED]",
      });
    });
  });
});
