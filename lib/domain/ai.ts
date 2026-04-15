import { z } from "zod";
import type { NormalizedBill } from "@/lib/domain/legiscan";

/** Zod schema for a single AI-generated bill ranking entry. */
export const AiRankingRowSchema = z.object({
  /** The LegiScan bill_id this ranking applies to. */
  billId: z.number().int().positive(),
  /** Relevance score from 1 (least relevant) to 100 (most relevant). */
  relevanceScore: z.number().int().min(1).max(100),
  /** AI-generated explanation of relevance. Maximum 3 plain-English sentences. */
  relevanceReason: z.string().min(1),
});

/** A single AI-generated bill ranking entry. */
export type AiRankingRow = z.infer<typeof AiRankingRowSchema>;

/** Zod schema for the full AI analysis output returned by an adapter. */
export const AiAnalysisOutputSchema = z.object({
  /** Bills ranked from most to least relevant by the AI. */
  rankings: z.array(AiRankingRowSchema),
  /**
   * Null on success. Set to a structured error code string on policy violation
   * or context window overflow.
   */
  error: z.string().nullable(),
});

/** The full AI analysis output, including ranked bills and an optional error code. */
export type AiAnalysisOutput = z.infer<typeof AiAnalysisOutputSchema>;

/**
 * Structured error codes returned by the AI analysis pipeline.
 * These codes are surfaced to the UI for user-facing error messaging.
 */
export const AI_ERROR_CODES = {
  /** The user context or request violated the system policy. */
  DISALLOWED_REQUEST: "DISALLOWED_REQUEST",
  /** The assembled prompt exceeded the selected model's context window. */
  CONTEXT_WINDOW_EXCEEDED: "CONTEXT_WINDOW_EXCEEDED",
  /** The AI response did not match the expected output schema. */
  INVALID_RESPONSE: "INVALID_RESPONSE",
} as const;

/** A structured error code string from the AI analysis pipeline. */
export type AiErrorCode = (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES];

/**
 * Zod schema for the minimal bill representation sent to the AI for analysis.
 * Only the fields the AI needs are included to minimize prompt token usage.
 */
export const BillForAnalysisSchema = z.object({
  /** LegiScan bill_id. Used to match AI rankings back to normalized bills. */
  bill_id: z.number().int().positive(),
  /** Short plain-text abstract of the bill, sourced from getBill.description. */
  description: z.string(),
});

/** Minimal bill representation sent to the AI for analysis. */
export type BillForAnalysis = z.infer<typeof BillForAnalysisSchema>;

/**
 * A fully merged AI interpretation table row, combining the AI-generated
 * ranking data with the bill metadata sourced from getBill.
 *
 * This is the shape rendered by each row of the AI Interpretation Table in
 * the UI. It is produced client-side by merging `AiRankingRow` entries from
 * `/api/analyze` with the corresponding `NormalizedBill` entries from
 * `/api/search`, joined on `billId`.
 */
export type AiInterpretationRow = AiRankingRow & NormalizedBill;
