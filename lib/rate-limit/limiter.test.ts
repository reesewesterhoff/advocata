import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@upstash/ratelimit", () => {
  const mockLimit = vi.fn();
  const MockRatelimit = vi
    .fn()
    .mockImplementation(() => ({ limit: mockLimit }));
  (MockRatelimit as unknown as Record<string, unknown>).slidingWindow = vi
    .fn()
    .mockReturnValue("sliding-window-config");
  return { Ratelimit: MockRatelimit };
});

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: vi.fn().mockReturnValue({ mock: "redis" }) },
}));

import { Ratelimit } from "@upstash/ratelimit";
import { checkRateLimit, _resetRatelimitInstance } from "./limiter";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  _resetRatelimitInstance();
  vi.clearAllMocks();
});

afterEach(() => {
  _resetRatelimitInstance();
});

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

describe("checkRateLimit", () => {
  it("returns { allowed: true, retryAfter: null } when the limit is not exceeded", async () => {
    vi.mocked(Ratelimit).mockImplementationOnce(
      () =>
        ({
          limit: vi
            .fn()
            .mockResolvedValue({ success: true, reset: Date.now() + 60_000 }),
        }) as unknown as unknown as Ratelimit,
    );

    const result = await checkRateLimit("127.0.0.1");

    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeNull();
  });

  it("returns { allowed: false, retryAfter: <positive number> } when the limit is exceeded", async () => {
    const resetAt = Date.now() + 30_000;
    vi.mocked(Ratelimit).mockImplementationOnce(
      () =>
        ({
          limit: vi.fn().mockResolvedValue({ success: false, reset: resetAt }),
        }) as unknown as unknown as Ratelimit,
    );

    const result = await checkRateLimit("10.0.0.1");

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("computes retryAfter as the ceiling of seconds until reset", async () => {
    const now = Date.now();
    const resetAt = now + 45_500;
    vi.mocked(Ratelimit).mockImplementationOnce(
      () =>
        ({
          limit: vi.fn().mockResolvedValue({ success: false, reset: resetAt }),
        }) as unknown as unknown as Ratelimit,
    );

    const result = await checkRateLimit("10.0.0.2");

    expect(result.retryAfter).toBe(46);
  });

  it("clamps retryAfter to 0 when reset is in the past", async () => {
    const resetAt = Date.now() - 1_000;
    vi.mocked(Ratelimit).mockImplementationOnce(
      () =>
        ({
          limit: vi.fn().mockResolvedValue({ success: false, reset: resetAt }),
        }) as unknown as unknown as Ratelimit,
    );

    const result = await checkRateLimit("10.0.0.3");

    expect(result.retryAfter).toBe(0);
  });

  it("passes the IP address to the underlying rate limiter", async () => {
    const mockLimit = vi
      .fn()
      .mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
    vi.mocked(Ratelimit).mockImplementationOnce(
      () =>
        ({
          limit: mockLimit,
        }) as unknown as unknown as Ratelimit,
    );

    await checkRateLimit("192.168.1.1");

    expect(mockLimit).toHaveBeenCalledWith("192.168.1.1");
  });

  it("reuses the same Ratelimit instance across multiple calls", async () => {
    const mockLimit = vi
      .fn()
      .mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
    vi.mocked(Ratelimit).mockImplementation(
      () =>
        ({
          limit: mockLimit,
        }) as unknown as unknown as Ratelimit,
    );

    await checkRateLimit("1.1.1.1");
    await checkRateLimit("2.2.2.2");

    expect(vi.mocked(Ratelimit)).toHaveBeenCalledTimes(1);
  });

  it("creates a fresh Ratelimit instance after _resetRatelimitInstance is called", async () => {
    const mockLimit = vi
      .fn()
      .mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
    vi.mocked(Ratelimit).mockImplementation(
      () =>
        ({
          limit: mockLimit,
        }) as unknown as unknown as Ratelimit,
    );

    await checkRateLimit("1.1.1.1");
    _resetRatelimitInstance();
    await checkRateLimit("2.2.2.2");

    expect(vi.mocked(Ratelimit)).toHaveBeenCalledTimes(2);
  });

  it("configures the limiter with the sliding-window preset", async () => {
    vi.mocked(Ratelimit).mockImplementationOnce(
      () =>
        ({
          limit: vi
            .fn()
            .mockResolvedValue({ success: true, reset: Date.now() }),
        }) as unknown as unknown as Ratelimit,
    );

    await checkRateLimit("1.2.3.4");

    expect(Ratelimit.slidingWindow).toHaveBeenCalledWith(30, "10 m");
  });
});
