import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { tauriFetch } from "@/utils/tauri-fetch";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { normalizeOllamaBaseUrl } from "@/features/settings/services/ollama-endpoint";
import { createIntelligenceModelFetch } from "./intelligence-model-fetch";

interface IntelligenceSdkModelOptions {
  onCost?: (usd: number) => void;
}

export async function getIntelligenceSdkModel(
  providerId: string,
  modelId: string,
  task: string | undefined = undefined,
  options: IntelligenceSdkModelOptions = {},
) {
  void task;
  if (providerId !== "ollama") throw new Error("Only local Ollama models are supported.");
  if (modelId.endsWith(":cloud") || modelId.endsWith("-cloud"))
    throw new Error("Ollama cloud models are not supported.");
  const baseURL = `${normalizeOllamaBaseUrl(useSettingsStore.getState().settings.ollamaBaseUrl)}/v1`;
  return createOpenAICompatible({
    name: "ollama",
    baseURL,
    fetch: createIntelligenceModelFetch({
      fetch: tauriFetch as typeof fetch,
      onCost: options.onCost,
    }),
    includeUsage: true,
  }).chatModel(modelId);
}
