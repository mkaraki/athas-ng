import type {
  ComposerNotice,
  ComposerNoticeInput,
} from "@/features/ai/types/composer-notice.types";
function connectionNotice(input: ComposerNoticeInput): ComposerNotice | null {
  if (!input.online) {
    return {
      id: "connection:offline",
      category: "connection",
      tone: "warning",
      icon: "offline",
      title: "You're offline",
      description: "Messages you send wait in the queue until the connection is back.",
      dismissible: false,
    };
  }
  if (input.lastTurnOffline) {
    return {
      id: "connection:back-online",
      category: "connection",
      tone: "info",
      icon: "info",
      title: "Back online",
      description: "The last prompt did not go through.",
      primary: { id: "retry-turn", label: "Send again" },
      dismissible: true,
    };
  }
  return null;
}

export function resolveComposerNotice(input: ComposerNoticeInput): ComposerNotice | null {
  if (input.hosted)
    return {
      id: "provider:unavailable",
      category: "provider",
      tone: "info",
      icon: "info",
      title: "Choose another model",
      description: "Athas hosted models require an Athas account.",
      primary: { id: "configure-models", label: "Models" },
      dismissible: false,
    };
  const candidates: Array<() => ComposerNotice | null> = [
    () =>
      !input.hosted && input.providerBlocked
        ? {
            id: "provider:missing-key",
            category: "provider",
            tone: "info",
            icon: "key",
            title: `Add an API key for ${input.providerName}`,
            description: "The key stays on this machine. Or switch to another model.",
            primary: { id: "add-api-key", label: "Add API key" },
            secondary: { id: "configure-models", label: "Models" },
            dismissible: false,
          }
        : null,
    () => connectionNotice(input),
  ];
  for (const candidate of candidates) {
    const notice = candidate();
    if (notice && !input.dismissed.has(notice.id)) return notice;
  }
  return null;
}
