import { describe, expect, it } from "vite-plus/test";
import { resolveComposerNotice } from "@/features/ai/lib/composer-notice";
import type { ComposerNoticeInput } from "@/features/ai/types/composer-notice.types";

function input(overrides: Partial<ComposerNoticeInput> = {}): ComposerNoticeInput {
  return {
    hosted: false,
    providerBlocked: false,
    providerName: "Athas",
    auth: {
      isAuthenticated: true,
      isLoading: false,
      hasSubscription: true,
      error: null,
      sessionCheck: null,
    },
    signIn: { active: false, error: null },
    actionPending: false,
    usage: null,
    online: true,
    lastTurnOffline: false,
    dismissed: new Set(),
    ...overrides,
  };
}

describe("composer notice", () => {
  it("has no account or usage notice for a local chat", () => {
    expect(resolveComposerNotice(input())).toBeNull();
  });
  it("guides legacy hosted chats to local models instead of sign-in", () => {
    expect(resolveComposerNotice(input({ hosted: true }))).toMatchObject({
      primary: { id: "configure-models" },
      title: "Choose a local model or ACP agent",
    });
  });
  it("offers model selection for removed providers", () => {
    expect(resolveComposerNotice(input({ providerBlocked: true }))).toMatchObject({
      primary: { id: "configure-models" },
    });
  });
  it("preserves connection notices and dismissal", () => {
    expect(resolveComposerNotice(input({ online: false }))?.id).toBe("connection:offline");
    expect(resolveComposerNotice(input({ lastTurnOffline: true }))?.primary?.id).toBe("retry-turn");
    expect(
      resolveComposerNotice(
        input({ lastTurnOffline: true, dismissed: new Set(["connection:back-online"]) }),
      ),
    ).toBeNull();
  });
});
