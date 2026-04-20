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

type GeminiStructuredError = {
  readonly providerMessage: string | null;
  readonly reasonTokens: readonly string[];
};

/**
 * Returns true when a string clearly signals context/input length overflow.
 *
 * @param text - Free-form error text to inspect.
 * @returns True when the text indicates context/token overflow.
 */
function hasContextWindowSignal(text: string): boolean {
  const lowerCaseMessage = text.toLowerCase();

  if (lowerCaseMessage.includes("context window")) return true;
  if (lowerCaseMessage.includes("maximum context length")) return true;
  if (lowerCaseMessage.includes("too many tokens")) return true;
  if (
    (lowerCaseMessage.includes("token count") ||
      lowerCaseMessage.includes("token limit") ||
      lowerCaseMessage.includes("token length")) &&
    (lowerCaseMessage.includes("too long") ||
      lowerCaseMessage.includes("exceed") ||
      lowerCaseMessage.includes("max"))
  ) {
    return true;
  }
  if (
    (lowerCaseMessage.includes("prompt") || lowerCaseMessage.includes("input")) &&
    lowerCaseMessage.includes("too long")
  ) {
    return true;
  }

  return false;
}

/**
 * Recursively collects values from properties named `reason` in a JSON value.
 *
 * @param value - Unknown parsed JSON node.
 * @param sink - Mutable sink for discovered reason strings.
 */
function collectReasonStrings(value: unknown, sink: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectReasonStrings(item, sink);
    }
    return;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "reason" && typeof child === "string") {
        sink.push(child.toLowerCase());
      }
      collectReasonStrings(child, sink);
    }
  }
}

/**
 * Parses a Gemini API error message that may contain JSON response payload.
 *
 * @param message - Raw ApiError message.
 * @returns Structured error metadata when parsable, else null.
 */
function parseGeminiStructuredError(message: string): GeminiStructuredError | null {
  try {
    const parsed = JSON.parse(message) as unknown;
    if (parsed === null || typeof parsed !== "object") {
      return null;
    }

    const root = parsed as Record<string, unknown>;
    const errorNode =
      root.error !== null && typeof root.error === "object"
        ? (root.error as Record<string, unknown>)
        : root;

    const reasonTokens: string[] = [];
    collectReasonStrings(errorNode.details, reasonTokens);

    const providerMessage =
      typeof errorNode.message === "string" ? errorNode.message : null;

    return { providerMessage, reasonTokens };
  } catch {
    return null;
  }
}

/**
 * Determines whether a Gemini error indicates an invalid API key.
 *
 * Stage 1: inspect structured reason tokens from a parsed JSON payload.
 * Stage 2: fallback to legacy text matching for non-JSON error messages.
 *
 * @param message - Raw provider error message.
 * @param structured - Parsed structured error metadata, if available.
 * @returns True when the error indicates an invalid API key.
 */
function isApiKeyInvalidError(
  message: string,
  structured: GeminiStructuredError | null,
): boolean {
  if (structured?.reasonTokens.includes("api_key_invalid")) {
    return true;
  }

  const lowerCaseMessage = message.toLowerCase();
  return (
    lowerCaseMessage.includes("api_key_invalid") ||
    lowerCaseMessage.includes("api key not valid")
  );
}

/**
 * Determines whether a Gemini 400 error message indicates an input context
 * window overflow.
 *
 * Stage 1: inspect structured fields from a JSON error payload (details/reason
 * and provider message).
 * Stage 2: fallback to guarded message heuristics for non-JSON errors.
 *
 * @param message - Raw provider error message.
 * @param structured - Parsed structured error metadata, if available.
 * @returns True when the message clearly indicates prompt/context overflow.
 */
function isContextWindowError(
  message: string,
  structured: GeminiStructuredError | null,
): boolean {
  if (
    structured?.reasonTokens.some(
      (reason) =>
        hasContextWindowSignal(reason) ||
        ((reason.includes("token") || reason.includes("context")) &&
          (reason.includes("exceed") ||
            reason.includes("limit") ||
            reason.includes("max") ||
            reason.includes("too_long"))),
    )
  ) {
    return true;
  }

  if (structured?.providerMessage && hasContextWindowSignal(structured.providerMessage)) {
    return true;
  }

  return hasContextWindowSignal(message);
}

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
          const structured = parseGeminiStructuredError(err.message);

          // Gemini returns 400 with API_KEY_INVALID for invalid API keys,
          // not 401/403 as one might expect.
          if (isApiKeyInvalidError(err.message, structured)) {
            throw new AiAdapterError(
              AI_ADAPTER_ERROR_CODES.AUTH_ERROR,
              "The Gemini API key is invalid or lacks permission.",
              err,
            );
          }

          // 400 with a clear input-size signal → prompt exceeded context window.
          if (isContextWindowError(err.message, structured)) {
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
