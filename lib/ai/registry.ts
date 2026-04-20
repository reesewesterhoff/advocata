import type { AiProvider } from "@/lib/domain";

import { ClaudeAdapter } from "./claude-adapter";
import { GeminiAdapter } from "./gemini-adapter";
import type { AiAdapter } from "./types";

/**
 * Returns the appropriate `AiAdapter` implementation for the given provider.
 *
 * Adapters are stateless and instantiated fresh on each call, so their
 * lifetime is scoped to the request that created them.
 *
 * @param provider - The AI provider identifier to resolve.
 * @returns The `AiAdapter` implementation for the given provider.
 */
export function getAdapter(provider: AiProvider): AiAdapter {
  switch (provider) {
    case "gemini":
      return new GeminiAdapter();
    case "claude":
      return new ClaudeAdapter();
  }
}
