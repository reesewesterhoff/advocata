import Anthropic from "@anthropic-ai/sdk";

import { AI_ERROR_CODES, type AiAnalysisOutput } from "@/lib/domain";

import { AiAdapterError, AI_ADAPTER_ERROR_CODES } from "./errors";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  normalizeRawAiOutput,
} from "./prompts";
import type { AiAdapter, AnalyzeBillsInput } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum number of tokens Claude may generate in a single response.
 *
 * This caps the output size, not the input (prompt) size. At ~50–80 tokens
 * per ranking entry (bill_id + score + 1–3 sentence reason), 25 bills
 * produces at most ~2 000 output tokens. 4 096 provides comfortable headroom
 * while staying well within model limits.
 *
 * Required by the Anthropic SDK — requests fail if this field is omitted.
 */
const MAX_OUTPUT_TOKENS = 4096;

// ---------------------------------------------------------------------------
// Tool definition for structured output
// ---------------------------------------------------------------------------

/**
 * Single tool definition passed to the Claude API.
 * Forcing the model to call `submit_rankings` via `tool_choice` ensures the
 * response conforms to the output schema at the SDK level.
 */
const SUBMIT_RANKINGS_TOOL: Anthropic.Tool = {
  name: "submit_rankings",
  description:
    "Submit the ranked bill analysis results. Call this tool with every bill ranked from most to least relevant.",
  input_schema: {
    type: "object",
    properties: {
      rankings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            bill_id: {
              type: "integer",
              description: "The bill_id from the input.",
            },
            relevance_score: {
              type: "integer",
              description: "Integer 1–100; 100 = most relevant.",
            },
            relevance_reason: {
              type: "string",
              description:
                "Max 3 plain-English sentences explaining relevance.",
            },
          },
          required: ["bill_id", "relevance_score", "relevance_reason"],
        },
      },
      error: {
        type: ["string", "null"] as unknown as "string",
        description:
          'null on success; "DISALLOWED_REQUEST" on policy violation.',
      },
    },
    required: ["rankings", "error"],
  },
};

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * AI adapter for Anthropic Claude models.
 *
 * Uses the `tool_use` pattern — defines a single tool named `submit_rankings`
 * and instructs the model to call it. The tool's `input_schema` enforces the
 * output schema at the SDK level. The API key is consumed per-call and never
 * stored as instance state.
 */
export class ClaudeAdapter implements AiAdapter {
  /** @inheritdoc */
  readonly provider = "claude" as const;

  /**
   * Calls the Claude API to rank the provided bills by relevance to the user's
   * context. Enforces structured output via the `tool_use` pattern.
   *
   * @param input - Bills, user context, model ID, and transient API key.
   * @returns A promise resolving to the ranked AI analysis output.
   * @throws {AiAdapterError} On authentication or provider-side failures.
   */
  async analyzeBills(input: AnalyzeBillsInput): Promise<AiAnalysisOutput> {
    const { bills, userContext, model, apiKey } = input;
    const userPrompt = buildUserPrompt(userContext, bills);
    const client = new Anthropic({ apiKey });

    try {
      const message = await client.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [SUBMIT_RANKINGS_TOOL],
        tool_choice: { type: "tool", name: "submit_rankings" },
        messages: [{ role: "user", content: userPrompt }],
      });

      // `tool_choice: { type: "tool", name: "submit_rankings" }` above
      // guarantees Claude always calls this tool, so the find will always
      // succeed. The type narrowing is still needed because the SDK types
      // `message.content` as a union of all possible block types.
      const toolUseBlock = message.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      if (!toolUseBlock) {
        return { rankings: [], error: AI_ERROR_CODES.INVALID_RESPONSE };
      }

      // `toolUseBlock.input` is already a structured JS object; validate
      // directly without a JSON round-trip.
      return normalizeRawAiOutput(toolUseBlock.input);
    } catch (err) {
      if (err instanceof AiAdapterError) throw err;

      if (err instanceof Anthropic.AuthenticationError) {
        throw new AiAdapterError(
          AI_ADAPTER_ERROR_CODES.AUTH_ERROR,
          "The Claude API key is invalid or lacks permission.",
          err,
        );
      }

      if (err instanceof Anthropic.PermissionDeniedError) {
        throw new AiAdapterError(
          AI_ADAPTER_ERROR_CODES.AUTH_ERROR,
          "The Claude API key does not have permission for this operation.",
          err,
        );
      }

      if (err instanceof Anthropic.BadRequestError) {
        const message = err.message.toLowerCase();
        if (
          message.includes("context") ||
          message.includes("token") ||
          message.includes("too long")
        ) {
          return {
            rankings: [],
            error: AI_ERROR_CODES.CONTEXT_WINDOW_EXCEEDED,
          };
        }
        throw new AiAdapterError(
          AI_ADAPTER_ERROR_CODES.PROVIDER_ERROR,
          "Claude rejected the request.",
          err,
        );
      }

      if (
        err instanceof Anthropic.APIConnectionError ||
        err instanceof Anthropic.APIConnectionTimeoutError
      ) {
        throw new AiAdapterError(
          AI_ADAPTER_ERROR_CODES.NETWORK_ERROR,
          "A network error occurred while contacting Claude.",
          err,
        );
      }

      if (err instanceof Anthropic.APIError) {
        // 429 = rate limited; 503 = service unavailable; 529 = overloaded.
        // All three are transient — the caller should surface a retry message.
        if (err.status === 429 || err.status === 503 || err.status === 529) {
          throw new AiAdapterError(
            AI_ADAPTER_ERROR_CODES.SERVICE_UNAVAILABLE,
            "The selected Claude model is temporarily unavailable due to high demand.",
            err,
          );
        }

        throw new AiAdapterError(
          AI_ADAPTER_ERROR_CODES.PROVIDER_ERROR,
          "The Claude API returned an unexpected error.",
          err,
        );
      }

      throw new AiAdapterError(
        AI_ADAPTER_ERROR_CODES.NETWORK_ERROR,
        "An unexpected error occurred communicating with Claude.",
        err,
      );
    }
  }
}
