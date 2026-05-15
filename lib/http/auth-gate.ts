import { auth } from "@clerk/nextjs/server";
import type { NextResponse } from "next/server";

import { errorResponse } from "./response";

/**
 * Result of a successful {@link requireAuth} check.
 */
export interface AuthResult {
  /** The authenticated Clerk user ID. */
  readonly userId: string;
}

/**
 * Verifies that the current request has a valid Clerk session.
 *
 * Returns an {@link AuthResult} when the session is valid, or a 401
 * `NextResponse` when no authenticated user is present. The in-route check
 * provides defense-in-depth alongside the `proxy.ts` middleware and also
 * narrows `userId` from `string | null` to `string` for downstream use
 * (e.g. passing a non-null value to `rateLimitGate`).
 *
 * @returns An `AuthResult` with the authenticated user ID, or a 401 response.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse("Authentication is required.", 401);
  }
  return { userId };
}
