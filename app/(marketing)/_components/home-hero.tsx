import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";

/**
 * Hero section for the marketing home page.
 *
 * Shows sign-in and sign-up actions for unauthenticated visitors, and an
 * "Open search" link for users who are already signed in.
 */
export const HomeHero = () => {
  return (
    <main className="mx-auto flex flex-1 flex-col items-center justify-center px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Advocata</h1>
      <p className="mt-4 text-center text-zinc-600 dark:text-zinc-300">
        An application for legislative search and AI analysis.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Show when="signed-out">
          <SignInButton forceRedirectUrl="/search">
            <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton forceRedirectUrl="/search">
            <button className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200">
              Sign up
            </button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <Link
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            href="/search"
            prefetch={false}
          >
            Open search
          </Link>
        </Show>
      </div>
    </main>
  );
};
