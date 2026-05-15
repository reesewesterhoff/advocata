import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, isProtectedRoute } from "./proxy";

/**
 * Creates a request for proxy matcher tests.
 *
 * @param pathname - Pathname to test.
 * @returns A NextRequest instance.
 */
const makeRequest = (pathname: string): NextRequest => {
  return new NextRequest(`http://localhost${pathname}`);
};

describe("proxy route protection", () => {
  it("protects the application search route", () => {
    expect(isProtectedRoute(makeRequest("/search"))).toBe(true);
    expect(isProtectedRoute(makeRequest("/search/advanced"))).toBe(true);
  });

  it("protects product API routes", () => {
    expect(isProtectedRoute(makeRequest("/api/search"))).toBe(true);
    expect(isProtectedRoute(makeRequest("/api/analyze"))).toBe(true);
  });

  it("leaves marketing, Clerk auth, and health routes public", () => {
    expect(isProtectedRoute(makeRequest("/"))).toBe(false);
    expect(isProtectedRoute(makeRequest("/sign-in"))).toBe(false);
    expect(isProtectedRoute(makeRequest("/sign-up"))).toBe(false);
    expect(isProtectedRoute(makeRequest("/api/health"))).toBe(false);
  });

  it("runs the proxy for application, API, and Clerk frontend API routes", () => {
    expect(config.matcher).toEqual([
      "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
      "/(api|trpc)(.*)",
      "/__clerk/(.*)",
    ]);
  });
});
