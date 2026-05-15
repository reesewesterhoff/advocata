import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { getRateLimitKey } from "./rate-limit-gate";

/**
 * Creates a request for rate-limit key tests.
 *
 * @param headers - Optional request headers.
 * @returns A NextRequest instance.
 */
const makeRequest = (headers: Record<string, string> = {}): NextRequest => {
  return new NextRequest("http://localhost/api/search", { headers });
};

describe("getRateLimitKey", () => {
  it("uses the Clerk user ID when present", () => {
    const key = getRateLimitKey(
      makeRequest({ "x-forwarded-for": "10.20.30.40" }),
      "user_123",
    );

    expect(key).toBe("user:user_123");
  });

  it("falls back to the forwarded client IP when no user ID is present", () => {
    const key = getRateLimitKey(
      makeRequest({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }),
      null,
    );

    expect(key).toBe("ip:1.1.1.1");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const key = getRateLimitKey(makeRequest({ "x-real-ip": "5.6.7.8" }));

    expect(key).toBe("ip:5.6.7.8");
  });

  it("uses an unknown IP sentinel when no identity is available", () => {
    const key = getRateLimitKey(makeRequest());

    expect(key).toBe("ip:unknown");
  });
});
