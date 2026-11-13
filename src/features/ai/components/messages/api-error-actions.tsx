import { useState } from "react";
import { toast } from "sonner";
import { ProviderApiKeyCommand } from "../provider-api-key-command";
import { HOSTED_BILLING_CODES } from "@/features/ai/lib/api-error";
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
  /** The server's own reason, such as `insufficient_balance`, when it sent one. */
  serverCode?: string;
  billingUrl?: string;
  providerId: string;
  onRetry?: () => void | Promise<void>;
}) {
  const [keyManagerOpen, setKeyManagerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const hosted = providerId === "athas";
  const authentication = code === "401";
  const tooLarge = serverCode === "request_too_large" || code === "413";
  const payment = !tooLarge && (code === "402" || HOSTED_BILLING_CODES.has(serverCode ?? ""));
  const configure = authentication || code === "403" || payment;
  const run = async (action: () => void | Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete the action.");
    } finally {
      setBusy(false);
    }
  };
  const openSettings = () => useUIState.getState().openSettings("ai");
  const recover = () => {
    if (tooLarge) {
      openNewAgentChat();
      return;
    }
    if (hosted) return openSettings();
    if (configure) {
      setKeyManagerOpen(true);
      return;
    }
    if (onRetry) return onRetry();
    openSettings();
  };
  const label = tooLarge
    ? "Start new chat"
    : hosted
      ? "Configure models"
      : configure
        ? "Configure provider"
        : onRetry
          ? "Try again"
          : "Configure models";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="default" disabled={busy} onClick={() => void run(recover)}>
        {busy ? "Working…" : label}
      </Button>
      {label !== "Configure models" ? (
        <Button variant="ghost" onClick={openSettings}>
          Model settings
        </Button>
      ) : null}
      {!hosted ? (
        <ProviderApiKeyCommand
          isOpen={keyManagerOpen}
          onClose={() => setKeyManagerOpen(false)}
          initialProviderId={providerId}
        />
      ) : null}
    </div>
  );
}
