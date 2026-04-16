/**
 * Structured error codes for AI adapter infrastructure failures.
 * Consumers switch on these codes to produce targeted HTTP responses.
 */
export const AI_ADAPTER_ERROR_CODES = {
  /** The provider rejected the request due to an invalid or expired API key. */
  AUTH_ERROR: "AI_ADAPTER_AUTH_ERROR",
  /** A network-level failure occurred before a response was received. */
  NETWORK_ERROR: "AI_ADAPTER_NETWORK_ERROR",
  /** The provider returned an unexpected non-network error. */
  PROVIDER_ERROR: "AI_ADAPTER_PROVIDER_ERROR",
} as const;

/** A structured error code string from the AI adapter layer. */
export type AiAdapterErrorCode =
  (typeof AI_ADAPTER_ERROR_CODES)[keyof typeof AI_ADAPTER_ERROR_CODES];

/**
 * Error thrown by AI adapters for infrastructure failures (auth, network,
 * provider-side errors). Carries a structured `code` field for programmatic
 * handling by the route layer.
 *
 * Note: policy-level failures (DISALLOWED_REQUEST, CONTEXT_WINDOW_EXCEEDED,
 * INVALID_RESPONSE) are returned as `AiAnalysisOutput.error` values, not thrown.
 */
export class AiAdapterError extends Error {
  /** Structured code identifying the failure category. */
  readonly code: AiAdapterErrorCode;

  /**
   * @param code - Structured error code identifying the failure category.
   * @param message - Human-readable description of the failure.
   * @param cause - The underlying error that triggered this failure, if any.
   */
  constructor(code: AiAdapterErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "AiAdapterError";
    this.code = code;
  }
}
