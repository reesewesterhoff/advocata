import { z } from "zod";

// ---------------------------------------------------------------------------
// Raw LegiScan API response types
//
// The LegiScan getSearch response uses a non-standard dynamic-keyed object
// for its results (numeric string keys "0", "1", ... alongside "summary").
// These shapes are represented as TypeScript interfaces rather than Zod schemas
// and are validated structurally during normalization.
// ---------------------------------------------------------------------------

/** A single bill row returned by the LegiScan getSearch endpoint. */
export interface LegiScanSearchRow {
  readonly relevance: number;
  readonly state: string;
  readonly bill_number: string;
  readonly bill_id: number;
  readonly change_hash: string;
  readonly url: string;
  readonly text_url: string;
  readonly research_url: string;
  readonly last_action_date: string;
  readonly last_action: string;
  readonly title: string;
}

/** Summary metadata returned in the getSearch searchresult object. */
export interface LegiScanSearchSummary {
  readonly page: number;
  readonly range: string;
  readonly relevancy: number;
  readonly count: number;
  readonly page_current: number;
  readonly page_total: number;
}

/**
 * Raw getSearch API response from LegiScan.
 * The `searchresult` object is keyed by `"summary"` and numeric strings
 * (`"0"`, `"1"`, ...) — it is not a plain array.
 */
export interface LegiScanSearchApiResponse {
  readonly status: "OK" | "ERROR";
  readonly searchresult: {
    readonly summary: LegiScanSearchSummary;
    readonly [key: string]: LegiScanSearchRow | LegiScanSearchSummary;
  };
}

/** A bill text document entry in the getBill `texts[]` array. */
export interface LegiScanBillText {
  readonly doc_id: number;
  readonly date: string;
  readonly type: string;
  readonly type_id: number;
  readonly mime: string;
  readonly mime_id: number;
  readonly url: string;
  readonly state_link: string;
  readonly text_size: number;
  readonly text_hash: string;
}

/** A sponsor entry in the getBill `sponsors[]` array. */
export interface LegiScanSponsor {
  readonly people_id: number;
  readonly person_hash: string;
  readonly party_id: number;
  readonly party: string;
  readonly role_id: number;
  readonly role: string;
  readonly name: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly district: string;
  readonly sponsor_type_id: number;
  readonly sponsor_order: number;
}

/** A progress entry in the getBill `progress[]` array. */
export interface LegiScanBillProgress {
  readonly date: string;
  readonly event: number;
}

/** A legislative history entry in the getBill `history[]` array. */
export interface LegiScanBillHistory {
  readonly date: string;
  readonly action: string;
  readonly chamber: string;
  readonly chamber_id: number;
  readonly importance: number;
}

/** A roll-call vote record in the getBill `votes[]` array. */
export interface LegiScanVote {
  readonly roll_call_id: number;
  readonly date: string;
  readonly desc: string;
  readonly yea: number;
  readonly nay: number;
  readonly nv: number;
  readonly absent: number;
  readonly total: number;
  readonly passed: number;
  readonly chamber: string;
  readonly chamber_id: number;
  readonly url: string;
  readonly state_link: string;
}

/** Session metadata in the getBill response. */
export interface LegiScanSession {
  readonly session_id: number;
  readonly state_id: number;
  readonly year_start: number;
  readonly year_end: number;
  readonly prefile: number;
  readonly sine_die: number;
  readonly prior: number;
  readonly special: number;
  readonly session_tag: string;
  readonly session_title: string;
  readonly session_name: string;
}

/** Committee metadata in the getBill response. */
export interface LegiScanCommittee {
  readonly committee_id: number;
  readonly chamber: string;
  readonly chamber_id: number;
  readonly name: string;
}

/** Full bill record returned by the LegiScan getBill endpoint. */
export interface LegiScanBill {
  readonly bill_id: number;
  readonly change_hash: string;
  readonly session_id: number;
  readonly url: string;
  readonly state_link: string;
  readonly completed: number;
  readonly status: number;
  readonly status_date: string;
  readonly state: string;
  readonly state_id: number;
  readonly bill_number: string;
  readonly bill_type: string;
  readonly bill_type_id: number;
  readonly body: string;
  readonly body_id: number;
  readonly current_body: string;
  readonly current_body_id: number;
  readonly title: string;
  readonly description: string;
  readonly pending_committee_id: number;
  readonly session: LegiScanSession;
  readonly committee: LegiScanCommittee;
  readonly progress: readonly LegiScanBillProgress[];
  readonly history: readonly LegiScanBillHistory[];
  readonly sponsors: readonly LegiScanSponsor[];
  readonly texts: readonly LegiScanBillText[];
  readonly votes: readonly LegiScanVote[];
}

/** Raw getBill API response from LegiScan. */
export interface LegiScanBillApiResponse {
  readonly status: "OK" | "ERROR";
  readonly bill: LegiScanBill;
}

// ---------------------------------------------------------------------------
// Bill status codes
// ---------------------------------------------------------------------------

/**
 * Human-readable labels for LegiScan bill status codes.
 * The numeric `status` field on a bill maps to one of these labels.
 */
export const BILL_STATUS_LABELS: Readonly<Record<number, string>> = {
  0: "Unknown",
  1: "Introduced",
  2: "Engrossed",
  3: "Enrolled",
  4: "Passed",
  5: "Vetoed",
  6: "Failed/Dead",
} as const;

// ---------------------------------------------------------------------------
// NormalizedBill — the app's internal bill representation
// ---------------------------------------------------------------------------

/**
 * Zod schema for the app's normalized bill record.
 * Derived from a LegiScan getBill response during the normalization step.
 * This is the canonical shape used by the UI tables and the AI pipeline.
 */
export const NormalizedBillSchema = z.object({
  /** LegiScan bill ID. Serves as the primary key throughout the app. */
  billId: z.number().int().positive(),
  /** Bill identifier string (e.g. "HB 123"). */
  billNumber: z.string(),
  /** Full bill title. */
  title: z.string(),
  /** Short plain-text abstract of the bill, from getBill.description. */
  description: z.string(),
  /** Numeric LegiScan status code. See BILL_STATUS_LABELS for display values. */
  status: z.number().int().min(0),
  /** ISO date string of the most recent status change. */
  statusDate: z.string(),
  /** URL to the bill summary page on LegiScan. */
  url: z.url(),
  /**
   * URL to the most recent bill text document on LegiScan.
   * Derived from the newest entry in getBill.texts[], sorted by date descending.
   * Null when no text documents are available for the bill.
   */
  textUrl: z.url().nullable(),
  /** Two-letter state abbreviation (e.g. "CA") or "US" for federal bills. */
  state: z.string(),
});

/** The app's normalized bill record, used by UI tables and the AI pipeline. */
export type NormalizedBill = z.infer<typeof NormalizedBillSchema>;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Extracts the numbered bill rows from a raw getSearch `searchresult` object,
 * skipping the `"summary"` key.
 *
 * @param searchresult - The raw searchresult from a LegiScan getSearch response.
 * @returns An array of LegiScanSearchRow objects.
 */
export const extractSearchRows = (
  searchresult: LegiScanSearchApiResponse["searchresult"]
): LegiScanSearchRow[] =>
  Object.entries(searchresult)
    .filter(([key]) => key !== "summary")
    .map(([, value]) => value as LegiScanSearchRow);

/**
 * Returns the URL of the most recently dated text document from a bill's
 * `texts` array. Returns null when the array is empty.
 *
 * @param texts - The texts array from a LegiScan getBill response.
 * @returns The URL of the most recent document, or null.
 */
export const getLatestTextUrl = (texts: readonly LegiScanBillText[]): string | null => {
  if (texts.length === 0) return null;
  const sorted = [...texts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return sorted[0].url;
};

/**
 * Normalizes a raw LegiScan getBill record into the app's NormalizedBill shape.
 * Validates the output with NormalizedBillSchema before returning.
 *
 * @param bill - The raw LegiScanBill record from a getBill response.
 * @returns A validated NormalizedBill record.
 * @throws {z.ZodError} If the resulting normalized bill fails schema validation.
 */
export const normalizeBill = (bill: LegiScanBill): NormalizedBill =>
  NormalizedBillSchema.parse({
    billId: bill.bill_id,
    billNumber: bill.bill_number,
    title: bill.title,
    description: bill.description,
    status: bill.status,
    statusDate: bill.status_date,
    url: bill.url,
    textUrl: getLatestTextUrl(bill.texts),
    state: bill.state,
  });
