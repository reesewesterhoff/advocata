import { describe, it, expect } from "vitest";

import { AI_PROVIDERS } from "@/lib/domain";

import { ClaudeAdapter } from "./claude-adapter";
import { GeminiAdapter } from "./gemini-adapter";
import { getAdapter } from "./registry";

describe("getAdapter", () => {
  it("returns a GeminiAdapter for the gemini provider", () => {
    const adapter = getAdapter("gemini");
    expect(adapter).toBeInstanceOf(GeminiAdapter);
  });

  it("returns a ClaudeAdapter for the claude provider", () => {
    const adapter = getAdapter("claude");
    expect(adapter).toBeInstanceOf(ClaudeAdapter);
  });

  it("returns an adapter whose provider matches the requested provider", () => {
    for (const provider of AI_PROVIDERS) {
      const adapter = getAdapter(provider);
      expect(adapter.provider).toBe(provider);
    }
  });

  it("returns a new instance on each call", () => {
    const a = getAdapter("gemini");
    const b = getAdapter("gemini");
    expect(a).not.toBe(b);
  });

  it("returns an object with an analyzeBills method for every provider", () => {
    for (const provider of AI_PROVIDERS) {
      const adapter = getAdapter(provider);
      expect(typeof adapter.analyzeBills).toBe("function");
    }
  });
});
