import { type NextRequest, NextResponse } from "next/server";

import { AnalyzeRequestSchema, AI_ERROR_CODES } from "@/lib/domain";
import { AI_ADAPTER_ERROR_CODES, AiAdapterError, getAdapter } from "@/lib/ai";
import { findModel } from "@/lib/ai/models";
import { errorResponse, rateLimitGate } from "@/lib/http";
import { validateUserContext } from "@/lib/validation/user-context";

// ---------------------------------------------------------------------------
// POST /api/analyze
// ---------------------------------------------------------------------------

/**
 * Handles POST requests to `/api/analyze`.
 *
 * Accepts normalized bill data and user context, runs them through the
 * selected AI provider, and returns a ranked bill list.
 *
 * Request body (JSON): Fields matching `AnalyzeRequestSchema`.
 * Successful response body: `{ rankings: AiRankingRow[] }`.
 *
 * Error response bodies all carry an `error` string field plus optional
 * metadata (e.g. `retryAfter` on 429, `details` on 422, `code` on AI errors).
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with AI rankings or a structured error.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // --- Rate limiting ---
  const rateLimitResponse = await rateLimitGate(request);
  if (rateLimitResponse) return rateLimitResponse;

  // --- Parse + validate request body ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const parseResult = AnalyzeRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse("Invalid request parameters.", 422, {
      details: parseResult.error.flatten((issue) => issue.message).fieldErrors,
    });
  }

  const { bills, userContext, aiProvider, aiModel, aiKey } = parseResult.data;

  // --- Validate user context safety guardrails ---
  const userContextValidation = validateUserContext(userContext);
  if (!userContextValidation.valid) {
    return errorResponse("The request was rejected by the AI policy.", 422, {
      code: AI_ERROR_CODES.DISALLOWED_REQUEST,
      reason: userContextValidation.reason,
    });
  }

  // --- Validate model is registered for the provider ---
  const modelEntry = findModel(aiProvider, aiModel);
  if (!modelEntry) {
    return errorResponse(
      `Model "${aiModel}" is not registered for provider "${aiProvider}".`,
      422,
    );
  }

  // --- AI analysis ---
  try {
    const adapter = getAdapter(aiProvider);
    const output = await adapter.analyzeBills({
      bills,
      userContext,
      provider: aiProvider,
      model: aiModel,
      apiKey: aiKey,
    });

    // Surface policy-level errors to the client with a structured code.
    if (output.error !== null) {
      if (output.error === AI_ERROR_CODES.DISALLOWED_REQUEST) {
        return errorResponse(
          "The request was rejected by the AI policy.",
          422,
          { code: AI_ERROR_CODES.DISALLOWED_REQUEST },
        );
      }
      if (output.error === AI_ERROR_CODES.CONTEXT_WINDOW_EXCEEDED) {
        return errorResponse(
          "The request exceeded the model's context window. Narrow your search and try again.",
          422,
          { code: AI_ERROR_CODES.CONTEXT_WINDOW_EXCEEDED },
        );
      }
      // INVALID_RESPONSE or any unexpected AI error code.
      return errorResponse(
        "The AI returned an invalid response. Please try again.",
        500,
        { code: AI_ERROR_CODES.INVALID_RESPONSE },
      );
    }

    return NextResponse.json({ rankings: output.rankings });
  } catch (err) {
    if (err instanceof AiAdapterError) {
      if (err.code === AI_ADAPTER_ERROR_CODES.AUTH_ERROR) {
        return errorResponse(
          "The provided API key is invalid or lacks permission.",
          401,
        );
      }
      if (err.code === AI_ADAPTER_ERROR_CODES.NETWORK_ERROR) {
        return errorResponse(
          "A network error occurred while contacting the AI provider. Please try again.",
          502,
        );
      }
      // PROVIDER_ERROR
      return errorResponse(
        "The AI provider returned an unexpected error. Please try again.",
        502,
      );
    }
    return errorResponse(
      "An unexpected error occurred. Please try again.",
      500,
    );
  }
}
