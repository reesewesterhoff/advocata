import type { AiAnalysisOutput, AiProvider, BillForAnalysis } from "@/lib/domain";

/** Input passed to an AI adapter's analyzeBills method. */
export interface AnalyzeBillsInput {
  /** Minimal bill records to analyze. */
  readonly bills: readonly BillForAnalysis[];
  /** Plain-text user context describing who the user is and what they seek. */
  readonly userContext: string;
  /** The AI provider this input targets. */
  readonly provider: AiProvider;
  /** The model ID to use for this request. */
  readonly model: string;
  /** The user-provided API key. Never persisted or logged. */
  readonly apiKey: string;
}

/**
 * Provider-agnostic AI adapter interface.
 * Each supported provider (Gemini, Claude) implements this interface.
 * Adapters are instantiated per request and must not store the API key beyond
 * the lifetime of a single analyzeBills call.
 */
export interface AiAdapter {
  /** The provider this adapter handles. */
  readonly provider: AiProvider;

  /**
   * Analyzes the provided bills and returns a ranked list sorted by relevance
   * to the user's stated context.
   *
   * @param input - Bills, user context, model ID, and transient API key.
   * @returns A promise that resolves to the ranked AI analysis output.
   */
  analyzeBills(input: AnalyzeBillsInput): Promise<AiAnalysisOutput>;
}
