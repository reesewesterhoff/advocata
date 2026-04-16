import { describe, it, expect } from "vitest";

import { AI_ERROR_CODES } from "@/lib/domain";

import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  normalizeRawAiOutput,
  parseAndNormalizeAiOutput,
} from "./prompts";

// ---------------------------------------------------------------------------
// SYSTEM_PROMPT
// ---------------------------------------------------------------------------

describe("SYSTEM_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it("contains the legislative analysis role statement", () => {
    expect(SYSTEM_PROMPT).toContain("legislative analysis assistant");
  });

  it("contains the DISALLOWED_REQUEST error code", () => {
    expect(SYSTEM_PROMPT).toContain("DISALLOWED_REQUEST");
  });
});

// ---------------------------------------------------------------------------
// buildUserPrompt
// ---------------------------------------------------------------------------

describe("buildUserPrompt", () => {
  const bills = [
    { bill_id: 1, description: "A bill about clean energy." },
    { bill_id: 2, description: "A bill about healthcare." },
  ];
  const userContext = "I am a renewable energy advocate.";

  it("includes the user context", () => {
    const prompt = buildUserPrompt(userContext, bills);
    expect(prompt).toContain(userContext);
  });

  it("includes all bill_ids", () => {
    const prompt = buildUserPrompt(userContext, bills);
    expect(prompt).toContain('"bill_id": 1');
    expect(prompt).toContain('"bill_id": 2');
  });

  it("includes bill descriptions", () => {
    const prompt = buildUserPrompt(userContext, bills);
    expect(prompt).toContain("clean energy");
    expect(prompt).toContain("healthcare");
  });

  it("instructs the model to rank based on descriptions, not external knowledge", () => {
    const prompt = buildUserPrompt(userContext, bills);
    expect(prompt.toLowerCase()).toContain("description");
    expect(prompt.toLowerCase()).toContain("solely");
  });

  it("instructs the model to return every bill_id", () => {
    const prompt = buildUserPrompt(userContext, bills);
    expect(prompt.toLowerCase()).toContain("return every bill_id");
  });

  it("specifies the relevance_score range", () => {
    const prompt = buildUserPrompt(userContext, bills);
    expect(prompt).toContain("1–100");
  });
});

// ---------------------------------------------------------------------------
// normalizeRawAiOutput
// ---------------------------------------------------------------------------

describe("normalizeRawAiOutput", () => {
  const validRaw = {
    rankings: [
      { bill_id: 42, relevance_score: 95, relevance_reason: "Very relevant." },
      {
        bill_id: 7,
        relevance_score: 30,
        relevance_reason: "Somewhat relevant.",
      },
    ],
    error: null,
  };

  it("returns normalized camelCase rankings and null error for valid input", () => {
    const output = normalizeRawAiOutput(validRaw);
    expect(output.error).toBeNull();
    expect(output.rankings).toHaveLength(2);
    expect(output.rankings[0]).toEqual({
      billId: 42,
      relevanceScore: 95,
      relevanceReason: "Very relevant.",
    });
    expect(output.rankings[1]).toEqual({
      billId: 7,
      relevanceScore: 30,
      relevanceReason: "Somewhat relevant.",
    });
  });

  it("returns INVALID_RESPONSE when required fields are missing", () => {
    const output = normalizeRawAiOutput({
      rankings: [{ bill_id: 1 }],
      error: null,
    });
    expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
    expect(output.rankings).toHaveLength(0);
  });

  it("returns INVALID_RESPONSE when rankings is not an array", () => {
    const output = normalizeRawAiOutput({ rankings: "bad", error: null });
    expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
  });

  it("returns INVALID_RESPONSE when input is null", () => {
    const output = normalizeRawAiOutput(null);
    expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
  });

  it("returns INVALID_RESPONSE when input is not an object", () => {
    const output = normalizeRawAiOutput("string input");
    expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
  });

  it("preserves a DISALLOWED_REQUEST error from the AI", () => {
    const raw = { rankings: [], error: "DISALLOWED_REQUEST" };
    const output = normalizeRawAiOutput(raw);
    expect(output.error).toBe(AI_ERROR_CODES.DISALLOWED_REQUEST);
    expect(output.rankings).toHaveLength(0);
  });

  it("preserves any non-null error string from the AI", () => {
    const raw = { rankings: [], error: "SOME_CUSTOM_ERROR" };
    const output = normalizeRawAiOutput(raw);
    expect(output.error).toBe("SOME_CUSTOM_ERROR");
  });

  it("rejects a relevance_score outside the 1–100 range", () => {
    const raw = {
      rankings: [{ bill_id: 1, relevance_score: 0, relevance_reason: "ok" }],
      error: null,
    };
    const output = normalizeRawAiOutput(raw);
    expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
  });
});

// ---------------------------------------------------------------------------
// parseAndNormalizeAiOutput
// ---------------------------------------------------------------------------

describe("parseAndNormalizeAiOutput", () => {
  it("parses and normalizes a valid JSON string", () => {
    const json = JSON.stringify({
      rankings: [
        { bill_id: 10, relevance_score: 80, relevance_reason: "Relevant." },
      ],
      error: null,
    });
    const output = parseAndNormalizeAiOutput(json);
    expect(output.error).toBeNull();
    expect(output.rankings[0].billId).toBe(10);
  });

  it("returns INVALID_RESPONSE for malformed JSON", () => {
    const output = parseAndNormalizeAiOutput("not json {{");
    expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
    expect(output.rankings).toHaveLength(0);
  });

  it("returns INVALID_RESPONSE for valid JSON that fails schema", () => {
    const output = parseAndNormalizeAiOutput(
      JSON.stringify({ wrong: "shape" }),
    );
    expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
  });
});
