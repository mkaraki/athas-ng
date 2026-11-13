import { useCallback, useEffect, useMemo, useState } from "react";
import { useProviderById } from "@/features/ai/hooks/use-available-providers";
import { resolveModelOptions } from "@/features/ai/lib/model-options";
import { getProvider } from "@/features/ai/services/providers/ai-provider-registry";
import { useAIChatStore } from "@/features/ai/stores/ai-chat.store";

export function useAIModelOptions(
  providerId: string,
  modelId: string,
  onChange?: (modelId: string) => void,
) {
  const [attempt, setAttempt] = useState(0);
  const [modelLoadState, setModelLoadState] = useState<{
    providerId: string;
    status: "loading" | "settled";
  }>({ providerId: "", status: "loading" });
  const [modelFetchError, setModelFetchError] = useState<{
    providerId: string;
    message: string;
  }>();
  const dynamicModels = useAIChatStore((state) => state.dynamicModels);
  const setDynamicModels = useAIChatStore((state) => state.actions.setDynamicModels);
  const catalogKey = providerId;
  const provider = useProviderById(providerId);
  const isCustomProvider = false;
  const providerInstance = getProvider(providerId);
  const fetchedModels = dynamicModels[catalogKey];
  const hasCachedDynamicModels = fetchedModels !== undefined;
  const canFetchDynamicModels = Boolean(providerInstance?.getModels);
  const isLoadingModels =
    canFetchDynamicModels &&
    !hasCachedDynamicModels &&
    (modelLoadState.providerId !== providerId || modelLoadState.status === "loading");
  const visibleModelFetchError =
    modelFetchError?.providerId === providerId ? modelFetchError.message : null;

  useEffect(() => {
    let isCurrent = true;
    const getModels = providerInstance?.getModels;

    if (!canFetchDynamicModels || hasCachedDynamicModels || !providerInstance || !getModels) {
      setModelLoadState({ providerId, status: "settled" });
      return;
    }

    setModelFetchError(undefined);
    setModelLoadState({ providerId, status: "loading" });
    const loadModels = async () => {
      try {
        const models = await getModels.call(providerInstance);
        if (!isCurrent) return;
        if (models.length > 0) setDynamicModels(providerId, models);
        if (models.length === 0) {
          setModelFetchError({
            providerId,
            message:
              providerId === "ollama"
                ? "No models detected. Please install a model in Ollama."
                : "No models found.",
          });
        }
      } catch (error) {
        if (isCurrent) {
          setModelFetchError({
            providerId,
            message: error instanceof Error ? error.message : "Could not connect to the provider.",
          });
        }
      } finally {
        if (isCurrent) setModelLoadState({ providerId, status: "settled" });
      }
    };

    void loadModels();

    return () => {
      isCurrent = false;
    };
  }, [
    attempt,
    canFetchDynamicModels,
    catalogKey,
    hasCachedDynamicModels,
    isCustomProvider,
    providerId,
    providerInstance,
    setDynamicModels,
  ]);

  const availableModels = useMemo(() => {
    const staticModels = provider?.models || [];
    const resolvedFetchedModels = fetchedModels || [];
    return resolveModelOptions({
      staticModels,
      fetchedModels: resolvedFetchedModels,
      customModels: [],
    });
  }, [fetchedModels, modelId, provider?.models, providerId]);

  useEffect(() => {
    if (
      !onChange ||
      modelId ||
      isLoadingModels ||
      visibleModelFetchError ||
      availableModels.length === 0
    )
      return;
    onChange(availableModels[0].id);
  }, [availableModels, modelId, onChange, isLoadingModels, visibleModelFetchError]);

  const currentModelName = useMemo(() => {
    const selectedModel = availableModels.find((model) => model.id === modelId);
    if (selectedModel) return selectedModel.name;
    if (modelId.trim()) return modelId;
    if (isLoadingModels) return "Loading models…";
    return "Select model";
  }, [availableModels, isLoadingModels, modelId]);

  return {
    availableModels,
    currentModelName,
    isCustomProvider,
    isLoadingModels,
    modelFetchError: visibleModelFetchError,
    retry: useCallback(() => setAttempt((value) => value + 1), []),
  };
}
