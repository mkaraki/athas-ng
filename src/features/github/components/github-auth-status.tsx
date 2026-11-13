import { useUIState } from "@/features/layout/stores/ui-state.store";
import { EmptyState } from "@/ui/empty";
import { Spinner } from "@/ui/spinner";
import { useGitHubStore } from "../stores/github.store";

export function GitHubAuthStatusMessage({
  layout = "default",
}: {
  layout?: "default" | "sidebar";
}) {
  const checking = useGitHubStore.use.isCheckingAuth();
  const openSettings = useUIState((state) => state.openSettings);
  return (
    <EmptyState
      layout={layout}
      title={checking ? undefined : "Connect GitHub with the CLI or a personal access token"}
      message={
        checking ? <Spinner label="Checking GitHub credentials" showLabel compact /> : undefined
      }
      action={
        checking
          ? undefined
          : { label: "GitHub settings", onClick: () => openSettings("git", "GitHub Account") }
      }
    />
  );
}
