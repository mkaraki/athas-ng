import { describe, expect, it } from "vite-plus/test";
import { registerWorkbenchContributions } from "@/features/bootstrap/services/register-workbench-contributions";
import { getSidebarViews } from "@/features/layout/services/sidebar-view-registry";
import { getPaneView } from "@/features/panes/services/pane-view-registry";

describe("retired account collaboration", () => {
  it("has no sidebar or hosted workspace entrypoint", () => {
    registerWorkbenchContributions();
    expect(getSidebarViews().map((view) => view.id)).not.toContain("collaboration");
    expect(getPaneView("workspaces")).toBeUndefined();
  });
});
