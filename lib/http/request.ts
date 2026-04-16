import type { NextRequest } from "next/server";

/**
 * Extracts the best-effort client IP from the incoming request headers.
 *
 * Prefers the `x-forwarded-for` header (set by proxies and AWS App Runner),
 * then falls back to `x-real-ip`, and finally to a sentinel value when
 * neither is present (e.g. local development without a proxy).
 *
 * When `x-forwarded-for` contains a comma-separated chain of addresses, only
 * the first (the original client) is returned.
 *
 * @param request - The incoming Next.js request.
 * @returns The client IP string to use as the rate-limit key.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
