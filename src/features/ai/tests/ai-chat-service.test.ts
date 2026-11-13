import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getChatCompletionStream } from "../services/ai-chat-service";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  run: vi.fn(),
  localModel: { id: "qwen3", name: "Qwen", maxTokens: 4096 },
}));
vi.mock("../services/acp-stream-handler", () => ({
  AcpStreamHandler: class {
    start = mocks.start;
  },
}));
vi.mock("../intelligence/services/intelligence-agent", () => ({ runIntelligenceAgent: mocks.run }));
vi.mock("../intelligence/services/intelligence-connection", () => ({
  getIntelligenceConnection: async () => ({ providerId: "ollama", modelId: "qwen3" }),
  assertIntelligenceConnectionAllowed: (id: string) => {
    if (id !== "ollama") throw new Error("Only local Ollama models are supported.");
  },
}));
vi.mock("@/features/ai/stores/ai-chat.store", () => ({
  useAIChatStore: { getState: () => ({ dynamicModels: { ollama: [mocks.localModel] } }) },
}));
vi.mock("@/features/settings/stores/settings.store", () => ({
  useSettingsStore: { getState: () => ({ settings: { aiAgentMaxSteps: 5, aiUserRules: "" } }) },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.run.mockResolvedValue({ outcome: "completed" });
});
describe("chat transport selection", () => {
  it("dispatches an ACP agent without a direct provider", async () => {
    const context = {};
    await getChatCompletionStream("opencode", "", "", "Hello", context, vi.fn(), vi.fn(), vi.fn());
    expect(mocks.start).toHaveBeenCalledWith("Hello", context);
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("runs the local Ollama agent", async () => {
    const complete = vi.fn();
    await getChatCompletionStream(
      "custom",
      "ollama",
      "qwen3",
      "Hello",
      {},
      vi.fn(),
      complete,
      vi.fn(),
    );
    expect(mocks.run).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: "ollama", modelId: "qwen3" }),
    );
    expect(complete).toHaveBeenCalledWith({ outcome: "completed" });
  });
  it.each([
    ["custom", "athas"],
    ["custom", "openai"],
    ["codex", ""],
  ])("rejects removed transport %s/%s", async (agent, provider) => {
    const error = vi.fn();
    await getChatCompletionStream(agent, provider, "model", "Hello", {}, vi.fn(), vi.fn(), error);
    expect(error).toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
