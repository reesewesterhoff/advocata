"use client";

import { useState } from "react";

/** Return value of `useExpandedRows`. */
type UseExpandedRowsResult = {
  /** Set of row IDs whose content is currently expanded. */
  readonly expandedIds: ReadonlySet<number>;
  /**
   * Toggles the expanded state for a single row.
   *
   * @param id - Numeric row ID to toggle.
   */
  readonly toggleRow: (id: number) => void;
};

/**
 * Manages the expanded/collapsed state for a set of table rows identified
 * by numeric IDs.
 *
 * @returns The current set of expanded IDs and a stable toggle callback.
 */
export const useExpandedRows = (): UseExpandedRowsResult => {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(() => new Set());

  const toggleRow = (id: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return { expandedIds, toggleRow };
};
