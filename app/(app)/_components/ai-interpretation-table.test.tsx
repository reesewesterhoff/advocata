import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import type { AiRankingRow, NormalizedBill } from "@/lib/domain";
import { AiInterpretationTable } from "./ai-interpretation-table";

/**
 * Creates a normalized bill fixture for AI table tests.
 *
 * @param overrides - Optional bill field overrides.
 * @returns A complete normalized bill.
 */
const makeBill = (overrides: Partial<NormalizedBill> = {}): NormalizedBill => ({
  billId: 1,
  billNumber: "HB 10",
  title: "School Meals Access",
  description:
    "Expands school meal access for students by increasing reimbursement rates and broadening eligibility across public schools.",
  status: 1,
  statusDate: "2026-03-10",
  url: "https://legiscan.com/CA/bill/HB10/2026",
  textUrl: "https://legiscan.com/CA/text/HB10/2026",
  state: "CA",
  ...overrides,
});

/**
 * Creates an AI ranking fixture for table tests.
 *
 * @param overrides - Optional ranking field overrides.
 * @returns A complete AI ranking row.
 */
const makeRanking = (overrides: Partial<AiRankingRow> = {}): AiRankingRow => ({
  billId: 1,
  relevanceScore: 95,
  relevanceReason: "Directly addresses K-12 nutrition policy.",
  ...overrides,
});

/**
 * Returns the rendered data rows from the AI table body.
 *
 * @returns Data row elements without the header row.
 */
const getDataRows = () =>
  screen.getAllByRole("row").filter((row) => within(row).queryAllByRole("cell").length > 0);

/**
 * Renders the AI interpretation table with sensible defaults.
 *
 * @param overrides - Optional prop overrides for the rendered table.
 */
const renderTable = (
  overrides: Partial<ComponentProps<typeof AiInterpretationTable>> = {}
) => {
  const bills = [
    makeBill(),
    makeBill({
      billId: 2,
      billNumber: "SB 4",
      title: "Housing Permits",
      description: "Updates local housing permit timelines.",
      status: 4,
      statusDate: "2026-04-01",
      url: "https://legiscan.com/NY/bill/SB4/2026",
      textUrl: null,
      state: "NY",
    }),
  ];

  const rankings = [
    makeRanking({ billId: 2, relevanceScore: 88, relevanceReason: "Relevant to local zoning." }),
    makeRanking(),
  ];

  render(
    <AiInterpretationTable
      bills={bills}
      error={null}
      rankings={rankings}
      stage="success"
      {...overrides}
    />
  );
};

describe("AiInterpretationTable", () => {
  it("renders pending and error states", () => {
    const { rerender } = render(
      <AiInterpretationTable bills={[]} error={null} rankings={[]} stage="pending" />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Analyzing bills with AI...");

    rerender(
      <AiInterpretationTable
        bills={[]}
        error="The provided API key is invalid."
        rankings={[]}
        stage="error"
      />
    );

    expect(screen.getByText("The provided API key is invalid.")).toBeInTheDocument();
  });

  it("renders AI rankings in ranked order with merged getBill fields", () => {
    renderTable();

    const rows = getDataRows();

    expect(within(rows[0]).getByText("88")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Housing Permits")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Passed")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Unavailable")).toBeInTheDocument();

    expect(within(rows[1]).getByText("95")).toBeInTheDocument();
    expect(within(rows[1]).getByText("School Meals Access")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Introduced")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("link", { name: "View bill" })).toHaveAttribute(
      "href",
      "https://legiscan.com/CA/bill/HB10/2026"
    );
    expect(within(rows[1]).getByRole("link", { name: "View text" })).toHaveAttribute(
      "href",
      "https://legiscan.com/CA/text/HB10/2026"
    );
  });

  it("toggles description expansion when a row is clicked", async () => {
    const user = userEvent.setup();
    renderTable();

    const description = screen.getByText(/Expands school meal access/);
    const row = description.closest("tr");

    if (!row) {
      throw new Error("Could not find AI interpretation row.");
    }

    expect(description).toHaveClass("line-clamp-3");
    expect(row).toHaveAttribute("aria-expanded", "false");

    await user.click(row);

    expect(description).not.toHaveClass("line-clamp-3");
    expect(row).toHaveAttribute("aria-expanded", "true");
  });

  it("surfaces unknown bill IDs returned by the AI", () => {
    renderTable({
      rankings: [makeRanking({ billId: 999 }), makeRanking()],
    });

    expect(screen.getByText("AI returned rankings for unknown bill IDs: 999.")).toBeInTheDocument();
    expect(screen.getByText("School Meals Access")).toBeInTheDocument();
  });
});
