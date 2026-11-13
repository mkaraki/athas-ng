import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getIntelligenceSdkModel } from "../intelligence/services/intelligence-sdk-model";

const mocks = vi.hoisted(() => ({ compatible: vi.fn(), fetch: vi.fn() }));
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: (config: unknown) => {
    mocks.compatible(config);
    return { chatModel: (id: string) => ({ id }) };
  },
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: mocks.fetch }));
vi.mock("@/features/settings/stores/settings.store", () => ({
  useSettingsStore: {
    getState: () => ({ settings: { ollamaBaseUrl: "http://localhost:11434" } }),
  },
}));
beforeEach(() => vi.clearAllMocks());
describe("local SDK connections", () => {
  it("uses the local Ollama endpoint", async () => {
    expect(await getIntelligenceSdkModel("ollama", "qwen3")).toEqual({ id: "qwen3" });
    expect(mocks.compatible).toHaveBeenCalledWith(
      expect.objectContaining({ name: "ollama", baseURL: "http://localhost:11434/v1" }),
    );
  });
  it.each(["athas", "openai", "anthropic", "openrouter", "custom"])(
    "rejects %s before making a request",
    async (id) => {
      await expect(getIntelligenceSdkModel(id, "model")).rejects.toThrow("Only local Ollama");
      expect(mocks.compatible).not.toHaveBeenCalled();
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );
  it("rejects cloud models served through a local Ollama daemon", async () => {
    await expect(getIntelligenceSdkModel("ollama", "model:cloud")).rejects.toThrow("cloud models");
    expect(mocks.compatible).not.toHaveBeenCalled();
  });
});
