// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const http = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: http.fetch }));
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

import { enableMapSet } from "immer";
import { commands } from "@/bindings/commands";
import { useAIModelOptions } from "../hooks/use-ai-model-options";
import { getProvider } from "../services/providers/ai-provider-registry";
import { useAIChatStore } from "../stores/ai-chat.store";

enableMapSet();

const getModels = vi.fn();

type Options = ReturnType<typeof useAIModelOptions>;
let root: Root;
let options: Options;
const onChange = vi.fn();

function Harness(props: { providerId: string; modelId: string; withChange?: boolean }) {
  options = useAIModelOptions(
    props.providerId,
    props.modelId,
    props.withChange ? onChange : undefined,
  );
  return null;
}

async function render(providerId: string, modelId = "", withChange = false) {
  await act(async () => root.render(createElement(Harness, { providerId, modelId, withChange })));
  await act(async () => {});
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  useAIChatStore.setState({ dynamicModels: {} });
  vi.spyOn(commands, "getAiProviderToken").mockResolvedValue("key");
  vi.spyOn(getProvider("ollama")!, "getModels").mockImplementation(getModels);
  root = createRoot(document.createElement("div"));
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks();
});

describe("useAIModelOptions", () => {
  it("fetches local models without a key and caches them", async () => {
    getModels.mockResolvedValue([{ id: "remote-1", name: "Remote One" }]);

    await render("ollama", "remote-1");

    expect(getModels).toHaveBeenCalledWith();
    expect(useAIChatStore.getState().dynamicModels.ollama).toEqual([
      { id: "remote-1", name: "Remote One" },
    ]);
    expect(options.availableModels.map((model) => model.id)).toContain("remote-1");
    expect(options.currentModelName).toBe("Remote One");
    expect(options.isLoadingModels).toBe(false);
    expect(options.modelFetchError).toBeNull();

    await render("ollama", "remote-1");
    expect(getModels).toHaveBeenCalledTimes(1);
  });

  it("shows a loading label until models arrive", async () => {
    let resolve: (models: unknown[]) => void = () => {};
    getModels.mockReturnValue(new Promise((done) => (resolve = done)));

    await render("ollama");
    expect(options.isLoadingModels).toBe(true);
    expect(options.currentModelName).toBe("Loading models…");

    await act(async () => resolve([{ id: "late", name: "Late" }]));
    expect(options.isLoadingModels).toBe(false);
  });

  it("reports an empty list and connection errors, and retries", async () => {
    getModels.mockResolvedValueOnce([]);
    await render("ollama");
    expect(options.modelFetchError).toBe("No models detected. Please install a model in Ollama.");
    expect(options.currentModelName).toBe("Select model");

    getModels.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await act(async () => options.retry());
    await act(async () => {});
    expect(options.modelFetchError).toBe("ECONNREFUSED");

    getModels.mockRejectedValueOnce("weird");
    await act(async () => options.retry());
    await act(async () => {});
    expect(options.modelFetchError).toBe("Could not connect to the provider.");
  });

  it("picks the first model when none is selected", async () => {
    getModels.mockResolvedValue([{ id: "remote-1", name: "Remote One" }]);
    await render("ollama", "", true);
    expect(onChange).toHaveBeenCalledWith(options.availableModels[0].id);
  });

  it("does not fetch models for a removed provider", async () => {
    await render("openai");
    expect(getModels).not.toHaveBeenCalled();
    expect(options.availableModels).toEqual([]);
  });
});
