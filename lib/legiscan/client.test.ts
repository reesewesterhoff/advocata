import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LegiScanBill, LegiScanSearchApiResponse } from "@/lib/domain";
import { getBill, getSearch, searchAndNormalize } from "./client";
import { LegiScanError, LEGISCAN_ERROR_CODES } from "./errors";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const API_KEY = "test-api-key";

const makeSearchRow = (billId: number, relevance: number) => ({
  relevance,
  state: "CA",
  bill_number: `HB ${billId}`,
  bill_id: billId,
  change_hash: `hash-${billId}`,
  url: `https://legiscan.com/CA/bill/HB${billId}/2024`,
  text_url: `https://legiscan.com/CA/text/HB${billId}/2024`,
  research_url: `https://legiscan.com/CA/research/HB${billId}/2024`,
  last_action_date: "2024-01-15",
  last_action: "Introduced",
  title: `Bill ${billId}`,
});

const makeSearchResponse = (rows: ReturnType<typeof makeSearchRow>[]): LegiScanSearchApiResponse => ({
  status: "OK",
  searchresult: {
    summary: {
      page: 1,
      range: `1-${rows.length}`,
      relevancy: 100,
      count: rows.length,
      page_current: 1,
      page_total: 1,
    },
    ...Object.fromEntries(rows.map((row, i) => [String(i), row])),
  },
});

const makeBill = (billId: number): LegiScanBill => ({
  bill_id: billId,
  change_hash: `hash-${billId}`,
  session_id: 1,
  url: `https://legiscan.com/CA/bill/HB${billId}/2024`,
  state_link: `https://leginfo.legislature.ca.gov/HB${billId}`,
  completed: 0,
  status: 1,
  status_date: "2024-01-15",
  state: "CA",
  state_id: 5,
  bill_number: `HB ${billId}`,
  bill_type: "B",
  bill_type_id: 1,
  body: "H",
  body_id: 1,
  current_body: "H",
  current_body_id: 1,
  title: `Bill ${billId} Title`,
  description: `Description for bill ${billId}.`,
  pending_committee_id: 0,
  session: {
    session_id: 1,
    state_id: 5,
    year_start: 2024,
    year_end: 2024,
    prefile: 0,
    sine_die: 0,
    prior: 0,
    special: 0,
    session_tag: "",
    session_title: "2024 Regular Session",
    session_name: "CA 2024",
  },
  committee: { committee_id: 0, chamber: "", chamber_id: 0, name: "" },
  progress: [],
  history: [],
  sponsors: [],
  texts: [],
  votes: [],
});

const makeBillResponse = (billId: number) => ({
  status: "OK",
  bill: makeBill(billId),
});

/**
 * Creates a mock Response with the given JSON body and status.
 */
const mockJsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubEnv("LEGISCAN_API_KEY", API_KEY);
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getSearch
// ---------------------------------------------------------------------------

describe("getSearch", () => {
  it("returns search rows from a successful response", async () => {
    const rows = [makeSearchRow(1, 90), makeSearchRow(2, 75)];
    vi.mocked(fetch).mockResolvedValueOnce(mockJsonResponse(makeSearchResponse(rows)));

    const result = await getSearch("CA", "education");

    expect(result).toHaveLength(2);
    expect(result[0].bill_id).toBe(1);
    expect(result[1].bill_id).toBe(2);
  });

  it("includes the API key, op, state, and query in the request URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse(makeSearchResponse([makeSearchRow(1, 90)])),
    );

    await getSearch("TX", "climate change");

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain(`key=${API_KEY}`);
    expect(calledUrl).toContain("op=getSearch");
    expect(calledUrl).toContain("state=TX");
    expect(calledUrl).toContain("query=climate+change");
  });

  it("throws LEGISCAN_API_ERROR when the response status is not OK", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ status: "ERROR" }),
    );

    await expect(getSearch("CA", "test")).rejects.toMatchObject({
      code: LEGISCAN_ERROR_CODES.API_ERROR,
    });
  });

  it("throws LEGISCAN_INVALID_RESPONSE when searchresult is missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ status: "OK" }),
    );

    await expect(getSearch("CA", "test")).rejects.toMatchObject({
      code: LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
    });
  });

  it("throws LEGISCAN_INVALID_RESPONSE when a search row has an invalid shape", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({
        status: "OK",
        searchresult: {
          summary: {
            page: 1,
            range: "1-1",
            relevancy: 100,
            count: 1,
            page_current: 1,
            page_total: 1,
          },
          "0": {
            relevance: 90,
            // Missing required bill_id and URL fields.
            state: "CA",
            bill_number: "HB 1",
            title: "Invalid Row",
          },
        },
      }),
    );

    await expect(getSearch("CA", "test")).rejects.toMatchObject({
      code: LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
    });
  });

  it("throws LEGISCAN_API_ERROR when LEGISCAN_API_KEY is not set", async () => {
    vi.unstubAllEnvs();

    await expect(getSearch("CA", "test")).rejects.toMatchObject({
      code: LEGISCAN_ERROR_CODES.API_ERROR,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws LEGISCAN_NETWORK_ERROR on HTTP 500 after retries", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(getSearch("CA", "test")).rejects.toMatchObject({
      code: LEGISCAN_ERROR_CODES.NETWORK_ERROR,
    });
  });

  it("throws LEGISCAN_API_ERROR immediately on HTTP 400 without retrying", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(mockJsonResponse(makeSearchResponse([])));

    await expect(getSearch("CA", "test")).rejects.toMatchObject({
      code: LEGISCAN_ERROR_CODES.API_ERROR,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws LEGISCAN_TIMEOUT when the request is aborted", async () => {
    vi.mocked(fetch).mockRejectedValue(
      Object.assign(new Error("The operation was aborted."), { name: "AbortError" }),
    );

    await expect(getSearch("CA", "test")).rejects.toMatchObject({
      code: LEGISCAN_ERROR_CODES.TIMEOUT,
    });
  });

  it("throws LEGISCAN_INVALID_RESPONSE when the response body is not valid JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("not-json", { status: 200 }),
    );

    await expect(getSearch("CA", "test")).rejects.toMatchObject({
      code: LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
    });
  });

  it("returns an empty array when searchresult contains only a summary", async () => {
    const emptyResponse: LegiScanSearchApiResponse = {
      status: "OK",
      searchresult: {
        summary: { page: 1, range: "", relevancy: 0, count: 0, page_current: 1, page_total: 0 },
      },
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockJsonResponse(emptyResponse));

    const result = await getSearch("CA", "nothing");
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getBill
// ---------------------------------------------------------------------------

describe("getBill", () => {
  it("returns the bill record from a successful response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJsonResponse(makeBillResponse(42)));

    const bill = await getBill(42);

    expect(bill.bill_id).toBe(42);
    expect(bill.title).toBe("Bill 42 Title");
  });

  it("includes the API key, op, and id in the request URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJsonResponse(makeBillResponse(99)));

    await getBill(99);

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain(`key=${API_KEY}`);
    expect(calledUrl).toContain("op=getBill");
    expect(calledUrl).toContain("id=99");
  });

  it("throws LEGISCAN_API_ERROR when the response status is not OK", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ status: "ERROR" }),
    );

    await expect(getBill(1)).rejects.toMatchObject({
      code: LEGISCAN_ERROR_CODES.API_ERROR,
    });
  });

  it("throws LEGISCAN_INVALID_RESPONSE when the bill field is missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ status: "OK" }),
    );

    await expect(getBill(1)).rejects.toMatchObject({
      code: LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
    });
  });

  it("throws LEGISCAN_INVALID_RESPONSE when bill fields used by normalization are invalid", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({
        status: "OK",
        bill: {
          ...makeBill(1),
          url: "not-a-url",
        },
      }),
    );

    await expect(getBill(1)).rejects.toMatchObject({
      code: LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
    });
  });

  it("throws LEGISCAN_API_ERROR when LEGISCAN_API_KEY is not set", async () => {
    vi.unstubAllEnvs();

    await expect(getBill(1)).rejects.toMatchObject({
      code: LEGISCAN_ERROR_CODES.API_ERROR,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws a LegiScanError instance", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ status: "ERROR" }),
    );

    await expect(getBill(1)).rejects.toBeInstanceOf(LegiScanError);
  });
});

// ---------------------------------------------------------------------------
// searchAndNormalize
// ---------------------------------------------------------------------------

describe("searchAndNormalize", () => {
  it("returns normalized bills sorted by relevance descending", async () => {
    const rows = [makeSearchRow(1, 50), makeSearchRow(2, 90), makeSearchRow(3, 70)];
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockJsonResponse(makeSearchResponse(rows)))
      .mockResolvedValueOnce(mockJsonResponse(makeBillResponse(2)))
      .mockResolvedValueOnce(mockJsonResponse(makeBillResponse(3)))
      .mockResolvedValueOnce(mockJsonResponse(makeBillResponse(1)));

    const bills = await searchAndNormalize("CA", "test");

    expect(bills).toHaveLength(3);
    expect(bills[0].billId).toBe(2);
    expect(bills[1].billId).toBe(3);
    expect(bills[2].billId).toBe(1);
  });

  it("caps results at 25 bills even when more search rows are returned", async () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      makeSearchRow(i + 1, 100 - i),
    );
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockJsonResponse(makeSearchResponse(rows)))
      .mockImplementation(() =>
        Promise.resolve(mockJsonResponse(makeBillResponse(1))),
      );

    const bills = await searchAndNormalize("CA", "test");

    const getBillCalls = vi.mocked(fetch).mock.calls.slice(1);
    expect(getBillCalls).toHaveLength(25);
    expect(bills).toHaveLength(25);
  });

  it("selects the top 25 by relevance when more than 25 rows are present", async () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      makeSearchRow(i + 1, i + 1),
    );
    vi.mocked(fetch).mockResolvedValueOnce(mockJsonResponse(makeSearchResponse(rows)));

    for (let id = 30; id >= 6; id--) {
      vi.mocked(fetch).mockResolvedValueOnce(mockJsonResponse(makeBillResponse(id)));
    }

    await searchAndNormalize("CA", "test");

    const getBillUrls = vi.mocked(fetch).mock.calls.slice(1).map((c) => c[0] as string);
    for (const url of getBillUrls) {
      const params = new URLSearchParams(url.split("?")[1]);
      const id = Number(params.get("id"));
      expect(id).toBeGreaterThanOrEqual(6);
    }
  });

  it("returns an empty array when there are no search results", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse(makeSearchResponse([])),
    );

    const bills = await searchAndNormalize("CA", "nothing");
    expect(bills).toHaveLength(0);
  });

  it("propagates LegiScanError thrown by getSearch", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ status: "ERROR" }),
    );

    await expect(searchAndNormalize("CA", "test")).rejects.toBeInstanceOf(LegiScanError);
  });

  it("propagates LegiScanError thrown during getBill fan-out", async () => {
    const rows = [makeSearchRow(1, 90)];
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockJsonResponse(makeSearchResponse(rows)))
      .mockResolvedValueOnce(mockJsonResponse({ status: "ERROR" }));

    await expect(searchAndNormalize("CA", "test")).rejects.toBeInstanceOf(LegiScanError);
  });
});
