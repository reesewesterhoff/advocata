import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

/**
 * Global application header rendered on every route.
 *
 * The brand link routes authenticated users to `/search` and unauthenticated
 * users to `/` to avoid landing them on a protected route.
 */
const AppHeader = () => {
  const HeaderLink = (href: string) => <Link className="font-semibold text-xl" href={href}>Advocata</Link>;

  return (
    <header className="border-b border-zinc-100 bg-zinc-50 py-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6">
        {/* If signed in, route to the search link, otherwise route to the home link */}
        <Show when="signed-in" fallback={HeaderLink("/")}>
          {HeaderLink("/search")}
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  );
};

export default AppHeader;
