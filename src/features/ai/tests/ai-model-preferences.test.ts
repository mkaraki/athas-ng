import { describe, expect, it } from "vite-plus/test";
import { defaultIntelligencePreferences } from "@/features/ai/intelligence/lib/intelligence-preferences";
import {
  AI_FEATURE_MODEL_OVERRIDES,
  countTaskOverrides,
  getEffectiveDefaultConnection,
  isConnectionAvailable,
  withDefaultConnection,
  withTaskConnection,
} from "../services/ai-model-preferences";

const openai = { providerId: "openai", modelId: "gpt-test" };
const ollama = { providerId: "ollama", modelId: "llama3" };

describe("AI model preferences", () => {
  it("shows the model the automatic default actually runs", () => {
    const preferences = defaultIntelligencePreferences();

    expect(
      getEffectiveDefaultConnection({
        preferences,
        hasIntelligence: true,
        personalConnection: openai,
        personalConnectionIsLocal: false,
      }),
    ).toEqual({ providerId: "ollama", modelId: "" });
    expect(
      getEffectiveDefaultConnection({
        preferences,
        hasIntelligence: false,
        personalConnection: openai,
        personalConnectionIsLocal: false,
      }),
    ).toEqual({ providerId: "ollama", modelId: "" });
    expect(
      getEffectiveDefaultConnection({
        preferences,
        hasIntelligence: true,
        personalConnection: ollama,
        personalConnectionIsLocal: true,
      }),
    ).toEqual(ollama);
  });

  it("treats removed providers as unavailable", () => {
    expect(isConnectionAvailable({ providerId: "athas", modelId: "auto" })).toBe(false);
    expect(isConnectionAvailable(ollama)).toBe(true);
  });

  it("ignores per-feature choices when describing the default", () => {
    const preferences = withTaskConnection(
      withDefaultConnection(defaultIntelligencePreferences(), openai),
      "agent",
      ollama,
    );

    expect(
      getEffectiveDefaultConnection({
        preferences,
        hasIntelligence: true,
        personalConnection: openai,
        personalConnectionIsLocal: false,
      }),
    ).toEqual({ providerId: "ollama", modelId: "" });
  });

  it("sets and clears a feature's model without touching the others", () => {
    const withCompletion = withTaskConnection(
      defaultIntelligencePreferences(),
      "autocomplete",
      ollama,
    );
    const withTitles = withTaskConnection(withCompletion, "chat-title", openai);

    expect(withTitles.tasks).toEqual({ autocomplete: ollama, "chat-title": openai });
    expect(withTaskConnection(withTitles, "autocomplete", null).tasks).toEqual({
      "chat-title": openai,
    });
    expect(withCompletion.tasks).toEqual({ autocomplete: ollama });
  });

  it("counts changed features apart from Tab completion", () => {
    const preferences = withTaskConnection(
      withTaskConnection(defaultIntelligencePreferences(), "autocomplete", ollama),
      "commit-message",
      openai,
    );
    const tasks = AI_FEATURE_MODEL_OVERRIDES.map(({ task }) => task);

    expect(tasks).not.toContain("autocomplete");
    expect(countTaskOverrides(preferences, tasks)).toBe(1);
  });
});
