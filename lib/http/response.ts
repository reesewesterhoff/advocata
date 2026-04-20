import { NextResponse } from "next/server";

/**
 * Builds a standardized JSON error response.
 *
 * All API error responses share a common shape: an `error` string field
 * containing a human-readable message, plus any optional metadata fields
 * (e.g. `retryAfter` on 429, `details` on 422, `code` on AI errors).
 *
 * @param message - Human-readable error message.
 * @param status - HTTP status code.
 * @param extra - Optional additional fields merged into the response body.
 * @returns A NextResponse carrying the JSON error payload.
 */
export function errorResponse(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}
