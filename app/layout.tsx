import type { Metadata } from "next";

import "./globals.css";
import AppHeader from "./_components/app-header";
import ClerkThemeProvider from "./clerk-theme-provider";

export const metadata: Metadata = {
  title: "Advocata",
  description: "AI powered legislative analysis application",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

/**
 * Root layout for all routes. Provides the global header, page background,
 * and Clerk session context.
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <ClerkThemeProvider>
          <AppHeader />
          {children}
        </ClerkThemeProvider>
      </body>
    </html>
  );
}
