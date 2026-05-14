import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";

import { errorResponse } from "./response";
import { getClientIp } from "./request";

/**
 * Builds the rate-limit key for an incoming request.
 *
 * Authenticated requests are limited by Clerk user ID. Public or otherwise
 * unauthenticated requests fall back to the client IP.
 *
 * @param request - The incoming Next.js request.
 * @param userId - Clerk user ID for authenticated requests.
 * @returns The identity key used by the rate limiter.
 */
export function getRateLimitKey(request: NextRequest, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  return `ip:${getClientIp(request)}`;
}

/**
 * Checks the rate limit for an incoming request.
 *
 * Returns a 429 `NextResponse` when the limit is exceeded, or `null` when
 * the request is allowed to proceed. Fails open (returns `null`) when the
 * Upstash backend is unavailable, so API routes remain accessible during
 * transient outages.
 *
 * @param request - The incoming Next.js request.
 * @param userId - Clerk user ID for authenticated requests.
 * @returns A 429 response if rate-limited, or `null` if the request may proceed.
 */
export async function rateLimitGate(
  request: NextRequest,
  userId?: string | null,
): Promise<NextResponse | null> {
  const key = getRateLimitKey(request, userId);
  try {
    const { allowed, retryAfter } = await checkRateLimit(key);
    if (!allowed) {
      return errorResponse(
        "Too many requests. Please wait before trying again.",
        429,
        { retryAfter },
      );
    }
  } catch {
    // Fail open when the rate-limit backend is unavailable.
    // TODO: Add fail logic here when decided
  }
  return null;
}
