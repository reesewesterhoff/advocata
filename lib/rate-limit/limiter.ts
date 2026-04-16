import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/** Number of allowed requests per window per IP. */
const REQUESTS_PER_WINDOW = 30;

/** Sliding-window duration. */
const WINDOW = "10 m" as const;

/** Redis key prefix used to namespace all rate-limit entries. */
const KEY_PREFIX = "advocata:ratelimit";

/**
 * Result of a rate-limit check for a single IP address.
 */
export interface RateLimitResult {
  /** Whether the request is permitted under the current rate-limit policy. */
  readonly allowed: boolean;
  /**
   * Number of seconds until the client may retry.
   * Present only when `allowed` is false.
   */
  readonly retryAfter: number | null;
}

/**
 * Lazily-initialized Upstash rate limiter.
 * Constructed on first use to avoid startup failures in environments where
 * the Redis environment variables are not required (e.g. unit tests).
 */
let ratelimit: Ratelimit | null = null;

/**
 * Returns the shared Ratelimit instance, creating it on first call.
 * Requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to be set.
 *
 * @returns The shared Ratelimit instance.
 */
function getRatelimit(): Ratelimit {
  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(REQUESTS_PER_WINDOW, WINDOW),
      analytics: false,
      prefix: KEY_PREFIX,
    });
  }
  return ratelimit;
}

/**
 * Checks whether the given IP address is within the allowed request rate.
 * Uses a sliding-window policy of {@link REQUESTS_PER_WINDOW} requests per
 * {@link WINDOW} per IP.
 *
 * @param ip - The client IP address to check.
 * @returns A RateLimitResult indicating whether the request is permitted.
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const limiter = getRatelimit();
  const { success, reset } = await limiter.limit(ip);
  const retryAfterSeconds = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return {
    allowed: success,
    retryAfter: success ? null : retryAfterSeconds,
  };
}

/**
 * Resets the shared Ratelimit instance.
 * Intended for use in tests only — allows injecting a fresh instance between
 * test cases without module re-evaluation.
 *
 * @internal
 */
export function _resetRatelimitInstance(): void {
  ratelimit = null;
}
