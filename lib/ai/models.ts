import type { AiProvider } from "@/lib/domain";

/** Metadata for a single AI model available in the application. */
export interface AiModel {
  /** Human-readable display name shown in the UI model dropdown. */
  readonly displayName: string;
  /** Model ID string passed directly to the provider SDK. */
  readonly modelId: string;
}

/** The full model registry, keyed by AI provider. */
export type ModelRegistry = Readonly<Record<AiProvider, readonly AiModel[]>>;

/**
 * Human-readable display labels for every supported AI provider.
 * Used in dropdowns and other UI surfaces.
 */
export const PROVIDER_LABELS: Readonly<Record<AiProvider, string>> = {
  gemini: "Gemini",
  claude: "Claude",
};

/**
 * Hardcoded model registry for all supported AI providers.
 * The first entry for each provider is the default selection.
 * Dynamic enumeration via provider APIs is deferred to a future phase.
 */
export const MODEL_REGISTRY: ModelRegistry = {
  gemini: [
    { displayName: "Gemini 2.5 Flash", modelId: "gemini-2.5-flash" },
    { displayName: "Gemini 2.5 Pro", modelId: "gemini-2.5-pro" },
    { displayName: "Gemini 2.5 Flash-Lite", modelId: "gemini-2.5-flash-lite" },
  ],
  claude: [
    { displayName: "Claude Sonnet 4.6", modelId: "claude-sonnet-4-6" },
    { displayName: "Claude Haiku 4.5", modelId: "claude-haiku-4-5-20251001" },
    { displayName: "Claude Opus 4.6", modelId: "claude-opus-4-6" },
  ],
} as const;

/**
 * Returns all available models for the given AI provider.
 *
 * @param provider - The AI provider identifier.
 * @returns An array of AiModel entries registered for the provider.
 */
export const getModelsForProvider = (provider: AiProvider): readonly AiModel[] =>
  MODEL_REGISTRY[provider];

/**
 * Returns the default model for the given AI provider.
 * The default is always the first entry in the provider's registry.
 *
 * @param provider - The AI provider identifier.
 * @returns The first AiModel registered for the provider.
 */
export const getDefaultModel = (provider: AiProvider): AiModel =>
  MODEL_REGISTRY[provider][0];

/**
 * Looks up a model by its ID within a given provider's registry.
 * Returns `undefined` when no matching model is found.
 *
 * @param provider - The AI provider identifier.
 * @param modelId - The model ID string to look up.
 * @returns The matching AiModel, or `undefined` if not found.
 */
export const findModel = (provider: AiProvider, modelId: string): AiModel | undefined =>
  MODEL_REGISTRY[provider].find((m) => m.modelId === modelId);
