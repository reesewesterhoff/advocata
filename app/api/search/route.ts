import { type NextRequest, NextResponse } from "next/server";

import { SearchRequestSchema } from "@/lib/domain/search";
import { errorResponse, rateLimitGate } from "@/lib/http";
import {
  LegiScanError,
  LEGISCAN_ERROR_CODES,
  searchAndNormalize,
} from "@/lib/legiscan";

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
  const rateLimitResponse = await rateLimitGate(request);
  if (rateLimitResponse) return rateLimitResponse;

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
    return errorResponse(
      "An unexpected error occurred. Please try again.",
      500,
    );
  }
}
