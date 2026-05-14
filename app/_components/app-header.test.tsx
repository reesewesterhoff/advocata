import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@clerk/nextjs", () => ({
  Show: ({
    when,
    fallback,
    children,
  }: {
    when: string;
    fallback?: React.ReactNode;
    children: React.ReactNode;
  }) => {
    if (when === "signed-in") {
      return <>{isSignedIn ? children : fallback}</>;
    }
    return null;
  },
  UserButton: () => <button>UserButton</button>,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

/**
 * Controls the simulated Clerk auth state for each test.
 * Set before rendering to simulate signed-in or signed-out.
 */
let isSignedIn = false;

import AppHeader from "./app-header";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AppHeader", () => {
  describe("when signed out", () => {
    it("links the brand to the home page", () => {
      render(<AppHeader />);
      const link = screen.getByRole("link", { name: "Advocata" });
      expect(link).toHaveAttribute("href", "/");
    });

    it("does not render the UserButton", () => {
      render(<AppHeader />);
      expect(screen.queryByText("UserButton")).not.toBeInTheDocument();
    });
  });

  describe("when signed in", () => {
    beforeEach(() => {
      isSignedIn = true;
    });

    it("links the brand to the search page", () => {
      render(<AppHeader />);
      const link = screen.getByRole("link", { name: "Advocata" });
      expect(link).toHaveAttribute("href", "/search");
    });

    it("renders the UserButton", () => {
      render(<AppHeader />);
      expect(screen.getByText("UserButton")).toBeInTheDocument();
    });
  });
});
