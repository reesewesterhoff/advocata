"use client";

import { useMemo, useState } from "react";
import type { AiInterpretationRow, AiRankingRow, NormalizedBill } from "@/lib/domain";
import { formatBillStatus } from "@/lib/domain";
import type { PhaseStage } from "../_hooks/use-bill-analysis-pipeline";
import { useExpandedRows } from "../_hooks/use-expanded-rows";

/** Props accepted by `AiInterpretationTable`. */
type AiInterpretationTableProps = {
  /** Normalized LegiScan bills returned by `/api/search`. */
  readonly bills: NormalizedBill[];
  /** AI rankings returned by `/api/analyze`, ordered most to least relevant. */
  readonly rankings: AiRankingRow[];
  /** Current lifecycle stage of the AI analysis phase. */
  readonly stage: PhaseStage;
  /** User-facing analysis error, or null when no error is present. */
  readonly error: string | null;
};

/** Result of merging AI rankings with normalized LegiScan bills. */
type MergedRankings = {
  /** Rows with both AI ranking data and normalized bill metadata. */
  readonly rows: AiInterpretationRow[];
  /** AI-referenced bill IDs that were not present in the search results. */
  readonly unknownBillIds: number[];
};

/**
 * Merges AI ranking rows with normalized bill metadata by `billId`.
 *
 * @param bills - Normalized bills returned by the LegiScan search phase.
 * @param rankings - AI rankings returned by the analysis phase.
 * @returns Ranked rows plus any AI-referenced bill IDs that cannot be matched.
 */
const mergeRankingsWithBills = (
  bills: readonly NormalizedBill[],
  rankings: readonly AiRankingRow[]
): MergedRankings => {
  const billsById = new Map(bills.map((bill) => [bill.billId, bill]));
  const rows: AiInterpretationRow[] = [];
  const unknownBillIds: number[] = [];

  for (const ranking of rankings) {
    const bill = billsById.get(ranking.billId);
    if (!bill) {
      unknownBillIds.push(ranking.billId);
      continue;
    }
    rows.push({ ...bill, ...ranking });
  }

  return { rows, unknownBillIds };
};

/**
 * Renders the AI-ranked interpretation table with expandable bill descriptions.
 *
 * @param props - See `AiInterpretationTableProps`.
 */
export const AiInterpretationTable = ({
  bills,
  rankings,
  stage,
  error,
}: AiInterpretationTableProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { expandedIds: expandedBillIds, toggleRow } = useExpandedRows();

  const { rows, unknownBillIds } = useMemo(
    () => mergeRankingsWithBills(bills, rankings),
    [bills, rankings]
  );


  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <button
        aria-expanded={!isCollapsed}
        className="flex w-full cursor-pointer items-center justify-between p-4 text-left"
        type="button"
        onClick={() => setIsCollapsed((c) => !c)}
      >
        <span className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
          AI Interpretation
        </span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
          Click to {isCollapsed ? "expand" : "collapse"}
          <span aria-hidden="true">{isCollapsed ? "▲" : "▼"}</span>
        </span>
      </button>

      {!isCollapsed ? (
        <div className="space-y-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
          {stage === "pending" ? (
            <div
              className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              role="status"
            >
              Analyzing bills with AI...
            </div>
          ) : null}

          {stage === "error" ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {error ?? "AI analysis failed. Please try again."}
            </div>
          ) : null}

          {stage === "success" && unknownBillIds.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
              AI returned rankings for unknown bill IDs: {unknownBillIds.join(", ")}.
            </div>
          ) : null}

          {stage === "success" && rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              No AI rankings are available for these bills.
            </div>
          ) : null}

          {stage === "success" && rows.length > 0 ? (
            <div className="max-h-128 overflow-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
                <caption className="sr-only">AI Ranked Bill Results</caption>
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th
                      className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                      scope="col"
                    >
                      Score
                    </th>
                    <th
                      className="min-w-72 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                      scope="col"
                    >
                      Relevance Reason
                    </th>
                    <th
                      className="min-w-72 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                      scope="col"
                    >
                      Title
                    </th>
                    <th
                      className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                      scope="col"
                    >
                      Status
                    </th>
                    <th
                      className="min-w-96 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                      scope="col"
                    >
                      Description
                    </th>
                    <th
                      className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                      scope="col"
                    >
                      Bill Link
                    </th>
                    <th
                      className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                      scope="col"
                    >
                      Bill Text Link
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {rows.map((row) => {
                    const isExpanded = expandedBillIds.has(row.billId);

                    return (
                      <tr
                        key={row.billId}
                        aria-expanded={isExpanded}
                        className="cursor-pointer align-top hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none dark:hover:bg-zinc-900 dark:focus:bg-zinc-900"
                        tabIndex={0}
                        onClick={() => toggleRow(row.billId)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleRow(row.billId);
                          }
                        }}
                      >
                        <td className="whitespace-nowrap px-3 py-3 font-semibold">
                          {row.relevanceScore}
                        </td>
                        <td className="min-w-72 px-3 py-3 text-zinc-700 dark:text-zinc-300">
                          <p className={isExpanded ? undefined : "line-clamp-2"}>
                            {row.relevanceReason}
                          </p>
                        </td>
                        <td className="min-w-72 px-3 py-3 font-medium">
                          <p className={isExpanded ? undefined : "line-clamp-2"}>{row.title}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {formatBillStatus(row.status)}
                        </td>
                        <td className="min-w-96 px-3 py-3 text-zinc-700 dark:text-zinc-300">
                          <p className={isExpanded ? undefined : "line-clamp-3"}>
                            {row.description}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <a
                            className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                            href={row.url}
                            rel="noreferrer"
                            target="_blank"
                            onClick={(event) => event.stopPropagation()}
                          >
                            View bill
                          </a>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {row.textUrl ? (
                            <a
                              className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                              href={row.textUrl}
                              rel="noreferrer"
                              target="_blank"
                              onClick={(event) => event.stopPropagation()}
                            >
                              View text
                            </a>
                          ) : (
                            <span className="text-zinc-500 dark:text-zinc-400">Unavailable</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
