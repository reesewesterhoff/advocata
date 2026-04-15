import { z } from "zod";
import type {
  LegiScanBill,
  LegiScanBillApiResponse,
  LegiScanSearchRow,
  NormalizedBill,
  StateOption,
} from "@/lib/domain";
import { normalizeBill } from "@/lib/domain";
import { LegiScanError, LEGISCAN_ERROR_CODES } from "./errors";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEGISCAN_API_BASE = "https://api.legiscan.com/";

/** Request timeout in milliseconds for each LegiScan API call. */
const TIMEOUT_MS = 10_000;

/** Maximum number of retry attempts for transient failures. */
const MAX_RETRIES = 2;

/** Base delay in milliseconds for the exponential backoff between retries. */
const RETRY_BASE_DELAY_MS = 500;

/** Maximum number of bills selected from the getSearch results. */
const TOP_N_BILLS = 25;

/** Maximum number of concurrent getBill requests in the fan-out. */
const MAX_CONCURRENT_BILL_FETCHES = 10;

// ---------------------------------------------------------------------------
// Runtime validation schemas for external API payloads
// ---------------------------------------------------------------------------

/** Runtime schema for a single getSearch row returned by LegiScan. */
const LegiScanSearchRowRuntimeSchema = z.object({
  relevance: z.number(),
  state: z.string(),
  bill_number: z.string(),
  bill_id: z.number().int().positive(),
  change_hash: z.string(),
  url: z.string().url(),
  text_url: z.string().url(),
  research_url: z.string().url(),
  last_action_date: z.string(),
  last_action: z.string(),
  title: z.string(),
});

/** Runtime schema for the minimal fields required from getBill. */
const LegiScanBillRuntimeSchema = z.object({
  bill_id: z.number().int().positive(),
  bill_number: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.number().int(),
  status_date: z.string(),
  url: z.string().url(),
  state: z.string(),
  texts: z.array(
    z.object({
      date: z.string(),
      url: z.string().url(),
    }),
  ),
});

/** Runtime schema for the getSearch envelope. */
const LegiScanSearchEnvelopeSchema = z.object({
  status: z.enum(["OK", "ERROR"]),
  searchresult: z.record(z.string(), z.unknown()),
});

/** Runtime schema for the getBill envelope. */
const LegiScanBillEnvelopeSchema = z.object({
  status: z.enum(["OK", "ERROR"]),
  bill: z.unknown(),
});

/** Runtime schema for a response status field. */
const LegiScanStatusSchema = z.object({
  status: z.enum(["OK", "ERROR"]),
});

// ---------------------------------------------------------------------------
// Internal HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Pauses execution for the given number of milliseconds.
 *
 * @param ms - Duration to sleep in milliseconds.
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes an array of async tasks with a bounded concurrency limit.
 * Tasks are consumed in order; at most `concurrency` tasks run simultaneously.
 *
 * @param tasks - Array of zero-argument async task factories.
 * @param concurrency - Maximum number of tasks to run concurrently.
 * @returns A promise that resolves to an array of results in task order.
 */
async function runBounded<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      results[idx] = await tasks[idx]();
    }
  }

  const workerCount = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

/**
 * Performs a single fetch request with a timeout enforced via AbortController.
 * Throws a LegiScanError on timeout or network-level failure.
 *
 * @param url - The URL to fetch.
 * @returns The Response object if the request completed within the timeout.
 * @throws {LegiScanError} On timeout or network failure.
 */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new LegiScanError(
        LEGISCAN_ERROR_CODES.TIMEOUT,
        `LegiScan request timed out after ${TIMEOUT_MS}ms.`,
        err,
      );
    }
    throw new LegiScanError(
      LEGISCAN_ERROR_CODES.NETWORK_ERROR,
      `Network error contacting LegiScan: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches and parses a LegiScan API URL with retries on transient errors.
 * Uses exponential backoff between retry attempts.
 *
 * Retry policy:
 * - TIMEOUT: retried — the server may just be slow.
 * - HTTP 5xx: retried — transient server-side failure.
 * - NETWORK_ERROR: thrown immediately — a connectivity failure is unlikely
 *   to resolve within the retry window.
 * - HTTP 4xx: thrown immediately — a client error will not resolve on retry.
 * - INVALID_RESPONSE: thrown immediately — a parse failure is not transient.
 *
 * @param url - The fully-constructed LegiScan API URL to request.
 * @returns The parsed JSON response body.
 * @throws {LegiScanError} On non-retryable errors or exhausted retries.
 */
async function fetchWithRetry<T>(url: string): Promise<T> {
  let lastError: LegiScanError | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(url);
    } catch (err) {
      const legiscanErr = err as LegiScanError;
      if (legiscanErr.code === LEGISCAN_ERROR_CODES.TIMEOUT) {
        // Timeout is transient — retry.
        lastError = legiscanErr;
        continue;
      }
      // Network errors are not transient — fail immediately.
      throw err;
    }

    if (!response.ok) {
      if (response.status >= 500) {
        // 5xx is transient — retry.
        lastError = new LegiScanError(
          LEGISCAN_ERROR_CODES.NETWORK_ERROR,
          `LegiScan returned HTTP ${response.status}.`,
        );
        continue;
      }
      // 4xx is a client error — fail immediately.
      throw new LegiScanError(
        LEGISCAN_ERROR_CODES.API_ERROR,
        `LegiScan returned HTTP ${response.status}.`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (err) {
      throw new LegiScanError(
        LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
        "Failed to parse LegiScan JSON response.",
        err,
      );
    }

    return body as T;
  }

  throw (
    lastError ??
    new LegiScanError(
      LEGISCAN_ERROR_CODES.NETWORK_ERROR,
      "LegiScan request failed after retries.",
    )
  );
}

/**
 * Validates and extracts LegiScan getSearch rows from an unknown payload.
 *
 * @param data - Raw parsed response body returned from LegiScan.
 * @returns Validated getSearch rows.
 * @throws {LegiScanError} If the response shape is invalid.
 */
function parseSearchRowsFromResponse(data: unknown): LegiScanSearchRow[] {
  const envelopeResult = LegiScanSearchEnvelopeSchema.safeParse(data);
  if (!envelopeResult.success) {
    throw new LegiScanError(
      LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
      "LegiScan getSearch response has an invalid envelope shape.",
    );
  }

  const { searchresult } = envelopeResult.data;
  if (!("summary" in searchresult)) {
    throw new LegiScanError(
      LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
      "LegiScan getSearch response is missing the summary field.",
    );
  }

  const rows: LegiScanSearchRow[] = [];
  for (const [key, value] of Object.entries(searchresult)) {
    if (key === "summary") continue;
    const rowResult = LegiScanSearchRowRuntimeSchema.safeParse(value);
    if (!rowResult.success) {
      throw new LegiScanError(
        LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
        `LegiScan getSearch row "${key}" has an invalid shape.`,
      );
    }
    rows.push(rowResult.data as LegiScanSearchRow);
  }

  return rows;
}

/**
 * Validates the minimal getBill fields needed by downstream normalization.
 *
 * @param data - Raw parsed response body returned from LegiScan.
 * @param billId - The bill ID requested from the API.
 * @returns The original response object, narrowed to LegiScanBillApiResponse.
 * @throws {LegiScanError} If envelope or bill fields are invalid.
 */
function parseBillResponse(
  data: unknown,
  billId: number,
): LegiScanBillApiResponse {
  const envelopeResult = LegiScanBillEnvelopeSchema.safeParse(data);
  if (!envelopeResult.success) {
    throw new LegiScanError(
      LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
      `LegiScan getBill response has an invalid envelope shape for bill_id ${billId}.`,
    );
  }

  const billResult = LegiScanBillRuntimeSchema.safeParse(
    envelopeResult.data.bill,
  );
  if (!billResult.success) {
    throw new LegiScanError(
      LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
      `LegiScan getBill response has invalid bill fields for bill_id ${billId}.`,
    );
  }

  return envelopeResult.data as LegiScanBillApiResponse;
}

// ---------------------------------------------------------------------------
// LegiScan API operations
// ---------------------------------------------------------------------------

/**
 * Calls the LegiScan `getSearch` endpoint and returns the raw search rows.
 * Constructs the request URL using the server-side LEGISCAN_API_KEY env variable.
 *
 * @param state - LegiScan state filter (two-letter abbreviation, "ALL", or "US").
 * @param query - Full-text search query string.
 * @returns An array of all search rows from the first result page (up to 50).
 * @throws {LegiScanError} On API, network, timeout, or parse failures.
 */
export async function getSearch(
  state: StateOption,
  query: string,
): Promise<LegiScanSearchRow[]> {
  const apiKey = process.env.LEGISCAN_API_KEY;
  if (!apiKey) {
    throw new LegiScanError(
      LEGISCAN_ERROR_CODES.API_ERROR,
      "LEGISCAN_API_KEY environment variable is not set.",
    );
  }

  const url = new URL(LEGISCAN_API_BASE);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("op", "getSearch");
  url.searchParams.set("state", state);
  url.searchParams.set("query", query);

  const data = await fetchWithRetry<unknown>(url.toString());
  const statusResult = LegiScanStatusSchema.safeParse(data);
  if (!statusResult.success) {
    throw new LegiScanError(
      LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
      "LegiScan getSearch response is missing a valid status field.",
    );
  }

  if (statusResult.data.status !== "OK") {
    throw new LegiScanError(
      LEGISCAN_ERROR_CODES.API_ERROR,
      "LegiScan getSearch returned a non-OK status.",
    );
  }

  return parseSearchRowsFromResponse(data);
}

/**
 * Calls the LegiScan `getBill` endpoint and returns the raw bill record.
 *
 * @param billId - The LegiScan bill_id to fetch.
 * @returns The raw LegiScan bill record.
 * @throws {LegiScanError} On API, network, timeout, or parse failures.
 */
export async function getBill(billId: number): Promise<LegiScanBill> {
  const apiKey = process.env.LEGISCAN_API_KEY;
  if (!apiKey) {
    throw new LegiScanError(
      LEGISCAN_ERROR_CODES.API_ERROR,
      "LEGISCAN_API_KEY environment variable is not set.",
    );
  }

  const url = new URL(LEGISCAN_API_BASE);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("op", "getBill");
  url.searchParams.set("id", String(billId));

  const data = await fetchWithRetry<unknown>(url.toString());
  const statusResult = LegiScanStatusSchema.safeParse(data);
  if (!statusResult.success) {
    throw new LegiScanError(
      LEGISCAN_ERROR_CODES.INVALID_RESPONSE,
      `LegiScan getBill response is missing a valid status field for bill_id ${billId}.`,
    );
  }

  if (statusResult.data.status !== "OK") {
    throw new LegiScanError(
      LEGISCAN_ERROR_CODES.API_ERROR,
      `LegiScan getBill returned a non-OK status for bill_id ${billId}.`,
    );
  }

  const parsed = parseBillResponse(data, billId);
  return parsed.bill;
}

// ---------------------------------------------------------------------------
// High-level orchestration
// ---------------------------------------------------------------------------

/**
 * Searches LegiScan and returns a normalized set of bills.
 *
 * Orchestration steps:
 * 1. Calls `getSearch` to fetch up to 50 results.
 * 2. Sorts the rows by `relevance` descending and takes the top {@link TOP_N_BILLS}.
 * 3. Fans out `getBill` calls for the selected rows using bounded concurrency.
 * 4. Normalizes each raw bill into the app's `NormalizedBill` shape.
 *
 * @param state - LegiScan state filter.
 * @param query - Full-text search query.
 * @returns An array of normalized bills, sorted most-to-least relevant.
 * @throws {LegiScanError} If the search or any bill fetch fails.
 */
export async function searchAndNormalize(
  state: StateOption,
  query: string,
): Promise<NormalizedBill[]> {
  const rows = await getSearch(state, query);

  const topRows = [...rows]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, TOP_N_BILLS);

  const billTasks = topRows.map((row) => () => getBill(row.bill_id));

  const rawBills = await runBounded(billTasks, MAX_CONCURRENT_BILL_FETCHES);

  return rawBills.map(normalizeBill);
}
