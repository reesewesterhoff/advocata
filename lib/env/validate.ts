/**
 * Required server-side environment variables.
 * All entries must be present for the application to function correctly.
 */
const REQUIRED_ENV_VARS = [
  "LEGISCAN_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

/** A key name from the required environment variable set. */
type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

/**
 * Validates that all required environment variables are present and non-empty.
 * Call this once at application startup to fail fast on misconfiguration rather
 * than encountering cryptic errors at request time.
 *
 * @throws {Error} If any required environment variable is missing or empty.
 */
export function validateEnv(): void {
  const missing: string[] = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key],
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Check your .env file against .env.example.",
    );
  }
}

/**
 * Returns the validated required environment variables as a typed object.
 * Calls {@link validateEnv} internally, so it throws on misconfiguration.
 *
 * @returns An object containing all required environment variable values.
 * @throws {Error} If any required environment variable is missing or empty.
 */
export function getEnv(): Readonly<Record<RequiredEnvVar, string>> {
  validateEnv();
  return {
    LEGISCAN_API_KEY: process.env.LEGISCAN_API_KEY!,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL!,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN!,
  };
}
