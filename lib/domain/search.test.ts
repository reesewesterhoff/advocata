import { describe, it, expect } from "vitest";
import {
  SearchFormInputSchema,
  STATE_OPTIONS,
  AI_PROVIDERS,
  USER_CONTEXT_MAX_LENGTH,
  QUERY_MAX_LENGTH,
  US_STATES,
} from "./search";

/** A fully valid SearchFormInput fixture. */
const VALID_INPUT = {
  state: "CA",
  query: "climate change",
  aiProvider: "gemini",
  aiModel: "gemini-2.5-flash",
  aiKey: "test-api-key",
  userContext: "I am an environmental policy researcher.",
} as const;

describe("SearchFormInputSchema", () => {
  it("accepts a fully valid input object", () => {
    const result = SearchFormInputSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it("accepts every valid state option", () => {
    for (const state of STATE_OPTIONS) {
      const result = SearchFormInputSchema.safeParse({ ...VALID_INPUT, state });
      expect(result.success, `state "${state}" should be valid`).toBe(true);
    }
  });

  it("accepts both valid AI providers", () => {
    for (const aiProvider of AI_PROVIDERS) {
      const result = SearchFormInputSchema.safeParse({ ...VALID_INPUT, aiProvider });
      expect(result.success, `provider "${aiProvider}" should be valid`).toBe(true);
    }
  });

  it("rejects an unrecognized state value", () => {
    const result = SearchFormInputSchema.safeParse({ ...VALID_INPUT, state: "XX" });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized AI provider", () => {
    const result = SearchFormInputSchema.safeParse({ ...VALID_INPUT, aiProvider: "openai" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty query", () => {
    const result = SearchFormInputSchema.safeParse({ ...VALID_INPUT, query: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a query exceeding QUERY_MAX_LENGTH", () => {
    const result = SearchFormInputSchema.safeParse({
      ...VALID_INPUT,
      query: "a".repeat(QUERY_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a query at exactly QUERY_MAX_LENGTH characters", () => {
    const result = SearchFormInputSchema.safeParse({
      ...VALID_INPUT,
      query: "a".repeat(QUERY_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty AI model", () => {
    const result = SearchFormInputSchema.safeParse({ ...VALID_INPUT, aiModel: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty AI key", () => {
    const result = SearchFormInputSchema.safeParse({ ...VALID_INPUT, aiKey: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty user context", () => {
    const result = SearchFormInputSchema.safeParse({ ...VALID_INPUT, userContext: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a user context exceeding USER_CONTEXT_MAX_LENGTH", () => {
    const result = SearchFormInputSchema.safeParse({
      ...VALID_INPUT,
      userContext: "a".repeat(USER_CONTEXT_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a user context at exactly USER_CONTEXT_MAX_LENGTH characters", () => {
    const result = SearchFormInputSchema.safeParse({
      ...VALID_INPUT,
      userContext: "a".repeat(USER_CONTEXT_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an input missing required fields", () => {
    const result = SearchFormInputSchema.safeParse({ state: "CA" });
    expect(result.success).toBe(false);
  });
});

describe("STATE_OPTIONS", () => {
  it("includes all 50 US state abbreviations", () => {
    expect(US_STATES.length).toBe(50);
    for (const state of US_STATES) {
      expect(STATE_OPTIONS).toContain(state);
    }
  });

  it('includes "ALL"', () => {
    expect(STATE_OPTIONS).toContain("ALL");
  });

  it('includes "US" for US Congress', () => {
    expect(STATE_OPTIONS).toContain("US");
  });

  it("has 52 total entries (50 states + ALL + US)", () => {
    expect(STATE_OPTIONS.length).toBe(52);
  });
});
