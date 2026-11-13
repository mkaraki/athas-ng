// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ApiErrorActions } from "../components/messages/api-error-actions";
import { formatApiError, getApiErrorCode } from "../lib/api-error";

const state = vi.hoisted(() => ({
  openUrl: vi.fn(async () => {}),
  signIn: vi.fn(async () => {}),
  settings: vi.fn(),
  error: vi.fn(),
  newChat: vi.fn(),
  base: "http://localhost:3000",
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: state.openUrl }));
vi.mock("sonner", () => ({ toast: { error: state.error } }));
vi.mock("@/utils/api-base", () => ({ getApiBase: () => state.base }));
vi.mock("@/config/services", () => ({
  getServiceUrls: () => ({
    websiteBaseUrl: "https://website.test",
    dashboardBillingUrl: "https://website.test/dashboard/settings/billing",
  }),
}));
vi.mock("@/features/ai/services/open-new-agent-chat", () => ({ openNewAgentChat: state.newChat }));
vi.mock("@/features/auth/hooks/use-desktop-sign-in", () => ({
  useDesktopSignIn: () => ({ signIn: state.signIn, isSigningIn: false }),
}));
vi.mock("@/features/layout/stores/ui-state.store", () => ({
  useUIState: { getState: () => ({ openSettings: state.settings }) },
}));
vi.mock("../components/provider-api-key-command", () => ({
  ProviderApiKeyCommand: ({
    isOpen,
    initialProviderId,
  }: {
    isOpen: boolean;
    initialProviderId: string;
  }) => (isOpen ? <div role="dialog">Configure {initialProviderId}</div> : null),
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  state.base = "http://localhost:3000";
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function click(
  code: string,
  providerId: string,
  onRetry?: () => void,
  extra: { serverCode?: string; billingUrl?: string } = {},
) {
  await act(async () =>
    root.render(
      <ApiErrorActions code={code} providerId={providerId} onRetry={onRetry} {...extra} />,
    ),
  );
  const button = container.querySelector("button")!;
  const label = button.textContent;
  await act(async () => button.click());
  return label;
}
describe("API error recovery", () => {
  it.each(["401", "402", "403"])("sends legacy cloud errors %s to model settings", async (code) => {
    expect(await click(code, "athas")).toBe("Configure models");
    expect(state.settings).toHaveBeenCalledWith("ai");
    expect(state.openUrl).not.toHaveBeenCalled();
    expect(state.signIn).not.toHaveBeenCalled();
  });
  it("starts a new local chat for an oversized conversation", async () => {
    expect(await click("413", "ollama")).toBe("Start new chat");
    expect(state.newChat).toHaveBeenCalledOnce();
  });
  it("retries transient local failures", async () => {
    const retry = vi.fn();
    await click("503", "openai", retry);
    expect(retry).toHaveBeenCalledOnce();
  });
  it("restores the button after a retry failure", async () => {
    await click("503", "openai", () => {
      throw new Error("offline");
    });
    expect(state.error).toHaveBeenCalledWith("offline");
    expect(container.querySelector("button")?.disabled).toBe(false);
  });
  it("still reads error status from old saved conversations", () => {
    expect(
      getApiErrorCode(
        formatApiError("athas", Object.assign(new Error("Payment Required"), { statusCode: 402 })),
      ),
    ).toBe("402");
  });
});
