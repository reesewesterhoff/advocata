/**
 * Structured error codes for LegiScan client failures.
 * Consumers can switch on these codes for targeted error handling.
 */
export const LEGISCAN_ERROR_CODES = {
  /** The LegiScan API returned a non-OK status in the response body. */
  API_ERROR: "LEGISCAN_API_ERROR",
  /** The request to LegiScan exceeded the configured timeout. */
  TIMEOUT: "LEGISCAN_TIMEOUT",
  /** A network-level failure occurred before a response was received. */
  NETWORK_ERROR: "LEGISCAN_NETWORK_ERROR",
  /** The LegiScan response could not be parsed or did not match the expected shape. */
  INVALID_RESPONSE: "LEGISCAN_INVALID_RESPONSE",
} as const;

/** A structured error code string from the LegiScan client. */
export type LegiScanErrorCode =
  (typeof LEGISCAN_ERROR_CODES)[keyof typeof LEGISCAN_ERROR_CODES];

/**
 * Error thrown by the LegiScan client for all API-level and network failures.
 * Carries a structured `code` field for programmatic handling.
 */
export class LegiScanError extends Error {
  /** Structured code identifying the failure category. */
  readonly code: LegiScanErrorCode;

  /**
   * @param code - Structured error code identifying the failure category.
   * @param message - Human-readable description of the failure.
   * @param cause - The underlying error that triggered this failure, if any.
   */
  constructor(code: LegiScanErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "LegiScanError";
    this.code = code;
  }
}
