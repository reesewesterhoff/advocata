"use client";

import { AiInterpretationTable } from "../_components/ai-interpretation-table";
import { RawDataTable } from "../_components/raw-data-table";
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Legislative Search</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Configure your LegiScan filters and AI settings, then submit to run search and analysis.
        </p>
      </section>

      <SearchForm stage={formStage} onSubmit={submit} />

      {search.stage !== "idle" ? (
        <RawDataTable bills={search.bills} error={search.error} stage={search.stage} />
      ) : null}
      {search.stage === "success" ? (
        <AiInterpretationTable
          bills={search.bills}
          error={analysis.error}
          rankings={analysis.rankings}
          stage={analysis.stage}
        />
      ) : null}
    </main>
  );
};

export default SearchPage;
