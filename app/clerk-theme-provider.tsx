"use client";

import { useSyncExternalStore } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";

type ClerkThemeProviderProps = Readonly<{
  children: React.ReactNode;
}>;

/**
 * Returns the `prefers-color-scheme: dark` MediaQueryList.
 * Evaluated lazily so it is never called during SSR where `window` is absent.
 *
 * @returns The MediaQueryList for the dark color scheme preference.
 */
function getDarkMQ(): MediaQueryList {
  return window.matchMedia("(prefers-color-scheme: dark)");
}

/**
 * Required by `useSyncExternalStore` to register and clean up the
 * color-scheme change listener. Called once on mount.
 *
 * @param callback - Notifies React when the OS color scheme changes.
 * @returns Cleanup function that removes the listener on unmount.
 */
function subscribe(callback: () => void): () => void {
  const mq = getDarkMQ();
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/**
 * Wraps `ClerkProvider` with OS color-scheme detection.
 *
 * `useSyncExternalStore` reads the current `prefers-color-scheme` preference
 * on the client and subscribes to future OS changes. The third argument
 * (`() => null`) is the server snapshot: the server has no access to the OS
 * preference, so `isDark` is `null` during SSR and before hydration. While
 * `null`, a spinner is shown instead of rendering children, which prevents a
 * flash of the wrong Clerk theme on first paint.
 */
const ClerkThemeProvider = ({ children }: ClerkThemeProviderProps) => {
  const isDark = useSyncExternalStore(subscribe, () => getDarkMQ().matches, () => null);

  if (isDark === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    );
  }

  return (
    <ClerkProvider appearance={{ theme: isDark ? dark : undefined }}>
      {children}
    </ClerkProvider>
  );
};

export default ClerkThemeProvider;
