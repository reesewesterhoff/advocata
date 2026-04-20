import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError as ApiErrorReal } from "@google/genai";

import { AI_ERROR_CODES } from "@/lib/domain";

import { AI_ADAPTER_ERROR_CODES } from "./errors";
import { GeminiAdapter } from "./gemini-adapter";

// Cast to `any` to use the mocked constructor signature without TypeScript
// enforcing the real SDK's constructor shape.
const ApiError = ApiErrorReal as any;

// ---------------------------------------------------------------------------
// Mock @google/genai
//
// ApiError is defined inside the factory so that both the adapter's
// `instanceof ApiError` checks and the test's `new ApiError(...)` calls
// reference the same class instance, preventing TDZ issues.
// ---------------------------------------------------------------------------

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => {
  class ApiError extends Error {
    readonly status: number;
    constructor({ message, status }: { message: string; status: number }) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: { generateContent: mockGenerateContent },
    })),
    Type: {
      OBJECT: "OBJECT",
      ARRAY: "ARRAY",
      STRING: "STRING",
      INTEGER: "INTEGER",
    },
    ApiError,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_INPUT = {
  bills: [
    { bill_id: 1, description: "A bill about renewable energy." },
    { bill_id: 2, description: "A bill about healthcare reform." },
  ],
  userContext: "I am an environmental policy researcher.",
  provider: "gemini" as const,
  model: "gemini-2.5-flash",
  apiKey: "test-api-key",
};

function makeResponseText(text: string) {
  return { text };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GeminiAdapter", () => {
  let adapter: GeminiAdapter;

  beforeEach(() => {
    adapter = new GeminiAdapter();
    vi.clearAllMocks();
  });

  it("has provider set to gemini", () => {
    expect(adapter.provider).toBe("gemini");
  });

  describe("analyzeBills — success", () => {
    it("returns normalized rankings on a valid response", async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeResponseText(
          JSON.stringify({
            rankings: [
              {
                bill_id: 1,
                relevance_score: 90,
                relevance_reason: "Very relevant.",
              },
              {
                bill_id: 2,
                relevance_score: 45,
                relevance_reason: "Less relevant.",
              },
            ],
            error: null,
          }),
        ),
      );

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBeNull();
      expect(output.rankings).toHaveLength(2);
      expect(output.rankings[0]).toEqual({
        billId: 1,
        relevanceScore: 90,
        relevanceReason: "Very relevant.",
      });
      expect(output.rankings[1]).toEqual({
        billId: 2,
        relevanceScore: 45,
        relevanceReason: "Less relevant.",
      });
    });

    it("passes the model ID to the Gemini SDK", async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeResponseText(JSON.stringify({ rankings: [], error: null })),
      );

      await adapter.analyzeBills(BASE_INPUT);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gemini-2.5-flash" }),
      );
    });

    it("includes responseMimeType and responseSchema in config", async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeResponseText(JSON.stringify({ rankings: [], error: null })),
      );

      await adapter.analyzeBills(BASE_INPUT);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            responseMimeType: "application/json",
            responseSchema: expect.objectContaining({ type: "OBJECT" }),
          }),
        }),
      );
    });
  });

  describe("analyzeBills — AI policy errors", () => {
    it("returns DISALLOWED_REQUEST when AI reports a policy violation", async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeResponseText(
          JSON.stringify({ rankings: [], error: "DISALLOWED_REQUEST" }),
        ),
      );

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBe(AI_ERROR_CODES.DISALLOWED_REQUEST);
      expect(output.rankings).toHaveLength(0);
    });

    it("returns INVALID_RESPONSE when the response text is empty", async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: undefined });

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
    });

    it("returns INVALID_RESPONSE when the response JSON fails schema validation", async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeResponseText(JSON.stringify({ unexpected: "shape" })),
      );

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
    });

    it("returns INVALID_RESPONSE for malformed JSON in response text", async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeResponseText("not json {{"),
      );

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
    });
  });

  describe("analyzeBills — infrastructure errors", () => {
    it("throws AiAdapterError(AUTH_ERROR) on a 400 ApiError with API_KEY_INVALID", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new ApiError({ message: '{"error":{"code":400,"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}', status: 400 }),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.AUTH_ERROR,
      });
    });

    it("throws AiAdapterError(AUTH_ERROR) on a 400 ApiError with 'API key not valid' message", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new ApiError({ message: "API key not valid. Please pass a valid API key.", status: 400 }),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.AUTH_ERROR,
      });
    });

    it("throws AiAdapterError(AUTH_ERROR) on a 401 ApiError", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new ApiError({ message: "API key not valid.", status: 401 }),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.AUTH_ERROR,
      });
    });

    it("throws AiAdapterError(AUTH_ERROR) on a 403 ApiError", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new ApiError({ message: "Permission denied.", status: 403 }),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.AUTH_ERROR,
      });
    });

    it("returns CONTEXT_WINDOW_EXCEEDED on a 400 ApiError mentioning token", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new ApiError({
          message: "Request too large: token count exceeds limit.",
          status: 400,
        }),
      );

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBe(AI_ERROR_CODES.CONTEXT_WINDOW_EXCEEDED);
    });

    it("returns CONTEXT_WINDOW_EXCEEDED on a 400 ApiError mentioning context window", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new ApiError({
          message: "Prompt exceeds the context window.",
          status: 400,
        }),
      );

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBe(AI_ERROR_CODES.CONTEXT_WINDOW_EXCEEDED);
    });

    it("returns CONTEXT_WINDOW_EXCEEDED from structured 400 details even when text is generic", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new ApiError({
          message: JSON.stringify({
            error: {
              code: 400,
              status: "INVALID_ARGUMENT",
              message: "Request contains an invalid argument.",
              details: [
                {
                  "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                  reason: "INPUT_TOKEN_LIMIT_EXCEEDED",
                },
              ],
            },
          }),
          status: 400,
        }),
      );

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBe(AI_ERROR_CODES.CONTEXT_WINDOW_EXCEEDED);
    });

    it("throws AiAdapterError(PROVIDER_ERROR) when 400 only mentions output size exceeding a limit", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new ApiError({
          message: "Response size exceeds limit.",
          status: 400,
        }),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.PROVIDER_ERROR,
      });
    });

    it("throws AiAdapterError(PROVIDER_ERROR) when 400 mentions tool declarations exceeding a maximum", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new ApiError({
          message: "Number of tool declarations exceeds maximum allowed.",
          status: 400,
        }),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.PROVIDER_ERROR,
      });
    });

    it("throws AiAdapterError(PROVIDER_ERROR) when 400 includes token wording unrelated to token count", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new ApiError({
          message: "Tool token is malformed for function declaration.",
          status: 400,
        }),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.PROVIDER_ERROR,
      });
    });

    it("throws AiAdapterError(PROVIDER_ERROR) on an unrelated 400 ApiError", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new ApiError({ message: "Invalid model specified.", status: 400 }),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.PROVIDER_ERROR,
      });
    });

    it("throws AiAdapterError(PROVIDER_ERROR) on a 500 ApiError", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new ApiError({ message: "Internal server error.", status: 500 }),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.PROVIDER_ERROR,
      });
    });

    it("throws AiAdapterError(NETWORK_ERROR) on a non-ApiError (network failure)", async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new Error("ENOTFOUND api.generativelanguage.googleapis.com"),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.NETWORK_ERROR,
      });
    });
  });
});
