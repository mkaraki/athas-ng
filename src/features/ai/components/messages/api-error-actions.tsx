import { useState } from "react";
import { toast } from "sonner";
import { openNewAgentChat } from "@/features/ai/services/open-new-agent-chat";
import { useUIState } from "@/features/layout/stores/ui-state.store";
import { Button } from "@/ui/button";

export function ApiErrorActions({
  code,
  serverCode,
  providerId,
  onRetry,
}: {
  code: string;
  serverCode?: string;
  billingUrl?: string;
  providerId: string;
  onRetry?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const tooLarge = serverCode === "request_too_large" || code === "413";
  const configure = providerId !== "ollama" || ["401", "402", "403"].includes(code);
  const openSettings = () => useUIState.getState().openSettings("ai");
  const recover = async () => {
    setBusy(true);
    try {
      if (configure) openSettings();
      else if (tooLarge) openNewAgentChat();
      else if (onRetry) await onRetry();
      else openSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete the action.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="default" disabled={busy} onClick={() => void recover()}>
      {busy
        ? "Working…"
        : configure
          ? "Configure models"
          : tooLarge
            ? "Start new chat"
            : onRetry
              ? "Try again"
              : "Configure models"}
    </Button>
  );
}
