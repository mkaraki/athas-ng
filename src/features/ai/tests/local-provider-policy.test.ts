import { describe, expect, it, vi } from "vite-plus/test";
import { getAvailableProviders } from "../types/providers.types";
import {
  getProvider,
  registerAIProviderExtension,
} from "../services/providers/ai-provider-registry";
import {
  resolveOllamaBaseUrl,
  normalizeOllamaBaseUrl,
} from "@/features/settings/services/ollama-endpoint";
import {
  resolveIntelligenceConnection,
  resolveAutocompleteConnection,
} from "../intelligence/services/resolve-intelligence-connection";

describe("local model policy", () => {
  it("only exposes Ollama and rejects removed providers", () => {
    expect(getAvailableProviders().map((provider) => provider.id)).toEqual(["ollama"]);
    for (const id of ["athas", "openai", "anthropic", "gemini", "custom", "openrouter", "vercel"])
      expect(getProvider(id)).toBeUndefined();
    expect(getProvider("ollama")).toBeDefined();
  });
  it("does not instantiate direct provider extensions", () => {
    const createProvider = vi.fn();
    expect(() =>
      registerAIProviderExtension({
        extensionId: "remote",
        provider: {
          id: "remote",
          name: "Remote",
          apiUrl: "https://example.com",
          requiresApiKey: false,
          models: [],
        },
        createProvider,
      }),
    ).toThrow("ACP");
    expect(createProvider).not.toHaveBeenCalled();
  });
  it("accepts local addresses and migrates remote Ollama settings", () => {
    expect(resolveOllamaBaseUrl("localhost:11434")).toBe("http://localhost:11434");
    expect(resolveOllamaBaseUrl("http://192.168.1.2:11434")).toBe("http://192.168.1.2:11434");
    expect(resolveOllamaBaseUrl("https://ollama.com")).toBeNull();
    expect(resolveOllamaBaseUrl("https://example.com")).toBeNull();
    expect(normalizeOllamaBaseUrl("https://ollama.com")).toBe("http://localhost:11434");
  });
  it("resolves saved hosted selections to the local default", () => {
    const context = {
      preferences: {
        autoRouting: false,
        defaultConnection: { providerId: "athas", modelId: "auto" },
        tasks: {},
      },
      hasIntelligence: true,
      personalConnection: { providerId: "ollama", modelId: "qwen3" },
    };
    expect(resolveIntelligenceConnection({ ...context, task: "agent" })).toEqual(
      context.personalConnection,
    );
    expect(resolveAutocompleteConnection(context)).toEqual(context.personalConnection);
  });
});
