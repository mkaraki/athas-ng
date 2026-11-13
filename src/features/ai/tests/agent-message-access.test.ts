import { describe, expect, it } from "vite-plus/test";
import { getAgentMessageAccess } from "@/features/ai/lib/agent-message-access";
import { getAgentAccessMessage } from "@/features/ai/services/agent-turn-runner";

describe("agent message access", () => {
  it("allows Codex and ACP agents without a custom provider key", () => {
    expect(getAgentMessageAccess("codex", false).accepted).toBe(true);
    expect(getAgentMessageAccess("opencode", false).accepted).toBe(true);
  });

  it("requires a key only for the custom provider", () => {
    expect(getAgentMessageAccess("custom", false)).toMatchObject({ accepted: false });
    expect(getAgentMessageAccess("custom", true)).toEqual({ accepted: true });
  });

  it("explains unavailable Athas models and missing provider keys", () => {
    expect(getAgentMessageAccess("custom", false, "athas").error).toBe(
      "Choose another model in AI settings. Athas accounts are unavailable.",
    );
    expect(getAgentMessageAccess("custom", false, "openai").error).toBe(
      "Add your OpenAI API key in Settings to use OpenAI models.",
    );
    expect(getAgentAccessMessage("custom", "athas", undefined)).not.toMatch(/API key/);
  });
});
