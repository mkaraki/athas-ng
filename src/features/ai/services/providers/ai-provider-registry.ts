import { OllamaProvider } from "./ollama-provider";
import type { AIProvider, ProviderConfig } from "./ai-provider-interface";
import type { Settings } from "@/features/settings/types/settings.types";
import type { ModelProvider } from "@/features/ai/types/providers.types";

interface AIProviderRuntimeContribution {
  extensionId: string;
  provider: ModelProvider;
  createProvider: (config: ProviderConfig) => AIProvider;
  useTauriFetch?: boolean;
  buildSystemPromptContext?: (settings: Settings) => string | Promise<string>;
}

const ollama = new OllamaProvider({
  id: "ollama",
  name: "Ollama",
  apiUrl: "http://localhost:11434/v1/chat/completions",
  requiresApiKey: false,
  maxTokens: 4096,
});

export const registerAIProviderExtension: (
  contribution: AIProviderRuntimeContribution,
) => void = () => {
  throw new Error("Direct provider extensions are not supported. Use an ACP agent instead.");
};
export const unregisterAIProviderExtension: (extensionId: string) => void = () => {};
export const buildProviderSystemPromptContext: (
  providerId: string,
  settings: Settings,
) => Promise<string> = async () => "";
export function shouldUseTauriFetchForProvider(providerId: string): boolean {
  return providerId === "ollama";
}
export function getProvider(providerId: string): AIProvider | undefined {
  return providerId === "ollama" ? ollama : undefined;
}
export function setOllamaBaseUrl(baseUrl: string): void {
  ollama.setBaseUrl(baseUrl);
}
export function setOllamaApiKey(apiKey: string | null): void {
  ollama.setApiKey(apiKey);
}
