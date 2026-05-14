import { NextResponse } from "next/server";
import { describe, expect, it, vi, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import { requireAuth } from "./auth-gate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates the minimal Clerk auth result needed by auth-gate tests.
 *
 * @param userId - The user ID to include in the mock result.
 * @returns A mock Clerk auth result.
 */
const makeAuthResult = (
  userId: string | null,
): Awaited<ReturnType<typeof auth>> => {
  return { userId } as Awaited<ReturnType<typeof auth>>;
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requireAuth", () => {
  it("returns the userId when a Clerk session is present", async () => {
    vi.mocked(auth).mockResolvedValueOnce(makeAuthResult("user_abc"));

    const result = await requireAuth();

    expect(result).toEqual({ userId: "user_abc" });
  });

  it("returns a 401 NextResponse when no Clerk session is present", async () => {
    vi.mocked(auth).mockResolvedValueOnce(makeAuthResult(null));

    const result = await requireAuth();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("includes an error field in the 401 response body", async () => {
    vi.mocked(auth).mockResolvedValueOnce(makeAuthResult(null));

    const result = await requireAuth();
    const body = await (result as NextResponse).json();

    expect(body.error).toBeDefined();
  });
});
