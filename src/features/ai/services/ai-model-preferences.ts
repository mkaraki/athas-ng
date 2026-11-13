import { resolveIntelligenceConnection } from "@/features/ai/intelligence/services/resolve-intelligence-connection";
import type {
  IntelligenceConnection,
  IntelligencePreferences,
  IntelligenceTask,
} from "@/features/ai/intelligence/types/intelligence.types";

/**
 * Features that can use a model other than the default, in the order Settings lists them.
 * Tab completion is left out: it never follows the default and has its own page.
 */
export const AI_FEATURE_MODEL_OVERRIDES: ReadonlyArray<{ task: IntelligenceTask; label: string }> =
  [
    { task: "agent", label: "New chats" },
    { task: "inline-edit", label: "Inline edits" },
    { task: "commit-message", label: "Commit messages" },
    { task: "chat-title", label: "Chat titles" },
    { task: "terminal-title", label: "Terminal titles" },
    { task: "github-draft", label: "GitHub drafts" },
    { task: "review-summary", label: "Review summaries" },
    { task: "review-insight", label: "Review assistance" },
  ];

/**
 * The model the default actually resolves to. The stored default may be the "auto" placeholder,
 * which means the device's local Ollama model; Settings shows what will run instead of that placeholder.
 */
export function getEffectiveDefaultConnection(params: {
  preferences: IntelligencePreferences;
  hasIntelligence: boolean;
  personalConnection: IntelligenceConnection;
  personalConnectionIsLocal: boolean;
}): IntelligenceConnection {
  return resolveIntelligenceConnection({
    task: "agent",
    preferences: { ...params.preferences, tasks: {} },
    hasIntelligence: params.hasIntelligence,
    personalConnection: params.personalConnection,
    personalConnectionIsLocal: params.personalConnectionIsLocal,
  });
}

/** Only a configured local Ollama connection is available. */
export function isConnectionAvailable(connection: IntelligenceConnection): boolean {
  return connection.providerId === "ollama" && Boolean(connection.modelId.trim());
}

export function withDefaultConnection(
  preferences: IntelligencePreferences,
  connection: IntelligenceConnection,
): IntelligencePreferences {
  return { ...preferences, defaultConnection: connection };
}

/** Sets a feature's model, or clears it back to the default when `connection` is null. */
export function withTaskConnection(
  preferences: IntelligencePreferences,
  task: IntelligenceTask,
  connection: IntelligenceConnection | null,
): IntelligencePreferences {
  const tasks = { ...preferences.tasks };
  if (connection) tasks[task] = connection;
  else delete tasks[task];
  return { ...preferences, tasks };
}

export function countTaskOverrides(
  preferences: IntelligencePreferences,
  tasks: IntelligenceTask[],
) {
  return tasks.filter((task) => preferences.tasks[task]).length;
}
