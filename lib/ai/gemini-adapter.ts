import { GoogleGenAI, Type, ApiError } from "@google/genai";

import { AI_ERROR_CODES, type AiAnalysisOutput } from "@/lib/domain";

import { AiAdapterError, AI_ADAPTER_ERROR_CODES } from "./errors";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseAndNormalizeAiOutput,
} from "./prompts";
import type { AiAdapter, AnalyzeBillsInput } from "./types";

// ---------------------------------------------------------------------------
// Structured output schema
// ---------------------------------------------------------------------------

/**
 * JSON Schema passed to Gemini's `responseSchema` config to enforce structured
 * output at the SDK level. Field names use snake_case to match the prompt template.
 */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    rankings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          bill_id: { type: Type.INTEGER },
          relevance_score: { type: Type.INTEGER },
          relevance_reason: { type: Type.STRING },
        },
        required: ["bill_id", "relevance_score", "relevance_reason"],
      },
    },
    error: { type: Type.STRING, nullable: true },
  },
  required: ["rankings", "error"],
};

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * AI adapter for Google Gemini models.
 *
 * Uses `responseMimeType: "application/json"` combined with `responseSchema`
 * to enforce structured output at the SDK level. The API key is consumed
 * per-call and never stored as instance state.
 */
export class GeminiAdapter implements AiAdapter {
  /** @inheritdoc */
  readonly provider = "gemini" as const;

  /**
   * Calls the Gemini API to rank the provided bills by relevance to the user's
   * context. Enforces structured JSON output via the SDK's `responseSchema`.
   *
   * @param input - Bills, user context, model ID, and transient API key.
   * @returns A promise resolving to the ranked AI analysis output.
   * @throws {AiAdapterError} On authentication or provider-side failures.
   */
  async analyzeBills(input: AnalyzeBillsInput): Promise<AiAnalysisOutput> {
    const { bills, userContext, model, apiKey } = input;
    const userPrompt = buildUserPrompt(userContext, bills);
    const genAI = new GoogleGenAI({ apiKey });

    try {
      const response = await genAI.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const text = response.text;
      if (!text) {
        return { rankings: [], error: AI_ERROR_CODES.INVALID_RESPONSE };
      }

      return parseAndNormalizeAiOutput(text);
    } catch (err) {
      if (err instanceof AiAdapterError) throw err;

      if (err instanceof ApiError) {
        // 401 / 403 → invalid or unauthorized API key.
        if (err.status === 401 || err.status === 403) {
          throw new AiAdapterError(
            AI_ADAPTER_ERROR_CODES.AUTH_ERROR,
            "The Gemini API key is invalid or lacks permission.",
            err,
          );
        }

        if (err.status === 400) {
          const lowerCaseMessage = err.message.toLowerCase();

          // Gemini returns 400 with API_KEY_INVALID for invalid API keys,
          // not 401/403 as one might expect.
          if (
            lowerCaseMessage.includes("api_key_invalid") ||
            lowerCaseMessage.includes("api key not valid")
          ) {
            throw new AiAdapterError(
              AI_ADAPTER_ERROR_CODES.AUTH_ERROR,
              "The Gemini API key is invalid or lacks permission.",
              err,
            );
          }

          // 400 with a token/size message → prompt exceeded the context window.
          if (
            lowerCaseMessage.includes("context window") ||
            lowerCaseMessage.includes("too long") ||
            lowerCaseMessage.includes("token") ||
            lowerCaseMessage.includes("exceeds")
          ) {
            return {
              rankings: [],
              error: AI_ERROR_CODES.CONTEXT_WINDOW_EXCEEDED,
            };
          }
        }

        throw new AiAdapterError(
          AI_ADAPTER_ERROR_CODES.PROVIDER_ERROR,
          "The Gemini API returned an unexpected error.",
          err,
        );
      }

      // Non-ApiError: network-level failure (DNS, TCP reset, fetch abort, etc.)
      throw new AiAdapterError(
        AI_ADAPTER_ERROR_CODES.NETWORK_ERROR,
        "A network error occurred while contacting Gemini.",
        err,
      );
    }
  }
}
