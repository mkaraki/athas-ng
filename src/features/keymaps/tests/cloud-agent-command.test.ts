import { describe, expect, it } from "vite-plus/test";
import { builtInCommands } from "../commands/command-registry";

describe("cloud agent command", () => {
  it("does not register the hosted agent action", () => {
    expect(builtInCommands.map((command) => command.id)).not.toContain("ai.openCloudAgents");
  });
});
