import type {
  IntelligenceConnection,
  IntelligencePreferences,
  IntelligenceTask,
} from "../types/intelligence.types";

interface ConnectionContext {
  preferences: IntelligencePreferences;
  hasIntelligence: boolean;
  personalConnection: IntelligenceConnection;
  personalConnectionIsLocal?: boolean;
}

/** Legacy hosted selections fall back to the user's local model. */
export function resolveIntelligenceConnection(
  params: ConnectionContext & { task: Exclude<IntelligenceTask, "autocomplete"> },
): IntelligenceConnection {
  const connection = params.preferences.tasks[params.task] ?? params.preferences.defaultConnection;
  if (connection.providerId === "ollama") return connection;
  return params.personalConnection.providerId === "ollama"
    ? params.personalConnection
    : { providerId: "ollama", modelId: "" };
}

export function resolveAutocompleteConnection(
  params: ConnectionContext & { isLocalProvider?: (providerId: string) => boolean },
): IntelligenceConnection | null {
  const choice = params.preferences.tasks.autocomplete;
  const connection =
    choice?.providerId === "ollama"
      ? choice
      : resolveIntelligenceConnection({
          ...params,
          preferences: { ...params.preferences, tasks: {} },
          task: "agent",
        });
  return connection.modelId.trim() ? connection : null;
}
