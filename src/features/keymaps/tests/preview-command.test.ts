import { describe, expect, it } from "vite-plus/test";
import { builtInCommands } from "../commands/command-registry";

describe("preview command", () => {
  it("does not register account-backed previews", () => {
    expect(builtInCommands.map((command) => command.id)).not.toContain("preview.shareLocalServer");
  });
});
