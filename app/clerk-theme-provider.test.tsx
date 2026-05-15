import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="clerk-provider">{children}</div>
  ),
}));

vi.mock("@clerk/ui/themes", () => ({
  dark: { name: "dark" },
}));

// ---------------------------------------------------------------------------
// matchMedia helpers
// ---------------------------------------------------------------------------

/**
 * Installs a `window.matchMedia` stub that returns a controlled `matches`
 * value. Returns a cleanup function that restores the original.
 *
 * @param matches - Whether `prefers-color-scheme: dark` should match.
 * @returns Cleanup function restoring the original `matchMedia`.
 */
function stubMatchMedia(matches: boolean): () => void {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  return () => {
    window.matchMedia = original;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

import ClerkThemeProvider from "./clerk-theme-provider";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ClerkThemeProvider", () => {
  it("renders children inside ClerkProvider when the color scheme is light", () => {
    const cleanup = stubMatchMedia(false);

    render(
      <ClerkThemeProvider>
        <span>content</span>
      </ClerkThemeProvider>,
    );

    expect(screen.getByTestId("clerk-provider")).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();

    cleanup();
  });

  it("renders children inside ClerkProvider when the color scheme is dark", () => {
    const cleanup = stubMatchMedia(true);

    render(
      <ClerkThemeProvider>
        <span>content</span>
      </ClerkThemeProvider>,
    );

    expect(screen.getByTestId("clerk-provider")).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();

    cleanup();
  });

  // The null/spinner state is only reachable server-side: `useSyncExternalStore`
  // calls `getServerSnapshot` (which returns null) during SSR and then
  // `getSnapshot` after hydration. In jsdom, only `getSnapshot` is ever called,
  // so the spinner path cannot be exercised without mocking the entire React
  // module. Coverage of that branch is provided by visual/E2E testing instead.
});
