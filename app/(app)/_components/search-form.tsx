"use client";

import { type SubmitEvent, useState } from "react";
import { getDefaultModel, getModelsForProvider, PROVIDER_LABELS } from "@/lib/ai/models";
import type { AiProvider, SearchFormInput, StateOption } from "@/lib/domain";
import { AI_PROVIDERS } from "@/lib/domain";
import {
  QUERY_MAX_LENGTH,
  SearchFormInputSchema,
  STATE_LABELS,
  STATE_OPTIONS,
  USER_CONTEXT_MAX_LENGTH,
} from "@/lib/domain";
import type { RequestStage } from "../_hooks/use-bill-analysis-pipeline";
import { FormField } from "./form-field";

/** Base Tailwind classes shared by every form control. */
const FIELD_CLASSES =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

/**
 * Local form field state. Separate from the validated `SearchFormInput`
 * so that individual string fields can be empty while being edited.
 */
type FormState = {
  state: StateOption;
  query: string;
  aiProvider: AiProvider;
  aiModel: string;
  aiKey: string;
  userContext: string;
};

/** Per-field client-side validation error messages. */
type FieldErrors = Partial<Record<keyof FormState, string>>;

/** Props accepted by `SearchForm`. */
type SearchFormProps = {
  /** Current request lifecycle stage, owned by the parent via the hook. */
  readonly stage: RequestStage;
  /**
   * Called with validated form values when the user submits.
   * The hook's `submit` function is passed directly here.
   */
  readonly onSubmit: (values: SearchFormInput) => Promise<void>;
};

/**
 * Maps flattened Zod field errors into a simple key-to-message map.
 *
 * @param flattenedErrors - Flattened `fieldErrors` from a Zod validation result.
 * @returns A map of field names to first validation message.
 */
const toFieldErrorMap = (
  flattenedErrors: Record<string, string[] | undefined>
): FieldErrors => {
  const result: FieldErrors = {};
  for (const [field, messages] of Object.entries(flattenedErrors)) {
    if (!messages || messages.length === 0) continue;
    result[field as keyof FormState] = messages[0];
  }
  return result;
};

/**
 * Renders the search form fields and delegates submission to the
 * `useBillAnalysisPipeline` hook via the `onSubmit` prop.
 *
 * Owns only local field state and client-side validation error messages.
 */
export const SearchForm = ({ stage, onSubmit }: SearchFormProps) => {
  const [formState, setFormState] = useState<FormState>({
    state: "US",
    query: "",
    aiProvider: "gemini",
    aiModel: getDefaultModel("gemini").modelId,
    aiKey: "",
    userContext: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  /** Models available for the currently selected AI provider. */
  const availableModels = getModelsForProvider(formState.aiProvider);

  /** True while network requests are in flight. */
  const isSubmitting = stage === "searching" || stage === "analyzing";

  /**
   * Updates a single form field and clears its validation error.
   *
   * @param field - Form field key.
   * @param value - New value for the field.
   */
  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  /**
   * Handles provider changes and resets the model to the provider default.
   *
   * @param provider - Newly selected provider.
   */
  const updateProvider = (provider: AiProvider) => {
    const defaultModel = getDefaultModel(provider).modelId;
    setFormState((prev) => ({ ...prev, aiProvider: provider, aiModel: defaultModel }));
    setFieldErrors((prev) => ({ ...prev, aiProvider: undefined, aiModel: undefined }));
  };

  /**
   * Validates the form client-side and, on success, delegates to the hook's
   * `submit` function via the `onSubmit` prop.
   *
   * @param event - Form submit event.
   */
  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = SearchFormInputSchema.safeParse(formState);
    if (!parsed.success) {
      setFieldErrors(toFieldErrorMap(parsed.error.flatten((issue) => issue.message).fieldErrors));
      return;
    }
    setFieldErrors({});
    await onSubmit(parsed.data);
  };

  return (
    <form
      className="space-y-6 rounded-lg border border-zinc-200 p-6 shadow-sm dark:border-zinc-800"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="state" label="State" error={fieldErrors.state}>
          <select
            className={FIELD_CLASSES}
            disabled={isSubmitting}
            id="state"
            name="state"
            value={formState.state}
            onChange={(event) => updateField("state", event.target.value as StateOption)}
          >
            {STATE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {STATE_LABELS[option]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="query" label="LegiScan Search" error={fieldErrors.query}>
          <input
            className={FIELD_CLASSES}
            disabled={isSubmitting}
            id="query"
            maxLength={QUERY_MAX_LENGTH}
            name="query"
            placeholder="Example: education funding"
            value={formState.query}
            onChange={(event) => updateField("query", event.target.value)}
          />
          <p className="text-xs text-zinc-500">
            {formState.query.length}/{QUERY_MAX_LENGTH}
          </p>
        </FormField>

        <FormField id="aiProvider" label="AI Engine" error={fieldErrors.aiProvider}>
          <select
            className={FIELD_CLASSES}
            disabled={isSubmitting}
            id="aiProvider"
            name="aiProvider"
            value={formState.aiProvider}
            onChange={(event) => updateProvider(event.target.value as AiProvider)}
          >
            {AI_PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_LABELS[provider]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="aiModel" label="AI Model" error={fieldErrors.aiModel}>
          <select
            className={FIELD_CLASSES}
            disabled={isSubmitting}
            id="aiModel"
            name="aiModel"
            value={formState.aiModel}
            onChange={(event) => updateField("aiModel", event.target.value)}
          >
            {availableModels.map((model) => (
              <option key={model.modelId} value={model.modelId}>
                {model.displayName}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField id="aiKey" label="AI API Key" error={fieldErrors.aiKey}>
        <input
          className={FIELD_CLASSES}
          disabled={isSubmitting}
          id="aiKey"
          name="aiKey"
          placeholder="Paste your key for this request"
          type="password"
          value={formState.aiKey}
          onChange={(event) => updateField("aiKey", event.target.value)}
        />
      </FormField>

      <FormField id="userContext" label="AI User Context" error={fieldErrors.userContext}>
        <textarea
          className={`${FIELD_CLASSES} min-h-32`}
          disabled={isSubmitting}
          id="userContext"
          maxLength={USER_CONTEXT_MAX_LENGTH}
          name="userContext"
          placeholder="Describe who you are and what kinds of bills matter most to you"
          value={formState.userContext}
          onChange={(event) => updateField("userContext", event.target.value)}
        />
        <p className="text-xs text-zinc-500">
          {formState.userContext.length}/{USER_CONTEXT_MAX_LENGTH}
        </p>
      </FormField>

      <button
        className="inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-600"
        disabled={isSubmitting}
        type="submit"
      >
        {stage === "searching"
          ? "Searching LegiScan..."
          : stage === "analyzing"
            ? "Analyzing with AI..."
            : "Submit Search"}
      </button>
    </form>
  );
};
