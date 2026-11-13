// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({ label: "main" }),
  getAllWebviewWindows: async () => [],
}));
vi.mock("@/features/ai/services/ai-chat-history-service", () => ({
  deleteChatFromDb: vi.fn(),
  initChatDatabase: vi.fn(),
  loadAllChatsFromDb: vi.fn(),
  loadChatFromDb: vi.fn(),
  saveChatMetadataToDb: vi.fn().mockResolvedValue(undefined),
  saveChatToDb: vi.fn().mockResolvedValue(undefined),
}));

import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { useTabCompletionModel } from "../hooks/use-tab-completion-model";
import { defaultIntelligencePreferences } from "../intelligence/lib/intelligence-preferences";
import { useIntelligenceSettingsStore } from "../intelligence/stores/intelligence-settings.store";
import type { IntelligencePreferences } from "../intelligence/types/intelligence.types";

type Tab = ReturnType<typeof useTabCompletionModel>;
let root: Root;
let tab: Tab;
const initialSettings = useSettingsStore.getState().settings;

function Harness() {
  tab = useTabCompletionModel();
  return null;
}

async function render() {
  await act(async () => root.render(createElement(Harness)));
}

function preferences(patch: Partial<IntelligencePreferences> = {}) {
  useIntelligenceSettingsStore.setState({
    preferences: { ...defaultIntelligencePreferences(), ...patch },
    scope: "personal",
    scopes: [{ id: "personal", name: "Personal", canEdit: true }],
    dirty: false,
    loading: false,
    error: null,
  });
}

function settings(patch: Partial<typeof initialSettings>) {
  useSettingsStore.setState({ settings: { ...initialSettings, ...patch } });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  useAuthStore.setState({ user: null, isAuthenticated: false, subscription: null });
  settings({ aiProviderId: "ollama", aiModelId: "qwen2.5-coder", aiCompletion: true });
  preferences();
  root = createRoot(document.createElement("div"));
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe("useTabCompletionModel", () => {
  it("uses local Ollama regardless of stale account state", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      subscription: { capabilities: { intelligence: true } } as never,
    });
    await render();
    expect(tab).toMatchObject({
      isAutomatic: true,
      shortName: "qwen2.5-coder",
      description: "Automatic: qwen2.5-coder, runs locally",
      allowed: true,
      enabled: true,
    });
  });

  it("uses the local default model", async () => {
    await render();
    expect(tab.resolved).toEqual({ providerId: "ollama", modelId: "qwen2.5-coder" });
    expect(tab.description).toBe(`Automatic: ${tab.shortName}, runs locally`);
  });

  it("keeps Tab local when an old choice names a cloud provider", async () => {
    settings({
      aiProviderId: "ollama",
      aiModelId: "qwen2.5-coder",
      ollamaBaseUrl: "http://localhost:11434",
    });
    await render();
    expect(tab).toMatchObject({
      isLocal: true,
      description: "Automatic: qwen2.5-coder, runs locally",
    });

    preferences({ tasks: { autocomplete: { providerId: "openai", modelId: "gpt-5.6-luna" } } });
    await render();
    expect(tab.isAutomatic).toBe(true);
    expect(tab.choice).toBeNull();
    expect(tab.description).toBe("Automatic: qwen2.5-coder, runs locally");
  });

  it("explains why nothing can run", async () => {
    settings({ aiProviderId: "athas", aiModelId: "" });
    await render();
    expect(tab.resolved).toBeNull();
    expect(tab.shortName).toBe("Choose a model");
    expect(tab.description).toBe("Choose a local Ollama model");

    useAuthStore.setState({ isAuthenticated: true });
    await render();
    expect(tab.description).toBe("Choose a local Ollama model");

    settings({ aiProviderId: "ollama", aiModelId: "", ollamaBaseUrl: "http://localhost:11434" });
    await render();
    expect(tab.description).toBe("Choose a local Ollama model");
  });

  it("ignores obsolete account policy", async () => {
    useAuthStore.setState({
      subscription: {
        enterprise: { policy: { managedMode: true, aiCompletionEnabled: false } },
      } as never,
    });
    await render();
    expect(tab.allowed).toBe(true);
  });

  it("stores a choice and saves it to the active scope", async () => {
    const save = vi.fn(async () => {});
    useIntelligenceSettingsStore.setState({
      actions: { ...useIntelligenceSettingsStore.getState().actions, save },
    });
    await render();

    await act(async () => tab.change({ providerId: "ollama", modelId: "qwen2.5-coder" }));
    expect(useIntelligenceSettingsStore.getState().preferences.tasks.autocomplete).toEqual({
      providerId: "ollama",
      modelId: "qwen2.5-coder",
    });
    expect(save).toHaveBeenCalled();

    await act(async () => tab.change(null));
    expect(useIntelligenceSettingsStore.getState().preferences.tasks.autocomplete).toBeUndefined();
  });
});
