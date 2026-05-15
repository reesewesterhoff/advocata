import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedBill } from "@/lib/domain";
import { LEGISCAN_ERROR_CODES, LegiScanError } from "@/lib/legiscan";
import { POST } from "./route";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

// Use importOriginal to avoid the Vitest TDZ hoisting issue: vi.mock factories
// are hoisted before import statements, so referencing imported values (e.g.
// LegiScanError, LEGISCAN_ERROR_CODES) directly inside the factory causes a
// ReferenceError. Spreading the real module and overriding only what needs
// mocking gives the factory access to the actual exports at call time.
vi.mock("@/lib/legiscan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/legiscan")>();
  return {
    ...actual,
    searchAndNormalize: vi.fn(),
  };
});

import { checkRateLimit } from "@/lib/rate-limit";
import { searchAndNormalize } from "@/lib/legiscan";
import { auth } from "@clerk/nextjs/server";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeNormalizedBill = (billId: number): NormalizedBill => ({
  billId,
  billNumber: `HB ${billId}`,
  title: `Bill ${billId}`,
  description: `Description for bill ${billId}.`,
  status: 1,
  statusDate: "2024-01-15",
  url: `https://legiscan.com/CA/bill/HB${billId}/2024`,
  textUrl: null,
  state: "CA",
});

const VALID_BODY = {
  state: "CA",
  query: "education reform",
};

/**
 * Creates the minimal Clerk auth result needed by route tests.
 */
const makeAuthResult = (
  userId: string | null,
): Awaited<ReturnType<typeof auth>> => {
  return { userId } as Awaited<ReturnType<typeof auth>>;
};

/**
 * Creates a NextRequest for the /api/search endpoint.
 */
function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("http://localhost/api/search", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "1.2.3.4",
      ...headers,
    },
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(makeAuthResult("user_123"));
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfter: null });
  vi.mocked(searchAndNormalize).mockResolvedValue([makeNormalizedBill(1)]);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe("POST /api/search — authentication", () => {
  it("returns 401 when no Clerk user is authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(makeAuthResult(null));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBeDefined();
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(searchAndNormalize).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("POST /api/search — rate limiting", () => {
  it("returns 429 with retryAfter when the rate limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, retryAfter: 42 });

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBeDefined();
    expect(body.retryAfter).toBe(42);
  });

  it("passes the authenticated user key to checkRateLimit", async () => {
    await POST(makeRequest(VALID_BODY, { "x-forwarded-for": "10.20.30.40" }));

    expect(checkRateLimit).toHaveBeenCalledWith("user:user_123");
  });

  it("fails open when rate limiting backend is unavailable", async () => {
    vi.mocked(checkRateLimit).mockRejectedValueOnce(new Error("Upstash unavailable"));

    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(200);
    expect(searchAndNormalize).toHaveBeenCalledWith("CA", "education reform");
  });
});

// ---------------------------------------------------------------------------
// Request body validation
// ---------------------------------------------------------------------------

describe("POST /api/search — request validation", () => {
  it("returns 400 when the body is not valid JSON", async () => {
    const req = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: "not json at all",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 422 when required fields are missing", async () => {
    const response = await POST(makeRequest({ state: "CA" }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBeDefined();
    expect(body.details).toBeDefined();
  });

  it("returns 422 when the state is not a valid LegiScan state option", async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, state: "XX" }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.details).toHaveProperty("state");
  });

  it("returns 422 when the query exceeds the maximum length", async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, query: "a".repeat(501) }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.details).toHaveProperty("query");
  });

  it("ignores AI-only fields in /api/search payload validation", async () => {
    const response = await POST(
      makeRequest({
        ...VALID_BODY,
        aiProvider: "gemini",
        aiModel: "gemini-2.5-flash",
        aiKey: "my-api-key",
        userContext: "I am a policy analyst focused on K-12 education.",
      }),
    );

    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Successful response
// ---------------------------------------------------------------------------

describe("POST /api/search — success", () => {
  it("returns 200 with normalized bills", async () => {
    const bills = [makeNormalizedBill(1), makeNormalizedBill(2)];
    vi.mocked(searchAndNormalize).mockResolvedValueOnce(bills);

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.bills).toHaveLength(2);
    expect(body.bills[0].billId).toBe(1);
    expect(body.bills[1].billId).toBe(2);
  });

  it("calls searchAndNormalize with the state and query from the request", async () => {
    await POST(makeRequest({ ...VALID_BODY, state: "TX", query: "renewable energy" }));

    expect(searchAndNormalize).toHaveBeenCalledWith("TX", "renewable energy");
  });

  it("returns an empty bills array when LegiScan returns no results", async () => {
    vi.mocked(searchAndNormalize).mockResolvedValueOnce([]);

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.bills).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// LegiScan error handling
// ---------------------------------------------------------------------------

describe("POST /api/search — LegiScan error handling", () => {
  it("returns 504 on a LegiScan timeout error", async () => {
    vi.mocked(searchAndNormalize).mockRejectedValueOnce(
      new LegiScanError(LEGISCAN_ERROR_CODES.TIMEOUT, "Timed out."),
    );

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.error).toBeDefined();
  });

  it("returns 502 on a LegiScan network error", async () => {
    vi.mocked(searchAndNormalize).mockRejectedValueOnce(
      new LegiScanError(LEGISCAN_ERROR_CODES.NETWORK_ERROR, "Network error."),
    );

    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(502);
  });

  it("returns 502 on a LegiScan API error", async () => {
    vi.mocked(searchAndNormalize).mockRejectedValueOnce(
      new LegiScanError(LEGISCAN_ERROR_CODES.API_ERROR, "API error."),
    );

    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(502);
  });

  it("returns 502 on a LegiScan invalid response error", async () => {
    vi.mocked(searchAndNormalize).mockRejectedValueOnce(
      new LegiScanError(LEGISCAN_ERROR_CODES.INVALID_RESPONSE, "Bad response."),
    );

    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(502);
  });

  it("returns 500 on an unexpected non-LegiScan error", async () => {
    vi.mocked(searchAndNormalize).mockRejectedValueOnce(new Error("Unexpected error."));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBeDefined();
  });
});
