import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchForm } from "./search-form";
import type { RequestStage } from "../_hooks/use-legiscan-search";

/**
 * Builds the required props for `SearchForm` with sensible defaults.
 *
 * @param overrides - Optional prop overrides.
 * @returns A complete `SearchForm` props object.
 */
const buildProps = (overrides?: {
  stage?: RequestStage;
  onSubmit?: ReturnType<typeof vi.fn>;
}) => ({
  stage: overrides?.stage ?? ("idle" as RequestStage),
  onSubmit: overrides?.onSubmit ?? vi.fn().mockResolvedValue(undefined),
});

describe("SearchForm", () => {
  it("switches model options when the AI provider changes", async () => {
    const user = userEvent.setup();

    render(<SearchForm {...buildProps()} />);

    const modelSelect = screen.getByLabelText("AI Model");
    expect(modelSelect).toHaveValue("gemini-2.5-flash");
    expect(screen.getByRole("option", { name: "Gemini 2.5 Pro" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("AI Engine"), "claude");

    expect(modelSelect).toHaveValue("claude-sonnet-4-6");
    expect(screen.getByRole("option", { name: "Claude Opus 4.6" })).toBeInTheDocument();
  });

  it("shows field-level errors and blocks onSubmit when required fields are missing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<SearchForm {...buildProps({ onSubmit })} />);

    await user.click(screen.getByRole("button", { name: "Submit Search" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Search query is required.")).toBeInTheDocument();
    expect(screen.getByText("API key is required.")).toBeInTheDocument();
    expect(screen.getByText("User context is required.")).toBeInTheDocument();
  });

  it("treats whitespace-only required fields as invalid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<SearchForm {...buildProps({ onSubmit })} />);

    await user.type(screen.getByLabelText("LegiScan Search"), "   ");
    await user.type(screen.getByLabelText("AI API Key"), "   ");
    await user.type(screen.getByLabelText("AI User Context"), "   ");
    await user.click(screen.getByRole("button", { name: "Submit Search" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Search query is required.")).toBeInTheDocument();
    expect(screen.getByText("API key is required.")).toBeInTheDocument();
    expect(screen.getByText("User context is required.")).toBeInTheDocument();
  });

  it("calls onSubmit with validated values when all fields are filled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<SearchForm {...buildProps({ onSubmit })} />);

    await user.type(screen.getByLabelText("LegiScan Search"), "school meals");
    await user.type(screen.getByLabelText("AI API Key"), "test-key");
    await user.type(
      screen.getByLabelText("AI User Context"),
      "I advocate for better food access programs in public schools."
    );

    await user.click(screen.getByRole("button", { name: "Submit Search" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "school meals",
        aiKey: "test-key",
        aiProvider: "gemini",
      })
    );
  });

  it("disables fields and shows loading labels while submitting", () => {
    render(<SearchForm {...buildProps({ stage: "searching" })} />);

    expect(screen.getByRole("button")).toHaveTextContent("Searching LegiScan...");
    expect(screen.getByLabelText("LegiScan Search")).toBeDisabled();
    expect(screen.getByLabelText("AI API Key")).toBeDisabled();
  });
});
