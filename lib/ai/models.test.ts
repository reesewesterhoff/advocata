import { describe, it, expect } from "vitest";
import { MODEL_REGISTRY, getModelsForProvider, getDefaultModel, findModel } from "./models";
import { AI_PROVIDERS } from "@/lib/domain";

describe("MODEL_REGISTRY", () => {
  it("has an entry for every supported AI provider", () => {
    for (const provider of AI_PROVIDERS) {
      expect(MODEL_REGISTRY[provider]).toBeDefined();
      expect(MODEL_REGISTRY[provider].length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate model IDs within any provider", () => {
    for (const provider of AI_PROVIDERS) {
      const ids = MODEL_REGISTRY[provider].map((m) => m.modelId);
      const unique = new Set(ids);
      expect(unique.size, `provider "${provider}" has duplicate model IDs`).toBe(ids.length);
    }
  });

  it("registers exactly 3 Gemini models", () => {
    expect(MODEL_REGISTRY.gemini.length).toBe(3);
  });

  it("registers exactly 3 Claude models", () => {
    expect(MODEL_REGISTRY.claude.length).toBe(3);
  });

  it("has Gemini 2.5 Flash as the first Gemini entry", () => {
    expect(MODEL_REGISTRY.gemini[0].modelId).toBe("gemini-2.5-flash");
  });

  it("has Claude Sonnet 4.6 as the first Claude entry", () => {
    expect(MODEL_REGISTRY.claude[0].modelId).toBe("claude-sonnet-4-6");
  });
});

describe("getModelsForProvider", () => {
  it("returns the correct models for Gemini", () => {
    const models = getModelsForProvider("gemini");
    expect(models).toBe(MODEL_REGISTRY.gemini);
  });

  it("returns the correct models for Claude", () => {
    const models = getModelsForProvider("claude");
    expect(models).toBe(MODEL_REGISTRY.claude);
  });
});

describe("getDefaultModel", () => {
  it("returns the first registered Gemini model", () => {
    const model = getDefaultModel("gemini");
    expect(model.modelId).toBe("gemini-2.5-flash");
  });

  it("returns the first registered Claude model", () => {
    const model = getDefaultModel("claude");
    expect(model.modelId).toBe("claude-sonnet-4-6");
  });

  it("returns a model with a non-empty displayName for every provider", () => {
    for (const provider of AI_PROVIDERS) {
      const model = getDefaultModel(provider);
      expect(model.displayName.length).toBeGreaterThan(0);
    }
  });
});

describe("findModel", () => {
  it("returns the correct model when given a valid provider and model ID", () => {
    const model = findModel("gemini", "gemini-2.5-pro");
    expect(model).toBeDefined();
    expect(model?.modelId).toBe("gemini-2.5-pro");
  });

  it("returns undefined for an unrecognized model ID", () => {
    const model = findModel("gemini", "gemini-does-not-exist");
    expect(model).toBeUndefined();
  });

  it("returns undefined when the model ID belongs to a different provider", () => {
    const model = findModel("claude", "gemini-2.5-flash");
    expect(model).toBeUndefined();
  });

  it("finds all registered models by their own model IDs", () => {
    for (const provider of AI_PROVIDERS) {
      for (const registeredModel of MODEL_REGISTRY[provider]) {
        const found = findModel(provider, registeredModel.modelId);
        expect(found).toBeDefined();
        expect(found?.modelId).toBe(registeredModel.modelId);
      }
    }
  });
});
