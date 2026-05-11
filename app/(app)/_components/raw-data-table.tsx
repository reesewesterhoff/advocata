"use client";

import { useMemo, useState } from "react";
import type { NormalizedBill } from "@/lib/domain";
import { formatBillStatus } from "@/lib/domain";
import type { PhaseStage } from "../_hooks/use-bill-analysis-pipeline";
import { useExpandedRows } from "../_hooks/use-expanded-rows";

/** Columns available for sorting the raw data table. */
type SortColumn = "billNumber" | "status" | "statusDate";

/** Sort direction for a table column. */
type SortDirection = "asc" | "desc";

/** Current sorting state for the raw data table. */
type SortState = {
  /** Column currently used for sorting. */
  readonly column: SortColumn;
  /** Direction currently used for sorting. */
  readonly direction: SortDirection;
};

/** Props accepted by `RawDataTable`. */
type RawDataTableProps = {
  /** Normalized LegiScan bills to display. */
  readonly bills: NormalizedBill[];
  /** Current lifecycle stage of the LegiScan search phase. */
  readonly stage: PhaseStage;
  /** User-facing search error, or null when no error is present. */
  readonly error: string | null;
};

/** Metadata for a sortable raw table header. */
type HeaderDefinition = {
  /** Stable key for the rendered table column. */
  readonly key: string;
  /** Human-readable column label. */
  readonly label: string;
  /** Normalized bill field used when this column is sortable. */
  readonly sortColumn?: SortColumn;
};

const HEADERS: readonly HeaderDefinition[] = [
  { key: "billNumber", label: "Bill Number", sortColumn: "billNumber" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status", sortColumn: "status" },
  { key: "statusDate", label: "Status Date", sortColumn: "statusDate" },
  { key: "description", label: "Description" },
  { key: "url", label: "Bill Link" },
  { key: "textUrl", label: "Bill Text Link" },
];

/**
 * Compares two normalized bills for the selected column and direction.
 *
 * @param first - First bill to compare.
 * @param second - Second bill to compare.
 * @param sort - Current sort settings.
 * @returns A negative, positive, or zero sort value.
 */
const compareBills = (
  first: NormalizedBill,
  second: NormalizedBill,
  sort: SortState
): number => {
  const firstValue = first[sort.column];
  const secondValue = second[sort.column];

  const result =
    typeof firstValue === "number" && typeof secondValue === "number"
      ? firstValue - secondValue
      : String(firstValue).localeCompare(String(secondValue), undefined, {
          numeric: true,
          sensitivity: "base",
        });

  return sort.direction === "asc" ? result : -result;
};

/**
 * Renders the raw LegiScan results table from normalized getBill data.
 *
 * @param props - See `RawDataTableProps`.
 */
export const RawDataTable = ({ bills, stage, error }: RawDataTableProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sort, setSort] = useState<SortState>({ column: "statusDate", direction: "desc" });
  const { expandedIds: expandedBillIds, toggleRow } = useExpandedRows();

  const sortedBills = useMemo(
    () => [...bills].sort((first, second) => compareBills(first, second, sort)),
    [bills, sort]
  );

  /**
   * Updates sorting for the selected column, toggling direction when the
   * current column is selected again.
   *
   * @param column - Column selected by the user.
   */
  const updateSort = (column: SortColumn) => {
    setSort((current) =>
      current?.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" }
    );
  };


  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <button
        aria-expanded={!isCollapsed}
        className="flex w-full cursor-pointer items-center justify-between p-4 text-left"
        type="button"
        onClick={() => setIsCollapsed((c) => !c)}
      >
        <span className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
          LegiScan Data
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
              Fetching bills from LegiScan...
            </div>
          ) : null}

          {stage === "error" ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {error ?? "LegiScan search failed. Please try again."}
            </div>
          ) : null}

          {stage === "success" && bills.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              No bills matched this search.
            </div>
          ) : null}

          {stage === "success" && bills.length > 0 ? (
            <div className="max-h-128 overflow-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
                <caption className="sr-only">LegiScan Search Results</caption>
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    {HEADERS.map((header) => {
                      const sortColumn = header.sortColumn;

                      return (
                        <th
                          key={header.key}
                          aria-sort={
                            sortColumn
                              ? sort?.column === sortColumn
                                ? sort.direction === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                              : undefined
                          }
                          className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                          scope="col"
                        >
                          {sortColumn ? (
                            <button
                              className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                              type="button"
                              onClick={() => updateSort(sortColumn)}
                            >
                              {header.label}
                              <span aria-hidden="true">
                                {sort?.column === sortColumn
                                  ? sort.direction === "asc"
                                    ? "↑"
                                    : "↓"
                                  : "-"}
                              </span>
                            </button>
                          ) : (
                            header.label
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {sortedBills.map((bill) => {
                    const isExpanded = expandedBillIds.has(bill.billId);

                    return (
                      <tr
                        key={bill.billId}
                        aria-expanded={isExpanded}
                        className="cursor-pointer align-top hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none dark:hover:bg-zinc-900 dark:focus:bg-zinc-900"
                        tabIndex={0}
                        onClick={() => toggleRow(bill.billId)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleRow(bill.billId);
                          }
                        }}
                      >
                        <td className="whitespace-nowrap px-3 py-3 font-medium">
                          {bill.billNumber}
                        </td>
                        <td className="min-w-64 px-3 py-3">
                          <p className={isExpanded ? undefined : "line-clamp-2"}>{bill.title}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {formatBillStatus(bill.status)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">{bill.statusDate}</td>
                        <td className="min-w-80 px-3 py-3 text-zinc-700 dark:text-zinc-300">
                          <p className={isExpanded ? undefined : "line-clamp-2"}>
                            {bill.description}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <a
                            className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                            href={bill.url}
                            rel="noreferrer"
                            target="_blank"
                            onClick={(event) => event.stopPropagation()}
                          >
                            View bill
                          </a>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {bill.textUrl ? (
                            <a
                              className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                              href={bill.textUrl}
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
