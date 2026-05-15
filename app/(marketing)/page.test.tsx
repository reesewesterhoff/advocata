import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  Show: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import HomePage from "./page";

describe("HomePage", () => {
  it("renders the application title", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "Advocata", level: 1 })
    ).toBeInTheDocument();
  });
});
