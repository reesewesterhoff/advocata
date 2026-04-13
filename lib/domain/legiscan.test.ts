import { describe, it, expect } from "vitest";
import {
  NormalizedBillSchema,
  extractSearchRows,
  getLatestTextUrl,
  normalizeBill,
  BILL_STATUS_LABELS,
} from "./legiscan";
import type { LegiScanBill, LegiScanSearchApiResponse } from "./legiscan";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal valid LegiScanBillText fixture. */
const makeText = (date: string, url: string) => ({
  doc_id: 1,
  date,
  type: "Introduced",
  type_id: 1,
  mime: "application/pdf",
  mime_id: 1,
  url,
  state_link: url,
  text_size: 1000,
  text_hash: "abc123",
});

/** Minimal valid LegiScanBill fixture. */
const makeBill = (overrides: Partial<LegiScanBill> = {}): LegiScanBill => ({
  bill_id: 123,
  change_hash: "hash",
  session_id: 1,
  url: "https://legiscan.com/CA/bill/HB1/2024",
  state_link: "https://leginfo.legislature.ca.gov",
  completed: 0,
  status: 1,
  status_date: "2024-01-15",
  state: "CA",
  state_id: 5,
  bill_number: "HB 1",
  bill_type: "B",
  bill_type_id: 1,
  body: "H",
  body_id: 1,
  current_body: "H",
  current_body_id: 1,
  title: "A Bill to Test Things",
  description: "This bill tests normalization.",
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
  ...overrides,
});

// ---------------------------------------------------------------------------
// NormalizedBillSchema
// ---------------------------------------------------------------------------

describe("NormalizedBillSchema", () => {
  it("accepts a valid normalized bill with a textUrl", () => {
    const result = NormalizedBillSchema.safeParse({
      billId: 123,
      billNumber: "HB 1",
      title: "Test Bill",
      description: "A test bill.",
      status: 1,
      statusDate: "2024-01-15",
      url: "https://legiscan.com/CA/bill/HB1/2024",
      textUrl: "https://legiscan.com/CA/text/HB1/2024",
      state: "CA",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid normalized bill with a null textUrl", () => {
    const result = NormalizedBillSchema.safeParse({
      billId: 123,
      billNumber: "HB 1",
      title: "Test Bill",
      description: "A test bill.",
      status: 1,
      statusDate: "2024-01-15",
      url: "https://legiscan.com/CA/bill/HB1/2024",
      textUrl: null,
      state: "CA",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive billId", () => {
    const result = NormalizedBillSchema.safeParse({
      billId: 0,
      billNumber: "HB 1",
      title: "Test Bill",
      description: "A test bill.",
      status: 1,
      statusDate: "2024-01-15",
      url: "https://legiscan.com/CA/bill/HB1/2024",
      textUrl: null,
      state: "CA",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid URL for url", () => {
    const result = NormalizedBillSchema.safeParse({
      billId: 1,
      billNumber: "HB 1",
      title: "Test Bill",
      description: "x",
      status: 1,
      statusDate: "2024-01-15",
      url: "not-a-url",
      textUrl: null,
      state: "CA",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid URL for textUrl when not null", () => {
    const result = NormalizedBillSchema.safeParse({
      billId: 1,
      billNumber: "HB 1",
      title: "Test Bill",
      description: "x",
      status: 1,
      statusDate: "2024-01-15",
      url: "https://legiscan.com/CA/bill/HB1/2024",
      textUrl: "not-a-url",
      state: "CA",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getLatestTextUrl
// ---------------------------------------------------------------------------

describe("getLatestTextUrl", () => {
  it("returns null for an empty texts array", () => {
    expect(getLatestTextUrl([])).toBeNull();
  });

  it("returns the URL of the only entry in a single-item array", () => {
    const texts = [makeText("2024-03-01", "https://example.com/text/1")];
    expect(getLatestTextUrl(texts)).toBe("https://example.com/text/1");
  });

  it("returns the URL of the most recent entry in a multi-item array", () => {
    const texts = [
      makeText("2024-01-01", "https://example.com/text/old"),
      makeText("2024-06-15", "https://example.com/text/newest"),
      makeText("2024-03-10", "https://example.com/text/middle"),
    ];
    expect(getLatestTextUrl(texts)).toBe("https://example.com/text/newest");
  });

  it("does not mutate the original texts array", () => {
    const texts = [
      makeText("2024-01-01", "https://example.com/text/old"),
      makeText("2024-06-15", "https://example.com/text/newest"),
    ];
    const originalOrder = texts.map((t) => t.url);
    getLatestTextUrl(texts);
    expect(texts.map((t) => t.url)).toEqual(originalOrder);
  });
});

// ---------------------------------------------------------------------------
// extractSearchRows
// ---------------------------------------------------------------------------

describe("extractSearchRows", () => {
  const makeSearchResult = (): LegiScanSearchApiResponse["searchresult"] => ({
    summary: {
      page: 1,
      range: "1-2",
      relevancy: 100,
      count: 2,
      page_current: 1,
      page_total: 1,
    },
    "0": {
      relevance: 90,
      state: "CA",
      bill_number: "HB 1",
      bill_id: 100,
      change_hash: "h1",
      url: "https://legiscan.com/CA/bill/HB1/2024",
      text_url: "https://legiscan.com/CA/text/HB1/2024",
      research_url: "https://legiscan.com/CA/research/HB1/2024",
      last_action_date: "2024-01-15",
      last_action: "Introduced",
      title: "Bill One",
    },
    "1": {
      relevance: 75,
      state: "CA",
      bill_number: "HB 2",
      bill_id: 101,
      change_hash: "h2",
      url: "https://legiscan.com/CA/bill/HB2/2024",
      text_url: "https://legiscan.com/CA/text/HB2/2024",
      research_url: "https://legiscan.com/CA/research/HB2/2024",
      last_action_date: "2024-01-20",
      last_action: "Referred to committee",
      title: "Bill Two",
    },
  });

  it("returns all numeric-keyed bill rows", () => {
    const rows = extractSearchRows(makeSearchResult());
    expect(rows).toHaveLength(2);
  });

  it("excludes the summary key from the results", () => {
    const rows = extractSearchRows(makeSearchResult());
    const hasSummary = rows.some((r) => "page" in r);
    expect(hasSummary).toBe(false);
  });

  it("returns an empty array for a searchresult with only a summary", () => {
    const rows = extractSearchRows({
      summary: { page: 1, range: "", relevancy: 0, count: 0, page_current: 1, page_total: 0 },
    });
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeBill
// ---------------------------------------------------------------------------

describe("normalizeBill", () => {
  it("maps raw bill fields to camelCase normalized fields", () => {
    const bill = makeBill();
    const normalized = normalizeBill(bill);
    expect(normalized.billId).toBe(bill.bill_id);
    expect(normalized.billNumber).toBe(bill.bill_number);
    expect(normalized.title).toBe(bill.title);
    expect(normalized.description).toBe(bill.description);
    expect(normalized.status).toBe(bill.status);
    expect(normalized.statusDate).toBe(bill.status_date);
    expect(normalized.url).toBe(bill.url);
    expect(normalized.state).toBe(bill.state);
  });

  it("sets textUrl to null when the texts array is empty", () => {
    const normalized = normalizeBill(makeBill({ texts: [] }));
    expect(normalized.textUrl).toBeNull();
  });

  it("sets textUrl to the most recent text URL when texts are present", () => {
    const bill = makeBill({
      texts: [
        makeText("2024-01-01", "https://legiscan.com/CA/text/HB1/2024/v1"),
        makeText("2024-06-01", "https://legiscan.com/CA/text/HB1/2024/v2"),
      ],
    });
    const normalized = normalizeBill(bill);
    expect(normalized.textUrl).toBe("https://legiscan.com/CA/text/HB1/2024/v2");
  });
});

// ---------------------------------------------------------------------------
// BILL_STATUS_LABELS
// ---------------------------------------------------------------------------

describe("BILL_STATUS_LABELS", () => {
  it("provides labels for status codes 0 through 6", () => {
    for (let i = 0; i <= 6; i++) {
      expect(BILL_STATUS_LABELS[i]).toBeDefined();
      expect(typeof BILL_STATUS_LABELS[i]).toBe("string");
    }
  });
});
