import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { requestInlineEdit } from "../intelligence/services/intelligence-text-service";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), model: vi.fn() }));
vi.mock("ai", () => ({ generateText: mocks.generate }));
vi.mock("../intelligence/services/intelligence-sdk-model", () => ({
  getIntelligenceSdkModel: mocks.model,
}));
vi.mock("../intelligence/services/intelligence-connection", () => ({
  getIntelligenceConnection: async () => ({ providerId: "ollama", modelId: "qwen3" }),
  assertIntelligenceConnectionAllowed: (id: string) => {
    if (id !== "ollama") throw new Error("Only local Ollama models are supported.");
  },
}));
const request = { model: "qwen3", beforeSelection: "", selectedText: "let x = 1;" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.model.mockResolvedValue({ id: "local" });
  mocks.generate.mockResolvedValue({ text: "```ts\nconst x = 1;\n```", finishReason: "stop" });
});
describe("local intelligence text", () => {
  it("uses the local SDK model and cleans fenced replacements", async () => {
    expect(await requestInlineEdit(request)).toEqual({ editedText: "const x = 1;" });
    expect(mocks.model).toHaveBeenCalledWith("ollama", "qwen3", undefined);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetries: 0, maxOutputTokens: 4096 }),
    );
  });
  it("never dispatches an explicit removed provider", async () => {
    await expect(requestInlineEdit({ ...request, provider: "athas" })).rejects.toThrow(
      "Only local",
    );
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects truncated replacements but allows bounded autocomplete", async () => {
    mocks.generate.mockResolvedValue({ text: "partial", finishReason: "length" });
    await expect(requestInlineEdit(request)).rejects.toThrow("exceeded its limit");
    expect(await requestInlineEdit({ ...request, feature: "autocomplete" })).toEqual({
      editedText: "partial",
    });
    expect(mocks.generate).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxOutputTokens: 256 }),
    );
  });
  it("honors cancellation before generation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(requestInlineEdit(request, { signal: controller.signal })).rejects.toThrow();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
