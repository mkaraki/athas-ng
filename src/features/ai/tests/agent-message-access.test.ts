import { describe, expect, it } from "vite-plus/test";
import { getAgentMessageAccess } from "../lib/agent-message-access";

describe("agent message access", () => {
  it("allows ACP agents without a provider key", () => {
    expect(getAgentMessageAccess("opencode", false).accepted).toBe(true);
  });
  it("allows local Ollama and rejects obsolete transports even with cached access", () => {
    expect(getAgentMessageAccess("custom", true, "ollama").accepted).toBe(true);
    expect(getAgentMessageAccess("custom", false, "ollama").accepted).toBe(false);
    for (const provider of ["athas", "openai", "custom"]) {
      expect(getAgentMessageAccess("custom", true, provider).accepted).toBe(false);
    }
    expect(getAgentMessageAccess("codex", true).accepted).toBe(false);
  });
});
