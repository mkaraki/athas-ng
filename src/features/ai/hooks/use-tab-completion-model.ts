import { useModelName } from "@/features/ai/hooks/use-model-providers";
import { useProviderById } from "@/features/ai/hooks/use-available-providers";
import { resolveAutocompleteConnection } from "@/features/ai/intelligence/services/resolve-intelligence-connection";
import type { IntelligenceConnection } from "@/features/ai/intelligence/types/intelligence.types";
import { useAIModelSettings } from "@/features/ai/hooks/use-ai-model-settings";
import { withTaskConnection } from "@/features/ai/services/ai-model-preferences";
import { useSettingsStore } from "@/features/settings/stores/settings.store";

/**
 * The model Tab completion runs on, for every place that shows or changes it: the explicit
 * choice (null on Automatic), what that resolves to right now, and how to describe it.
 */
export function useTabCompletionModel() {
  const state = useAIModelSettings();
  const enabled = useSettingsStore((store) => store.settings.aiCompletion);
  const allowed = true;

  const stored = state.preferences.tasks.autocomplete;
  const choice = stored && stored.providerId === "ollama" ? stored : null;
  const resolved = resolveAutocompleteConnection({
    ...state.context,
    isLocalProvider: state.isLocalProvider,
  });
  const provider = useProviderById(resolved?.providerId ?? "");
  const modelName = useModelName(resolved?.providerId ?? "", resolved?.modelId ?? "");
  const resolvedIsLocal = resolved ? state.isLocalProvider(resolved.providerId) : false;

  /** Short name for compact places, such as the editor toolbar menu. */
  const shortName = !resolved ? "Choose a model" : (modelName ?? resolved.modelId);
  const providerName = resolved ? (provider?.name ?? resolved.providerId) : "";

  const describe = () => {
    if (!resolved) return "Choose a local Ollama model";
    return `${choice ? "" : "Automatic: "}${shortName}, runs locally`;
  };

  return {
    allowed,
    enabled,
    choice,
    resolved,
    shortName,
    providerName,
    isAutomatic: !choice,
    isLocal: resolvedIsLocal,
    locked: state.locked,
    description: describe(),
    change: (connection: IntelligenceConnection | null) =>
      state.actions.change(withTaskConnection(state.preferences, "autocomplete", connection)),
  };
}
