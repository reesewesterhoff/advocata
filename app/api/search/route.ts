import { type NextRequest, NextResponse } from "next/server";

import { SearchRequestSchema } from "@/lib/domain/search";
import { LegiScanError, LEGISCAN_ERROR_CODES, searchAndNormalize } from "@/lib/legiscan";
import { checkRateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the best-effort client IP from the incoming request headers.
 * Prefers the `x-forwarded-for` header (set by proxies / App Runner), then
 * falls back to `x-real-ip`, and finally to a sentinel value when neither is
 * present (e.g. local development without a proxy).
 *
 * @param request - The incoming Next.js request.
 * @returns The client IP string to use as the rate-limit key.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Builds a standardized JSON error response.
 *
 * @param message - Human-readable error message.
 * @param status - HTTP status code.
 * @param extra - Optional additional fields merged into the response body.
 * @returns A NextResponse carrying the JSON error payload.
 */
function errorResponse(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

// ---------------------------------------------------------------------------
// POST /api/search
// ---------------------------------------------------------------------------

/**
 * Handles POST requests to `/api/search`.
 *
 * Request body (JSON): Fields matching `SearchRequestSchema`.
 * Successful response body: `{ bills: NormalizedBill[] }`.
 *
 * Error response bodies all carry an `error` string field plus optional
 * metadata (e.g. `retryAfter` on 429, `details` on 422).
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with normalized bills or a structured error.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // --- Rate limiting ---
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
    // Fail open when the rate-limit backend is unavailable so search remains
    // accessible during transient Upstash outages.
  }

  // --- Parse + validate request body ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const parseResult = SearchRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("Invalid request parameters.", 422, {
      details: parseResult.error.flatten((issue) => issue.message).fieldErrors,
    });
  }

  const { state, query } = parseResult.data;

  // --- LegiScan search + normalization ---
  try {
    const bills = await searchAndNormalize(state, query);
    return NextResponse.json({ bills });
  } catch (err) {
    if (err instanceof LegiScanError) {
      if (err.code === LEGISCAN_ERROR_CODES.TIMEOUT) {
        return errorResponse(
          "The LegiScan API did not respond in time. Please try again.",
          504,
        );
      }
      if (err.code === LEGISCAN_ERROR_CODES.NETWORK_ERROR) {
        return errorResponse(
          "A network error occurred while contacting LegiScan. Please try again.",
          502,
        );
      }
      return errorResponse(
        "LegiScan returned an unexpected error. Please try again.",
        502,
      );
    }
    return errorResponse("An unexpected error occurred. Please try again.", 500);
  }
}
