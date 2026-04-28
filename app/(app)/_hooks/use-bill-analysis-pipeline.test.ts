import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBillAnalysisPipeline } from "./use-bill-analysis-pipeline";

/**
 * Builds a lightweight fetch response mock object.
 *
 * @param ok - Indicates if the response should be treated as successful.
 * @param jsonBody - JSON payload returned by `response.json()`.
 * @returns A mock response compatible with the hook's fetch usage.
 */
const createMockResponse = (ok: boolean, jsonBody: unknown): Response =>
  ({
    ok,
    json: vi.fn().mockResolvedValue(jsonBody),
  }) as unknown as Response;

/** Minimal valid form values used across tests. */
const validValues = {
  state: "CA" as const,
  query: "education funding",
  aiProvider: "gemini" as const,
  aiModel: "gemini-2.5-flash",
  aiKey: "test-key",
  userContext: "I work in education policy and focus on K-12 funding bills.",
};

const mockBills = [
  {
    billId: 1,
    billNumber: "HB 1",
    title: "Education Funding Act",
    description: "Increases per-pupil funding.",
    status: 1,
    statusDate: "2026-04-01",
    url: "https://example.com/bill/1",
    textUrl: null,
    state: "CA",
  },
];

const mockRankings = [
  {
    billId: 1,
    relevanceScore: 95,
    relevanceReason: "Directly addresses K-12 funding.",
  },
];

describe("useBillAnalysisPipeline", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("starts with both phases idle and no results", () => {
    const { result } = renderHook(() => useBillAnalysisPipeline());

    expect(result.current.search.stage).toBe("idle");
    expect(result.current.search.error).toBeNull();
    expect(result.current.search.bills).toHaveLength(0);
    expect(result.current.analysis.stage).toBe("idle");
    expect(result.current.analysis.error).toBeNull();
    expect(result.current.analysis.rankings).toHaveLength(0);
  });

  it("resolves both phases to success with correct results", async () => {
    fetchMock
      .mockResolvedValueOnce(createMockResponse(true, { bills: mockBills }))
      .mockResolvedValueOnce(
        createMockResponse(true, { rankings: mockRankings }),
      );

    const { result } = renderHook(() => useBillAnalysisPipeline());

    await act(() => result.current.submit(validValues));

    expect(result.current.search.stage).toBe("success");
    expect(result.current.search.error).toBeNull();
    expect(result.current.search.bills).toEqual(mockBills);
    expect(result.current.analysis.stage).toBe("success");
    expect(result.current.analysis.error).toBeNull();
    expect(result.current.analysis.rankings).toEqual(mockRankings);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("errors the search phase and leaves analysis idle when /api/search fails", async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse(false, { error: "LegiScan is unavailable." }),
    );

    const { result } = renderHook(() => useBillAnalysisPipeline());

    await act(() => result.current.submit(validValues));

    expect(result.current.search.stage).toBe("error");
    expect(result.current.search.error).toBe("LegiScan is unavailable.");
    expect(result.current.search.bills).toHaveLength(0);
    expect(result.current.analysis.stage).toBe("idle");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("errors the analysis phase but preserves search bills when /api/analyze fails", async () => {
    fetchMock
      .mockResolvedValueOnce(createMockResponse(true, { bills: mockBills }))
      .mockResolvedValueOnce(
        createMockResponse(false, {
          error: "The provided API key is invalid.",
        }),
      );

    const { result } = renderHook(() => useBillAnalysisPipeline());

    await act(() => result.current.submit(validValues));

    expect(result.current.search.stage).toBe("success");
    expect(result.current.search.bills).toEqual(mockBills);
    expect(result.current.analysis.stage).toBe("error");
    expect(result.current.analysis.error).toBe(
      "The provided API key is invalid.",
    );
    expect(result.current.analysis.rankings).toHaveLength(0);
  });

  it("errors the search phase on a network failure during search", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useBillAnalysisPipeline());

    await act(() => result.current.submit(validValues));

    expect(result.current.search.stage).toBe("error");
    expect(result.current.search.error).toBe(
      "A network error occurred while contacting LegiScan.",
    );
    expect(result.current.analysis.stage).toBe("idle");
  });

  it("errors the analysis phase on a network failure during analysis", async () => {
    fetchMock
      .mockResolvedValueOnce(createMockResponse(true, { bills: mockBills }))
      .mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useBillAnalysisPipeline());

    await act(() => result.current.submit(validValues));

    expect(result.current.search.stage).toBe("success");
    expect(result.current.search.bills).toEqual(mockBills);
    expect(result.current.analysis.stage).toBe("error");
    expect(result.current.analysis.error).toBe(
      "A network error occurred while contacting the AI provider.",
    );
  });

  it("clears both phases on a new submission", async () => {
    fetchMock
      .mockResolvedValueOnce(createMockResponse(true, { bills: mockBills }))
      .mockResolvedValueOnce(
        createMockResponse(true, { rankings: mockRankings }),
      )
      .mockResolvedValueOnce(
        createMockResponse(false, { error: "Search failed." }),
      );

    const { result } = renderHook(() => useBillAnalysisPipeline());

    await act(() => result.current.submit(validValues));
    expect(result.current.search.stage).toBe("success");
    expect(result.current.search.bills).toEqual(mockBills);
    expect(result.current.analysis.stage).toBe("success");
    expect(result.current.analysis.rankings).toEqual(mockRankings);

    await act(() => result.current.submit(validValues));
    expect(result.current.search.stage).toBe("error");
    expect(result.current.search.bills).toHaveLength(0);
    expect(result.current.analysis.stage).toBe("idle");
    expect(result.current.analysis.rankings).toHaveLength(0);
  });
});
