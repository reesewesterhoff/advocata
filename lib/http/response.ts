import { NextResponse } from "next/server";

/**
 * The JSON shape of every error response produced by `errorResponse`.
 * Clients use this type when parsing non-2xx fetch responses.
 */
export type ApiErrorResponse = {
  /** Human-readable error message. */
  readonly error?: string;
  /** Field-level validation errors, keyed by field name. Present on 422 responses. */
  readonly details?: Record<string, string[] | undefined>;
};

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
