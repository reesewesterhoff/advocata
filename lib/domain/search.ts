import { z } from "zod";

/**
 * All 50 US state abbreviations accepted by the LegiScan API.
 * Used to populate the state selection dropdown.
 */
export const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;

/**
 * All valid LegiScan state filter values.
 * Includes the 50 US states, "ALL" (search all states), and "US" (US Congress).
 */
export const STATE_OPTIONS = [...US_STATES, "ALL", "US"] as const;

/** A valid LegiScan state filter value. */
export type StateOption = (typeof STATE_OPTIONS)[number];

/** Supported AI provider identifiers. */
export const AI_PROVIDERS = ["gemini", "claude"] as const;

/** A supported AI provider identifier. */
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Maximum allowed character length for the user context field. */
export const USER_CONTEXT_MAX_LENGTH = 2000;

/** Maximum allowed character length for the full-text search query. */
export const QUERY_MAX_LENGTH = 500;

/**
 * Zod schema for the search form input submitted by the user.
 * Validated on the server before any external API calls are made.
 */
export const SearchFormInputSchema = z.object({
  /**
   * LegiScan state filter.
   * Use "ALL" for all states or "US" for US Congress.
   */
  state: z.enum(STATE_OPTIONS),
  /** Full-text search query sent to LegiScan. */
  query: z
    .string()
    .min(1, "Search query is required.")
    .max(
      QUERY_MAX_LENGTH,
      `Search query must be ${QUERY_MAX_LENGTH} characters or fewer.`,
    ),
  /** Selected AI provider. */
  aiProvider: z.enum(AI_PROVIDERS),
  /** Model ID for the selected provider. */
  aiModel: z.string().min(1, "Model selection is required."),
  /** User-provided AI API key. Never persisted or logged. */
  aiKey: z.string().min(1, "API key is required."),
  /** Plain-text description of who the user is and what they are looking for. */
  userContext: z
    .string()
    .min(1, "User context is required.")
    .max(
      USER_CONTEXT_MAX_LENGTH,
      `User context must be ${USER_CONTEXT_MAX_LENGTH} characters or fewer.`,
    ),
});

/** The validated search form input submitted by the user. */
export type SearchFormInput = z.infer<typeof SearchFormInputSchema>;
