import type {
  IntelligenceConnection,
  IntelligencePreferences,
  IntelligenceTask,
} from "../types/intelligence.types";

interface ConnectionContext {
  preferences: IntelligencePreferences;
  hasIntelligence: boolean;
  personalConnection: IntelligenceConnection;
  /**
   * Whether the personal connection runs on this machine or the local network. "Auto" then keeps
   * every task on it instead of routing prompts and code to hosted Athas.
   */
  personalConnectionIsLocal?: boolean;
}

/**
 * The connection a task runs on: its own choice, or the default model. Tab completion does not
 * follow the default and resolves through `resolveAutocompleteConnection` instead.
 */
export function resolveIntelligenceConnection(
  params: ConnectionContext & { task: Exclude<IntelligenceTask, "autocomplete"> },
): IntelligenceConnection {
  const connection = params.preferences.tasks[params.task] ?? params.preferences.defaultConnection;
  if (connection.providerId !== "auto" && connection.providerId !== "athas") return connection;
  return params.personalConnection.providerId === "athas"
    ? { providerId: "ollama", modelId: "" }
    : params.personalConnection;
}

/** Tab completion follows an explicit choice or the personal default. */
export function resolveAutocompleteConnection(
  params: ConnectionContext & {
    /** Whether a provider runs locally, for a default model other than the personal one. */
    isLocalProvider?: (providerId: string) => boolean;
  },
): IntelligenceConnection | null {
  const choice = params.preferences.tasks.autocomplete;
  if (choice && choice.providerId !== "auto" && choice.providerId !== "athas") return choice;

  // The default model itself, not the "New chats" override, decides whether Tab stays local.
  const chatDefault = resolveIntelligenceConnection({
    ...params,
    preferences: { ...params.preferences, tasks: {} },
    task: "agent",
  });
  return chatDefault.modelId.trim() ? chatDefault : null;
}
