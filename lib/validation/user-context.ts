import { USER_CONTEXT_MAX_LENGTH } from "@/lib/domain/search";

/** Result of a user context validation check. */
export interface UserContextValidationResult {
  /** Whether the user context passed all validation checks. */
  readonly valid: boolean;
  /** Human-readable failure reason, or null when valid. */
  readonly reason: string | null;
}

/**
 * Lowercase substrings that indicate a potential prompt injection attempt.
 * Matched against the lowercased user context string.
 */
const INJECTION_PATTERNS: readonly string[] = [
  "ignore previous instructions",
  "ignore above instructions",
  "ignore all previous",
  "disregard previous",
  "disregard all instructions",
  "forget everything",
  "forget all previous",
  "reveal your system prompt",
  "reveal your instructions",
  "show your system prompt",
  "print your instructions",
  "you are now",
  "act as if you are",
  "pretend you are",
  "pretend to be",
  "override your instructions",
  "new instructions:",
  "end of instructions",
  "begin new task",
  "jailbreak",
];

/**
 * Validates a user-provided context string for length and content guardrails.
 *
 * Performs the following checks in order:
 * 1. The string must be non-empty.
 * 2. The string must not exceed `USER_CONTEXT_MAX_LENGTH` characters.
 * 3. The string must not contain known prompt injection patterns.
 *
 * @param userContext - The raw user context string to validate.
 * @returns A UserContextValidationResult indicating success or the failure reason.
 */
export const validateUserContext = (userContext: string): UserContextValidationResult => {
  if (!userContext || userContext.trim().length === 0) {
    return { valid: false, reason: "User context is required." };
  }

  if (userContext.length > USER_CONTEXT_MAX_LENGTH) {
    return {
      valid: false,
      reason: `User context must be ${USER_CONTEXT_MAX_LENGTH} characters or fewer.`,
    };
  }

  const lower = userContext.toLowerCase();
  for (const pattern of INJECTION_PATTERNS) {
    if (lower.includes(pattern)) {
      return {
        valid: false,
        reason:
          "User context contains disallowed content. Please describe your legislative interests in plain terms.",
      };
    }
  }

  return { valid: true, reason: null };
};
