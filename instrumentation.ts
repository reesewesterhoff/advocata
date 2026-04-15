import { validateEnv } from "@/lib/env";

/**
 * Next.js instrumentation hook. Runs once when the server process starts,
 * before any requests are handled.
 *
 * Validates that all required environment variables are present so the
 * application fails fast on misconfiguration rather than at request time.
 */
export function register(): void {
  validateEnv();
}
