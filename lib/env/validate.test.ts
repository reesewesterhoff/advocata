import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnv, validateEnv } from "./validate";

const REQUIRED_VARS = {
  LEGISCAN_API_KEY: "test-legiscan-key",
  UPSTASH_REDIS_REST_URL: "https://redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "test-redis-token",
};

beforeEach(() => {
  for (const [key, value] of Object.entries(REQUIRED_VARS)) {
    vi.stubEnv(key, value);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// validateEnv
// ---------------------------------------------------------------------------

describe("validateEnv", () => {
  it("does not throw when all required variables are present", () => {
    expect(() => validateEnv()).not.toThrow();
  });

  it("throws when LEGISCAN_API_KEY is missing", () => {
    vi.stubEnv("LEGISCAN_API_KEY", "");
    expect(() => validateEnv()).toThrow(/LEGISCAN_API_KEY/);
  });

  it("throws when UPSTASH_REDIS_REST_URL is missing", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    expect(() => validateEnv()).toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  it("throws when UPSTASH_REDIS_REST_TOKEN is missing", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(() => validateEnv()).toThrow(/UPSTASH_REDIS_REST_TOKEN/);
  });

  it("lists all missing variables in the error message", () => {
    vi.stubEnv("LEGISCAN_API_KEY", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");

    expect(() => validateEnv()).toThrow(
      /LEGISCAN_API_KEY.*UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_URL.*LEGISCAN_API_KEY/,
    );
  });

  it("includes a reference to .env.example in the error message", () => {
    vi.stubEnv("LEGISCAN_API_KEY", "");
    expect(() => validateEnv()).toThrow(/.env.example/);
  });
});

// ---------------------------------------------------------------------------
// getEnv
// ---------------------------------------------------------------------------

describe("getEnv", () => {
  it("returns all required env vars as a typed object when all are set", () => {
    const env = getEnv();
    expect(env.LEGISCAN_API_KEY).toBe("test-legiscan-key");
    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://redis.example.com");
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBe("test-redis-token");
  });

  it("throws when a required variable is missing", () => {
    vi.stubEnv("LEGISCAN_API_KEY", "");
    expect(() => getEnv()).toThrow(/LEGISCAN_API_KEY/);
  });
});
