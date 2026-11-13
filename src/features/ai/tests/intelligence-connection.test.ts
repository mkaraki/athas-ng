import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
const state = vi.hoisted(() => ({
  settings: { aiProviderId: "ollama", aiModelId: "qwen3", ollamaBaseUrl: "http://localhost:11434" },
}));
vi.mock("@/features/settings/stores/settings.store", () => ({
  useSettingsStore: { getState: () => state },
}));
import { getIntelligenceConnection } from "../intelligence/services/intelligence-connection";
beforeEach(() => {
  state.settings.aiProviderId = "ollama";
  state.settings.aiModelId = "qwen3";
});
describe("local intelligence connections", () => {
  it("resolves chat and completion without an account", async () => {
    expect(await getIntelligenceConnection("agent")).toMatchObject({
      providerId: "ollama",
      modelId: "qwen3",
      userId: null,
    });
    expect(await getIntelligenceConnection("autocomplete")).toMatchObject({
      providerId: "ollama",
      modelId: "qwen3",
    });
  });
  it("asks for a model when an old cloud selection has no local replacement", async () => {
    state.settings.aiProviderId = "athas";
    state.settings.aiModelId = "auto";
    await expect(getIntelligenceConnection("autocomplete")).rejects.toThrow("Choose a local model");
  });
});
