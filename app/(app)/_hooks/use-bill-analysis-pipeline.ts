"use client";

import { useState } from "react";
import { z } from "zod";
import type {
  AiRankingRow,
  NormalizedBill,
  SearchFormInput,
} from "@/lib/domain";
import { AiRankingRowSchema, NormalizedBillSchema } from "@/lib/domain";
import type { ApiErrorResponse } from "@/lib/http";

/**
 * Lifecycle stage for a single pipeline phase (search or analysis).
 * Each phase tracks its own stage independently.
 */
export type PhaseStage = "idle" | "pending" | "success" | "error";

/**
 * Overall request stage passed to the search form for button and
 * disabled-state control. Derived by the page from the two phase stages.
 */
export type RequestStage =
  | "idle"
  | "searching"
  | "analyzing"
  | "success"
  | "error";

/** State for the LegiScan search phase. */
export type SearchPhase = {
  /** Current lifecycle stage of the search call. */
  readonly stage: PhaseStage;
  /** User-facing error message, or null when no error is present. */
  readonly error: string | null;
  /** Normalized bill records from a successful search. */
  readonly bills: NormalizedBill[];
};

/** State for the AI analysis phase. */
export type AnalysisPhase = {
  /** Current lifecycle stage of the analysis call. */
  readonly stage: PhaseStage;
  /** User-facing error message, or null when no error is present. */
  readonly error: string | null;
  /** AI-ranked bill rows from a successful analysis. */
  readonly rankings: AiRankingRow[];
};

/** Values returned by `useBillAnalysisPipeline`. */
export type BillAnalysisPipelineResult = {
  /**
   * LegiScan search phase state. Becomes `success` as soon as bills are
   * fetched — before AI analysis begins.
   */
  readonly search: SearchPhase;
  /**
   * AI analysis phase state. Independent from `search`; an analysis error
   * does not clear the search results.
   */
  readonly analysis: AnalysisPhase;
  /**
   * Runs the two-step pipeline: LegiScan search then AI analysis.
   * Each phase manages its own stage and error independently.
   */
  readonly submit: (values: SearchFormInput) => Promise<void>;
};

/**
 * Zod schema for the `/api/search` success response envelope.
 * Validates the shape of the JSON payload before it is used in state.
 */
const SearchResponseSchema = z.object({ bills: z.array(NormalizedBillSchema) });

/**
 * Zod schema for the `/api/analyze` success response envelope.
 * Validates the shape of the JSON payload before it is used in state.
 */
const AnalyzeResponseSchema = z.object({
  rankings: z.array(AiRankingRowSchema),
});

/**
 * Parses a non-2xx fetch response into a user-facing error message.
 *
 * @param response - The failing fetch response.
 * @returns A human-readable error string.
 */
const parseApiError = async (response: Response): Promise<string> => {
  const defaultMessage = "An unexpected error occurred. Please try again.";
  try {
    const json = (await response.json()) as ApiErrorResponse;
    return json.error ?? defaultMessage;
  } catch {
    return defaultMessage;
  }
};

const IDLE_SEARCH: SearchPhase = { stage: "idle", error: null, bills: [] };
const IDLE_ANALYSIS: AnalysisPhase = {
  stage: "idle",
  error: null,
  rankings: [],
};

/**
 * Manages the LegiScan search and AI analysis pipeline with independent
 * phase state for each step.
 *
 * The search phase resolves as soon as bills are fetched, allowing the raw
 * data table to render immediately. The analysis phase resolves separately,
 * so an AI error never clears the search results.
 *
 * @returns Per-phase state objects and a `submit` function.
 */
export const useBillAnalysisPipeline = (): BillAnalysisPipelineResult => {
  const [search, setSearch] = useState<SearchPhase>(IDLE_SEARCH);
  const [analysis, setAnalysis] = useState<AnalysisPhase>(IDLE_ANALYSIS);

  /**
   * Executes the two-step pipeline. Each phase updates its own state slice
   * independently so results from a completed phase are never lost.
   *
   * @param values - Validated search form values.
   */
  const submit = async (values: SearchFormInput): Promise<void> => {
    setSearch({ stage: "pending", error: null, bills: [] });
    setAnalysis(IDLE_ANALYSIS);

    // --- Phase 1: LegiScan search ---
    let bills: NormalizedBill[];
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: values.state, query: values.query }),
      });

      if (!response.ok) {
        setSearch({
          stage: "error",
          error: await parseApiError(response),
          bills: [],
        });
        return;
      }

      const parsed = SearchResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        setSearch({
          stage: "error",
          error: "Received an unexpected response from the server.",
          bills: [],
        });
        return;
      }
      bills = parsed.data.bills;
      setSearch({ stage: "success", error: null, bills });
    } catch {
      setSearch({
        stage: "error",
        error: "A network error occurred while contacting LegiScan.",
        bills: [],
      });
      return;
    }

    // --- Phase 2: AI analysis ---
    setAnalysis({ stage: "pending", error: null, rankings: [] });
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bills: bills.map((bill) => ({
            bill_id: bill.billId,
            description: bill.description,
          })),
          userContext: values.userContext,
          aiProvider: values.aiProvider,
          aiModel: values.aiModel,
          aiKey: values.aiKey,
        }),
      });

      if (!response.ok) {
        setAnalysis({
          stage: "error",
          error: await parseApiError(response),
          rankings: [],
        });
        return;
      }

      const parsed = AnalyzeResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        setAnalysis({
          stage: "error",
          error: "Received an unexpected response from the server.",
          rankings: [],
        });
        return;
      }
      setAnalysis({
        stage: "success",
        error: null,
        rankings: parsed.data.rankings,
      });
    } catch {
      setAnalysis({
        stage: "error",
        error: "A network error occurred while contacting the AI provider.",
        rankings: [],
      });
    }
  };

  return { search, analysis, submit };
};
