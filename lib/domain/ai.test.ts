import { describe, it, expect } from "vitest";
import {
  AiRankingRowSchema,
  AiAnalysisOutputSchema,
  BillForAnalysisSchema,
  AI_ERROR_CODES,
} from "./ai";
import type { AiInterpretationRow } from "./ai";

describe("AiRankingRowSchema", () => {
  it("accepts a valid ranking row", () => {
    const result = AiRankingRowSchema.safeParse({
      billId: 1234,
      relevanceScore: 85,
      relevanceReason: "This bill directly addresses the user's area of focus.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts boundary relevance scores of 1 and 100", () => {
    expect(AiRankingRowSchema.safeParse({ billId: 1, relevanceScore: 1, relevanceReason: "Low" }).success).toBe(true);
    expect(AiRankingRowSchema.safeParse({ billId: 1, relevanceScore: 100, relevanceReason: "High" }).success).toBe(true);
  });

  it("rejects a relevance score below 1", () => {
    const result = AiRankingRowSchema.safeParse({ billId: 1, relevanceScore: 0, relevanceReason: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects a relevance score above 100", () => {
    const result = AiRankingRowSchema.safeParse({ billId: 1, relevanceScore: 101, relevanceReason: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer relevance score", () => {
    const result = AiRankingRowSchema.safeParse({ billId: 1, relevanceScore: 85.5, relevanceReason: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive bill ID", () => {
    const result = AiRankingRowSchema.safeParse({ billId: 0, relevanceScore: 50, relevanceReason: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty relevance reason", () => {
    const result = AiRankingRowSchema.safeParse({ billId: 1, relevanceScore: 50, relevanceReason: "" });
    expect(result.success).toBe(false);
  });
});

describe("AiAnalysisOutputSchema", () => {
  it("accepts a valid output with rankings and null error", () => {
    const result = AiAnalysisOutputSchema.safeParse({
      rankings: [
        { billId: 1, relevanceScore: 90, relevanceReason: "Highly relevant." },
        { billId: 2, relevanceScore: 60, relevanceReason: "Somewhat relevant." },
      ],
      error: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an output with an empty rankings array and an error code", () => {
    const result = AiAnalysisOutputSchema.safeParse({
      rankings: [],
      error: AI_ERROR_CODES.DISALLOWED_REQUEST,
    });
    expect(result.success).toBe(true);
  });

  it("accepts all defined error codes", () => {
    for (const code of Object.values(AI_ERROR_CODES)) {
      const result = AiAnalysisOutputSchema.safeParse({ rankings: [], error: code });
      expect(result.success, `error code "${code}" should be valid`).toBe(true);
    }
  });

  it("rejects an output missing the rankings field", () => {
    const result = AiAnalysisOutputSchema.safeParse({ error: null });
    expect(result.success).toBe(false);
  });

  it("rejects an output missing the error field", () => {
    const result = AiAnalysisOutputSchema.safeParse({ rankings: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an output where error is undefined instead of null", () => {
    const result = AiAnalysisOutputSchema.safeParse({ rankings: [], error: undefined });
    expect(result.success).toBe(false);
  });
});

describe("BillForAnalysisSchema", () => {
  it("accepts a valid bill for analysis", () => {
    const result = BillForAnalysisSchema.safeParse({
      bill_id: 987,
      description: "A bill to reduce carbon emissions.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty description string", () => {
    const result = BillForAnalysisSchema.safeParse({ bill_id: 1, description: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive bill_id", () => {
    const result = BillForAnalysisSchema.safeParse({ bill_id: 0, description: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing bill_id", () => {
    const result = BillForAnalysisSchema.safeParse({ description: "x" });
    expect(result.success).toBe(false);
  });
});

describe("AI_ERROR_CODES", () => {
  it("defines DISALLOWED_REQUEST, CONTEXT_WINDOW_EXCEEDED, and INVALID_RESPONSE", () => {
    expect(AI_ERROR_CODES.DISALLOWED_REQUEST).toBe("DISALLOWED_REQUEST");
    expect(AI_ERROR_CODES.CONTEXT_WINDOW_EXCEEDED).toBe("CONTEXT_WINDOW_EXCEEDED");
    expect(AI_ERROR_CODES.INVALID_RESPONSE).toBe("INVALID_RESPONSE");
  });
});

describe("AiInterpretationRow", () => {
  it("is structurally assignable from a merged AiRankingRow + NormalizedBill object", () => {
    const row: AiInterpretationRow = {
      // AiRankingRow fields
      billId: 123,
      relevanceScore: 87,
      relevanceReason: "Directly addresses the user's area of focus.",
      // NormalizedBill fields
      billNumber: "HB 1",
      title: "A Bill to Test Things",
      description: "This bill tests the merged row type.",
      status: 1,
      statusDate: "2024-01-15",
      url: "https://legiscan.com/CA/bill/HB1/2024",
      textUrl: "https://legiscan.com/CA/text/HB1/2024",
      state: "CA",
    };
    expect(row.billId).toBe(123);
    expect(row.relevanceScore).toBe(87);
    expect(row.title).toBe("A Bill to Test Things");
    expect(row.textUrl).toBe("https://legiscan.com/CA/text/HB1/2024");
  });

  it("accepts a null textUrl on a merged row", () => {
    const row: AiInterpretationRow = {
      billId: 456,
      relevanceScore: 42,
      relevanceReason: "Tangentially related.",
      billNumber: "SB 99",
      title: "Another Bill",
      description: "No text available yet.",
      status: 0,
      statusDate: "2024-02-01",
      url: "https://legiscan.com/CA/bill/SB99/2024",
      textUrl: null,
      state: "CA",
    };
    expect(row.textUrl).toBeNull();
  });
});
