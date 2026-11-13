import type { Settings } from "@/features/settings/types/settings.types";
import {
  isOllamaCloudUrl,
  resolveOllamaBaseUrl,
} from "@/features/settings/services/ollama-endpoint";

import { isLocalEndpointUrl } from "@/utils/local-endpoint";
export { isLocalEndpointUrl } from "@/utils/local-endpoint";

type LocalProviderSettings = Pick<
  Settings,
  "ollamaBaseUrl" | "aiCustomBaseUrl" | "aiAutocompleteCustomBaseUrl"
>;

/**
 * Whether a provider runs on this machine or the local network: Ollama away from Ollama Cloud,
 * with no direct cloud provider support.
 */
export function isLocalAiProvider(providerId: string, settings: LocalProviderSettings): boolean {
  if (providerId === "ollama") {
    const baseUrl = resolveOllamaBaseUrl(settings.ollamaBaseUrl || "http://localhost:11434");
    return Boolean(baseUrl && !isOllamaCloudUrl(baseUrl) && isLocalEndpointUrl(baseUrl));
  }
  return false;
}

/**
 * The connection a chat's side requests, such as its title, must use: the chat's own local
 * provider and model, so a local chat's text is never sent to a hosted model. Null when the chat
 * is not a built-in agent chat on a local provider.
 */
export function getLocalChatConnection(
  chat: { agentId: string; providerId?: string | null; modelId?: string | null } | undefined,
  settings: LocalProviderSettings,
): { providerId: string; modelId: string } | null {
  if (!chat || chat.agentId !== "custom" || !chat.providerId) return null;
  if (!isLocalAiProvider(chat.providerId, settings)) return null;
  return { providerId: chat.providerId, modelId: chat.modelId?.trim() ?? "" };
}
