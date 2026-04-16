import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";

import { errorResponse } from "./response";
import { getClientIp } from "./request";

/**
 * Checks the per-IP rate limit for an incoming request.
 *
 * Returns a 429 `NextResponse` when the limit is exceeded, or `null` when
 * the request is allowed to proceed. Fails open (returns `null`) when the
 * Upstash backend is unavailable, so API routes remain accessible during
 * transient outages.
 *
 * @param request - The incoming Next.js request.
 * @returns A 429 response if rate-limited, or `null` if the request may proceed.
 */
export async function rateLimitGate(
  request: NextRequest,
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  try {
    const { allowed, retryAfter } = await checkRateLimit(ip);
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
