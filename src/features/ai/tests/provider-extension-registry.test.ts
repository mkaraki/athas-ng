import { describe, expect, it } from "vite-plus/test";
import { registerModelProviderExtension, getProviderById } from "../types/providers.types";
import { shouldUseTauriFetchForProvider } from "../services/providers/ai-provider-registry";
describe("local provider registry", () => {
  it("uses Tauri HTTP only for Ollama", () => {
    expect(shouldUseTauriFetchForProvider("ollama")).toBe(true);
    expect(shouldUseTauriFetchForProvider("openrouter")).toBe(false);
  });
  it("rejects catalog contributions without exposing the provider", () => {
    expect(() =>
      registerModelProviderExtension("remote", {
        id: "remote",
        name: "Remote",
        apiUrl: "https://example.test",
        requiresApiKey: true,
        models: [],
      }),
    ).toThrow("ACP");
    expect(getProviderById("remote")).toBeUndefined();
  });
});
