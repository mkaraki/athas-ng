import type { AgentMessageSubmitResult, AgentType } from "@/features/ai/types/ai-chat.types";

export function getProviderAccessError(providerId: string): string {
  return providerId === "ollama"
    ? "Choose an installed local Ollama model in Settings."
    : "This provider is no longer supported. Choose Ollama or an ACP agent.";
}

export function getAgentMessageAccess(
  agentId: AgentType,
  hasProviderAccess: boolean,
  providerId?: string,
): AgentMessageSubmitResult {
  if (agentId === "codex") return { accepted: false, error: "Choose an ACP agent for Codex." };
  if (agentId !== "custom" || ((!providerId || providerId === "ollama") && hasProviderAccess)) {
    return { accepted: true };
  }
  return { accepted: false, error: getProviderAccessError(providerId ?? "ollama") };
}
