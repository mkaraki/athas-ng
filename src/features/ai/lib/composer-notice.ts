import type { ComposerNotice, ComposerNoticeInput } from "../types/composer-notice.types";

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
  if (input.hosted || input.providerBlocked)
    return {
      id: "provider:unavailable",
      category: "provider",
      tone: "info",
      icon: "info",
      title: "Choose a local model or ACP agent",
      description: "Direct cloud providers are no longer supported.",
      primary: { id: "configure-models", label: "Models" },
      dismissible: false,
    };
  const notice = connectionNotice(input);
  return notice && !input.dismissed.has(notice.id) ? notice : null;
}
