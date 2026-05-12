import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { NormalizedBill } from "@/lib/domain";
import { RawDataTable } from "./raw-data-table";

/**
 * Creates a normalized bill fixture for table tests.
 *
 * @param overrides - Optional bill field overrides.
 * @returns A complete normalized bill.
 */
const makeBill = (overrides: Partial<NormalizedBill> = {}): NormalizedBill => ({
  billId: 1,
  billNumber: "HB 10",
  title: "School Meals Access",
  description: "Expands school meal access for students.",
  status: 1,
  statusDate: "2026-03-10",
  url: "https://legiscan.com/CA/bill/HB10/2026",
  textUrl: "https://legiscan.com/CA/text/HB10/2026",
  state: "CA",
  ...overrides,
});

/**
 * Returns the rendered data rows from the table body.
 *
 * @returns Data row elements without the header row.
 */
const getDataRows = () =>
  screen.getAllByRole("row").filter((row) => within(row).queryAllByRole("cell").length > 0);

/**
 * Returns the data row containing a bill number.
 *
 * @param billNumber - Bill number rendered in the first data cell.
 * @returns Matching table row.
 */
const getRowByBillNumber = (billNumber: string): HTMLElement => {
  const row = getDataRows().find((dataRow) => within(dataRow).queryByText(billNumber));

  if (!row) {
    throw new Error(`Could not find row for bill number ${billNumber}`);
  }

  return row;
};

describe("RawDataTable", () => {
  it("renders a pending state while bills are loading", () => {
    render(<RawDataTable bills={[]} error={null} stage="pending" />);

    expect(screen.getByRole("status")).toHaveTextContent("Fetching bills from LegiScan...");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders an error state when the search fails", () => {
    render(<RawDataTable bills={[]} error="Something went wrong." stage="error" />);

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders an empty state when no bills are present", () => {
    render(<RawDataTable bills={[]} error={null} stage="success" />);

    expect(screen.getByText("LegiScan Data")).toBeInTheDocument();
    expect(screen.getByText("No bills matched this search.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders normalized getBill fields and derived text links", () => {
    render(
      <RawDataTable
        bills={[
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
        ]}
        error={null}
        stage="success"
      />
    );

    const houseBillRow = getRowByBillNumber("HB 10");

    expect(within(houseBillRow).getByText("School Meals Access")).toBeInTheDocument();
    expect(within(houseBillRow).getByText("Introduced")).toBeInTheDocument();
    expect(within(houseBillRow).getByText("2026-03-10")).toBeInTheDocument();
    expect(
      within(houseBillRow).getByText("Expands school meal access for students.")
    ).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();

    expect(within(houseBillRow).getByRole("link", { name: "View bill" })).toHaveAttribute(
      "href",
      "https://legiscan.com/CA/bill/HB10/2026"
    );
    expect(screen.getByRole("link", { name: "View text" })).toHaveAttribute(
      "href",
      "https://legiscan.com/CA/text/HB10/2026"
    );
  });

  it("defaults to status date descending and sorts rows when headers are selected", async () => {
    const user = userEvent.setup();

    render(
      <RawDataTable
        bills={[
          makeBill({
            billId: 1,
            billNumber: "HB 10",
            status: 4,
            statusDate: "2026-03-10",
          }),
          makeBill({
            billId: 2,
            billNumber: "HB 2",
            status: 1,
            statusDate: "2026-01-15",
          }),
          makeBill({
            billId: 3,
            billNumber: "SB 1",
            status: 6,
            statusDate: "2026-05-20",
          }),
        ]}
        error={null}
        stage="success"
      />
    );

    expect(within(getDataRows()[0]).getByText("SB 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bill Number" }));

    expect(within(getDataRows()[0]).getByText("HB 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Status" }));

    expect(within(getDataRows()[0]).getByText("Introduced")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Status Date" }));

    expect(within(getDataRows()[0]).getByText("2026-01-15")).toBeInTheDocument();
  });

  it("does not render sort controls for non-sortable columns", () => {
    render(<RawDataTable bills={[makeBill()]} error={null} stage="success" />);

    expect(screen.queryByRole("button", { name: /Title/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Description/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bill Link/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bill Text Link/ })).not.toBeInTheDocument();
  });
});
