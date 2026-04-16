import { describe, it, expect, vi, beforeEach } from "vitest";
import AnthropicReal from "@anthropic-ai/sdk";

import { AI_ERROR_CODES } from "@/lib/domain";

import { AI_ADAPTER_ERROR_CODES } from "./errors";
import { ClaudeAdapter } from "./claude-adapter";

// ---------------------------------------------------------------------------
// Mock @anthropic-ai/sdk
//
// All error classes are defined inside the factory to avoid the Vitest
// TDZ (Temporal Dead Zone) hoisting issue that arises when top-level
// variables are captured by a vi.mock factory callback.
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class AuthenticationError extends Error {
    readonly status = 401;
    constructor() {
      super("Authentication error");
      this.name = "AuthenticationError";
    }
  }
  class PermissionDeniedError extends Error {
    readonly status = 403;
    constructor() {
      super("Permission denied");
      this.name = "PermissionDeniedError";
    }
  }
  class BadRequestError extends Error {
    readonly status = 400;
    constructor(message = "Bad request") {
      super(message);
      this.name = "BadRequestError";
    }
  }
  class APIConnectionError extends Error {
    constructor() {
      super("Connection error");
      this.name = "APIConnectionError";
    }
  }
  class APIConnectionTimeoutError extends Error {
    constructor() {
      super("Connection timeout");
      this.name = "APIConnectionTimeoutError";
    }
  }
  class APIError extends Error {
    readonly status: number;
    constructor(message = "API error", status = 500) {
      super(message);
      this.name = "APIError";
      this.status = status;
    }
  }

  return {
    default: Object.assign(
      vi.fn().mockImplementation(() => ({
        messages: { create: mockCreate },
      })),
      {
        AuthenticationError,
        PermissionDeniedError,
        BadRequestError,
        APIConnectionError,
        APIConnectionTimeoutError,
        APIError,
      },
    ),
  };
});

// ---------------------------------------------------------------------------
// Mocked Anthropic reference
//
// At runtime this resolves to the mocked module (with simplified constructors).
// The cast avoids TypeScript enforcing the real SDK's constructor signatures in
// tests that only need the mock's error class shapes for instanceof checks.
// ---------------------------------------------------------------------------

const Anthropic = AnthropicReal as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_INPUT = {
  bills: [
    { bill_id: 1, description: "A bill about renewable energy." },
    { bill_id: 2, description: "A bill about healthcare reform." },
  ],
  userContext: "I am a public health policy analyst.",
  provider: "claude" as const,
  model: "claude-sonnet-4-6",
  apiKey: "test-api-key",
};

function makeToolUseResponse(input: unknown) {
  return {
    content: [
      {
        type: "tool_use" as const,
        id: "toolu_01",
        name: "submit_rankings",
        input,
      },
    ],
    stop_reason: "tool_use",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ClaudeAdapter", () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    adapter = new ClaudeAdapter();
    vi.clearAllMocks();
  });

  it("has provider set to claude", () => {
    expect(adapter.provider).toBe("claude");
  });

  describe("analyzeBills — success", () => {
    it("returns normalized rankings on a valid tool_use response", async () => {
      mockCreate.mockResolvedValueOnce(
        makeToolUseResponse({
          rankings: [
            {
              bill_id: 1,
              relevance_score: 88,
              relevance_reason: "Highly relevant.",
            },
            {
              bill_id: 2,
              relevance_score: 55,
              relevance_reason: "Moderately relevant.",
            },
          ],
          error: null,
        }),
      );

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBeNull();
      expect(output.rankings).toHaveLength(2);
      expect(output.rankings[0]).toEqual({
        billId: 1,
        relevanceScore: 88,
        relevanceReason: "Highly relevant.",
      });
      expect(output.rankings[1]).toEqual({
        billId: 2,
        relevanceScore: 55,
        relevanceReason: "Moderately relevant.",
      });
    });

    it("passes the model ID and tool definition to the Claude SDK", async () => {
      mockCreate.mockResolvedValueOnce(
        makeToolUseResponse({ rankings: [], error: null }),
      );

      await adapter.analyzeBills(BASE_INPUT);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-sonnet-4-6",
          tools: expect.arrayContaining([
            expect.objectContaining({ name: "submit_rankings" }),
          ]),
          tool_choice: { type: "tool", name: "submit_rankings" },
        }),
      );
    });
  });

  describe("analyzeBills — AI policy errors", () => {
    it("returns DISALLOWED_REQUEST when tool input reports a policy violation", async () => {
      mockCreate.mockResolvedValueOnce(
        makeToolUseResponse({ rankings: [], error: "DISALLOWED_REQUEST" }),
      );

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBe("DISALLOWED_REQUEST");
      expect(output.rankings).toHaveLength(0);
    });

    it("returns INVALID_RESPONSE when no tool_use block is present", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "Some unexpected text." }],
        stop_reason: "end_turn",
      });

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
    });

    it("returns INVALID_RESPONSE when tool input fails schema validation", async () => {
      mockCreate.mockResolvedValueOnce(
        makeToolUseResponse({ unexpected: "shape" }),
      );

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
    });

    it("returns INVALID_RESPONSE when rankings array contains invalid entries", async () => {
      mockCreate.mockResolvedValueOnce(
        makeToolUseResponse({
          rankings: [{ bill_id: 1 }], // missing required fields
          error: null,
        }),
      );

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBe(AI_ERROR_CODES.INVALID_RESPONSE);
    });
  });

  describe("analyzeBills — infrastructure errors", () => {
    it("throws AiAdapterError(AUTH_ERROR) on AuthenticationError", async () => {
      mockCreate.mockRejectedValueOnce(new Anthropic.AuthenticationError());

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.AUTH_ERROR,
      });
    });

    it("throws AiAdapterError(AUTH_ERROR) on PermissionDeniedError", async () => {
      mockCreate.mockRejectedValueOnce(new Anthropic.PermissionDeniedError());

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.AUTH_ERROR,
      });
    });

    it("returns CONTEXT_WINDOW_EXCEEDED on BadRequestError mentioning context", async () => {
      mockCreate.mockRejectedValueOnce(
        new Anthropic.BadRequestError(
          "Input prompt is too long: exceeds context window limit.",
        ),
      );

      const output = await adapter.analyzeBills(BASE_INPUT);

      expect(output.error).toBe(AI_ERROR_CODES.CONTEXT_WINDOW_EXCEEDED);
    });

    it("throws AiAdapterError(PROVIDER_ERROR) on unrelated BadRequestError", async () => {
      mockCreate.mockRejectedValueOnce(
        new Anthropic.BadRequestError("Invalid model specified."),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.PROVIDER_ERROR,
      });
    });

    it("throws AiAdapterError(NETWORK_ERROR) on APIConnectionError", async () => {
      mockCreate.mockRejectedValueOnce(new Anthropic.APIConnectionError());

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.NETWORK_ERROR,
      });
    });

    it("throws AiAdapterError(NETWORK_ERROR) on APIConnectionTimeoutError", async () => {
      mockCreate.mockRejectedValueOnce(
        new Anthropic.APIConnectionTimeoutError(),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.NETWORK_ERROR,
      });
    });

    it("throws AiAdapterError(PROVIDER_ERROR) on generic APIError", async () => {
      mockCreate.mockRejectedValueOnce(
        new Anthropic.APIError("Internal server error", 500),
      );

      await expect(adapter.analyzeBills(BASE_INPUT)).rejects.toMatchObject({
        code: AI_ADAPTER_ERROR_CODES.PROVIDER_ERROR,
      });
    });
  });
});
