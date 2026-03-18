type HomeHeroProps = Readonly<{
  title: string;
  description: string;
}>;

/**
 * Renders the centered hero content for the marketing home page.
 */
export const HomeHero = ({ title, description }: HomeHeroProps) => {
  return (
    <main className="mx-auto flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 text-center text-zinc-600 dark:text-zinc-300">
        {description}
      </p>
    </main>
  );
};
