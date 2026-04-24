"use client";

import { SearchForm } from "../_components/search-form";
import type { RequestStage } from "../_hooks/use-bill-analysis-pipeline";
import { useBillAnalysisPipeline } from "../_hooks/use-bill-analysis-pipeline";

/**
 * Derives the single `RequestStage` the form needs for button labels and
 * disabled state from the two independent phase stages.
 *
 * @param searchStage - Current stage of the LegiScan search phase.
 * @param analysisStage - Current stage of the AI analysis phase.
 * @returns The combined form stage.
 */
const deriveFormStage = (
  searchStage: ReturnType<typeof useBillAnalysisPipeline>["search"]["stage"],
  analysisStage: ReturnType<typeof useBillAnalysisPipeline>["analysis"]["stage"]
): RequestStage => {
  if (searchStage === "pending") return "searching";
  if (analysisStage === "pending") return "analyzing";
  if (searchStage === "success" && analysisStage === "success") return "success";
  if (searchStage === "error" || analysisStage === "error") return "error";
  return "idle";
};

/**
 * Search page for the application route group.
 *
 * Each pipeline phase (LegiScan search, AI analysis) tracks its own stage
 * and error independently. The raw data table renders as soon as the search
 * phase resolves; the AI table renders when analysis resolves. A failure in
 * one phase never clears the results of the other.
 */
const SearchPage = () => {
  const { search, analysis, submit } = useBillAnalysisPipeline();
  const formStage = deriveFormStage(search.stage, analysis.stage);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Legislative Search</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Configure your LegiScan filters and AI settings, then submit to run search and analysis.
        </p>
      </section>

      <SearchForm stage={formStage} onSubmit={submit} />

      {/* Just a placeholder for now to see the search and analysis stages */}
      {search.stage !== "idle" && (
        <section className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
            Request Status
          </h2>

          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">LegiScan Search</p>
            <p className="text-sm">
              {search.stage === "pending" && "Fetching bills from LegiScan…"}
              {search.stage === "success" && `Found ${search.bills.length} bills.`}
              {search.stage === "error" && "Search failed."}
            </p>
            {search.error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {search.error}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">AI Analysis</p>
            <p className="text-sm">
              {analysis.stage === "idle" && "Waiting for search to complete…"}
              {analysis.stage === "pending" && "Running AI relevance analysis…"}
              {analysis.stage === "success" && `Ranked ${analysis.rankings.length} bills.`}
              {analysis.stage === "error" && "Analysis failed."}
            </p>
            {analysis.error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {analysis.error}
              </p>
            ) : null}
          </div>
        </section>
      )}

      {/* Phase 5: <RawDataTable bills={search.bills} /> */}
      {/* Phase 6: <AiInterpretationTable bills={search.bills} rankings={analysis.rankings} /> */}
    </main>
  );
};

export default SearchPage;
