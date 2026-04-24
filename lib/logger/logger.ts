/**
 * Keys whose values are automatically redacted from log output.
 *
 * Prevents accidental exposure of credentials or tokens in server logs.
 */
const REDACTED_KEYS = new Set([
  "apiKey",
  "aiKey",
  "key",
  "token",
  "secret",
  "password",
  "authorization",
]);

/**
 * Returns a shallow copy of `context` with sensitive values replaced by
 * the string `"[REDACTED]"`.
 *
 * Only top-level keys are inspected — nested objects are left as-is.
 *
 * @param context - Arbitrary key-value pairs to sanitize.
 * @returns A new object with sensitive values redacted.
 */
const redactContext = (
  context: Record<string, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    result[key] = REDACTED_KEYS.has(key) ? "[REDACTED]" : value;
  }
  return result;
};

/**
 * Structured server-side logger.
 *
 * Writes to `stdout`/`stderr` so entries are captured by the host runtime
 * (e.g. CloudWatch on AWS App Runner, Vercel log drains, or local terminal).
 * Log output is never sent to the browser.
 *
 * Log levels:
 * - `error` — unexpected failures that likely indicate a bug or infrastructure
 *   problem (e.g. unhandled exceptions, malformed AI responses, network errors).
 * - `warn` — expected operational conditions that are not bugs but warrant
 *   monitoring (e.g. auth failures, rate limits, model overload).
 */
export const logger = {
  /**
   * Logs an error-level event.
   *
   * @param message - Short description of what went wrong.
   * @param context - Optional structured key-value pairs for diagnostics.
   *   Sensitive keys are automatically redacted.
   */
  error: (message: string, context?: Record<string, unknown>): void => {
    if (context) {
      console.error("[ERROR]", message, redactContext(context));
    } else {
      console.error("[ERROR]", message);
    }
  },

  /**
   * Logs a warning-level event.
   *
   * @param message - Short description of the condition.
   * @param context - Optional structured key-value pairs for diagnostics.
   *   Sensitive keys are automatically redacted.
   */
  warn: (message: string, context?: Record<string, unknown>): void => {
    if (context) {
      console.warn("[WARN]", message, redactContext(context));
    } else {
      console.warn("[WARN]", message);
    }
  },
};
