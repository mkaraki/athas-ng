import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const http = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: http.fetch }));

import {
  OllamaProvider,
  checkOllamaConnection,
  fetchOllamaModelCapabilities,
} from "@/features/ai/services/providers/ollama-provider";

const browserFetch = vi.fn();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function config(id: string, apiUrl = `https://${id}.example/v1/chat/completions`) {
  return { id, name: id, apiUrl, requiresApiKey: true, maxTokens: 4096 };
}

function lastRequest(mock: ReturnType<typeof vi.fn>) {
  const [url, init] = mock.mock.calls[mock.mock.calls.length - 1] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

beforeEach(() => {
  http.fetch.mockReset();
  browserFetch.mockReset();
  vi.stubGlobal("fetch", browserFetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Ollama provider", () => {
  it("targets the OpenAI-compatible chat endpoint of the normalized base URL", () => {
    const provider = new OllamaProvider(config("ollama"));
    expect(provider.buildUrl()).toBe("http://localhost:11434/v1/chat/completions");

    provider.setBaseUrl("192.168.1.5:11434/");
    expect(provider.getBaseUrl()).toBe("http://192.168.1.5:11434");
    expect(provider.buildUrl()).toBe("http://192.168.1.5:11434/v1/chat/completions");

    provider.setBaseUrl("not a url ?x=1");
    expect(provider.getBaseUrl()).toBe("http://localhost:11434");
  });

  it("prefers the request key over the stored key and drops empty keys", () => {
    const provider = new OllamaProvider(config("ollama"));
    provider.setApiKey("stored");
    expect(provider.getApiKey()).toBe("stored");
    expect(provider.buildHeaders()).toMatchObject({ Authorization: "Bearer stored" });
    expect(provider.buildHeaders("request")).toMatchObject({ Authorization: "Bearer request" });

    provider.setApiKey("");
    expect(provider.getApiKey()).toBeNull();
    expect(provider.buildHeaders()).toEqual({ "Content-Type": "application/json" });
  });

  it("builds a streaming payload", () => {
    const provider = new OllamaProvider(config("ollama"));
    expect(
      provider.buildPayload({
        modelId: "llama3",
        messages: [{ role: "user", content: "hi" }],
        maxTokens: 100,
        temperature: 0.1,
      }),
    ).toEqual({
      model: "llama3",
      messages: [{ role: "user", content: "hi" }],
      stream: true,
      temperature: 0.1,
      max_tokens: 100,
    });
  });

  it("lists installed models with parameter sizes and skips unnamed entries", async () => {
    const provider = new OllamaProvider(config("ollama"));
    provider.setApiKey("cloud-key");
    http.fetch.mockResolvedValueOnce(
      json({
        models: [
          { name: "llama3:8b", details: { parameter_size: "8B" } },
          { model: "qwen2" },
          { details: {} },
        ],
      }),
    );

    expect(await provider.getModels()).toEqual([
      { id: "llama3:8b", name: "llama3:8b (8B)", maxOutputTokens: 4096 },
      { id: "qwen2", name: "qwen2", maxOutputTokens: 4096 },
    ]);
    const request = lastRequest(http.fetch);
    expect(request.url).toBe("http://localhost:11434/api/tags");
    expect(request.headers.Authorization).toBe("Bearer cloud-key");
  });

  it("returns no models when the server errors or is unreachable", async () => {
    const provider = new OllamaProvider(config("ollama"));
    http.fetch.mockResolvedValueOnce(json({}, 500));
    expect(await provider.getModels()).toEqual([]);

    http.fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await provider.getModels()).toEqual([]);
  });

  it("times out a hung server instead of waiting forever", async () => {
    vi.useFakeTimers();
    try {
      http.fetch.mockReturnValue(new Promise(() => {}));
      const pending = checkOllamaConnection("http://localhost:11434");
      await vi.advanceTimersByTimeAsync(5000);
      expect(await pending).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("validates keys against the local server only", async () => {
    const provider = new OllamaProvider(config("ollama"));
    http.fetch.mockResolvedValueOnce(json({ models: [] }));
    expect(await provider.validateApiKey("key")).toBe(true);
    expect(lastRequest(http.fetch).url).toBe("http://localhost:11434/api/tags");

    provider.setBaseUrl("https://eu.ollama.com");
    http.fetch.mockResolvedValueOnce(json({}, 401));
    expect(await provider.validateApiKey("bad")).toBe(false);
    expect(lastRequest(http.fetch).url).toBe("http://localhost:11434/api/tags");
  });

  it("reads model capabilities from /api/show", async () => {
    http.fetch.mockResolvedValueOnce(json({ capabilities: ["completion", 3, "tools"] }));
    expect(await fetchOllamaModelCapabilities("http://localhost:11434", "llama3", "k")).toEqual([
      "completion",
      "tools",
    ]);
    const request = lastRequest(http.fetch);
    expect(request.url).toBe("http://localhost:11434/api/show");
    expect(JSON.parse(request.init.body as string)).toEqual({ model: "llama3" });

    http.fetch.mockResolvedValueOnce(json({}));
    expect(await fetchOllamaModelCapabilities("http://localhost:11434", "old")).toBeNull();

    http.fetch.mockResolvedValueOnce(json({}, 404));
    expect(await fetchOllamaModelCapabilities("http://localhost:11434", "missing")).toBeNull();

    http.fetch.mockRejectedValueOnce(new Error("down"));
    expect(await fetchOllamaModelCapabilities("http://localhost:11434", "x")).toBeNull();
  });
});
