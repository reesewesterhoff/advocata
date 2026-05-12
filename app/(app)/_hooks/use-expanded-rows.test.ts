import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useExpandedRows } from "./use-expanded-rows";

describe("useExpandedRows", () => {
  it("initializes with no expanded rows", () => {
    const { result } = renderHook(() => useExpandedRows());

    expect(result.current.expandedIds.size).toBe(0);
  });

  it("expands a row when toggleRow is called for an unexpanded id", () => {
    const { result } = renderHook(() => useExpandedRows());

    act(() => {
      result.current.toggleRow(1);
    });

    expect(result.current.expandedIds.has(1)).toBe(true);
  });

  it("collapses a row when toggleRow is called for an already expanded id", () => {
    const { result } = renderHook(() => useExpandedRows());

    act(() => {
      result.current.toggleRow(1);
    });

    act(() => {
      result.current.toggleRow(1);
    });

    expect(result.current.expandedIds.has(1)).toBe(false);
  });

  it("manages multiple rows independently", () => {
    const { result } = renderHook(() => useExpandedRows());

    act(() => {
      result.current.toggleRow(1);
      result.current.toggleRow(2);
    });

    expect(result.current.expandedIds.has(1)).toBe(true);
    expect(result.current.expandedIds.has(2)).toBe(true);

    act(() => {
      result.current.toggleRow(1);
    });

    expect(result.current.expandedIds.has(1)).toBe(false);
    expect(result.current.expandedIds.has(2)).toBe(true);
  });

  it("does not mutate the previous set reference when toggling", () => {
    const { result } = renderHook(() => useExpandedRows());

    act(() => {
      result.current.toggleRow(1);
    });

    const afterExpand = result.current.expandedIds;

    act(() => {
      result.current.toggleRow(1);
    });

    expect(result.current.expandedIds).not.toBe(afterExpand);
  });
});
