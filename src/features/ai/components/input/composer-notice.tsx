import { useState } from "react";
import { ProviderApiKeyCommand } from "@/features/ai/components/provider-api-key-command";
import { useOnlineStatus } from "@/features/ai/hooks/use-online-status";
import { resolveComposerNotice } from "@/features/ai/lib/composer-notice";
import type {
  ComposerNoticeAction,
  ComposerNoticeActionId,
  ComposerNoticeIcon,
} from "@/features/ai/types/composer-notice.types";
import { getProviderById } from "@/features/ai/types/providers.types";
import { useUIState } from "@/features/layout/stores/ui-state.store";
import { Alert, AlertActions, AlertDescription, AlertTitle } from "@/ui/alert";
import { Button } from "@/ui/button";
import {
  CloudSlashIcon,
  CloudWarningIcon,
  CreditCardIcon,
  InfoIcon,
  KeyIcon,
  SignInIcon,
  WarningIcon,
  XIcon,
} from "@/ui/icons";
import { Spinner } from "@/ui/spinner";

const noticeIcons: Record<ComposerNoticeIcon, typeof InfoIcon> = {
  "sign-in": SignInIcon,
  "cloud-warning": CloudWarningIcon,
  offline: CloudSlashIcon,
  key: KeyIcon,
  credit: CreditCardIcon,
  warning: WarningIcon,
  info: InfoIcon,
};

interface ComposerNoticeProps {
  /** Whether the built-in agent drives this chat; other agents handle their own accounts. */
  builtInAgent: boolean;
  providerId: string;
  /** The built-in agent's provider has no key or account, so nothing can be sent. */
  providerBlocked: boolean;
  lastTurnFailedOffline?: boolean;
  onRetryLastTurn?: () => void;
}

/**
 * The composer's one notice slot. It shows the most important thing standing between the user
 * and a working chat (account, billing, connection, then usage) with at most two actions.
 */
export function ComposerNotice({
  builtInAgent,
  providerId,
  providerBlocked,
  lastTurnFailedOffline = false,
  onRetryLastTurn,
}: ComposerNoticeProps) {
  const hosted = builtInAgent && providerId === "athas";
  const online = useOnlineStatus();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [keyManagerOpen, setKeyManagerOpen] = useState(false);

  const notice = resolveComposerNotice({
    hosted,
    providerBlocked: builtInAgent && providerBlocked,
    providerName: getProviderById(providerId)?.name ?? providerId,
    auth: {
      isAuthenticated: false,
      isLoading: false,
      hasSubscription: false,
      error: null,
      sessionCheck: null,
    },
    signIn: { active: false, error: null },
    actionPending: false,
    usage: null,
    online,
    lastTurnOffline: lastTurnFailedOffline,
    dismissed,
  });

  const runAction = async (id: ComposerNoticeActionId) => {
    switch (id) {
      case "add-api-key":
        setKeyManagerOpen(true);
        return;
      case "configure-models":
        useUIState.getState().openSettings("ai");
        return;
      case "retry-turn":
        onRetryLastTurn?.();
        return;
    }
  };

  const renderAction = (action: ComposerNoticeAction, primary: boolean) => {
    const busy = primary && notice?.busy;
    return (
      <Button
        type="button"
        size="xs"
        variant={primary ? "default" : "ghost"}
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => void runAction(action.id)}
      >
        {busy ? <Spinner compact label={action.label} /> : null}
        {action.label}
      </Button>
    );
  };

  const Icon = notice ? noticeIcons[notice.icon] : null;

  return (
    <>
      {notice && Icon ? (
        <div className="px-1.5 pt-1.5">
          <Alert
            key={notice.id}
            tone={notice.tone}
            variant="inset"
            role={notice.tone === "error" ? "alert" : "status"}
            aria-live="polite"
            data-notice-id={notice.id}
          >
            <Icon />
            <AlertTitle>{notice.title}</AlertTitle>
            <AlertDescription>{notice.description}</AlertDescription>
            {notice.primary || notice.secondary || notice.dismissible ? (
              <AlertActions>
                {notice.secondary ? renderAction(notice.secondary, false) : null}
                {notice.primary ? renderAction(notice.primary, true) : null}
                {notice.dismissible ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    iconOnly
                    tooltip="Dismiss"
                    onClick={() => setDismissed((current) => new Set(current).add(notice.id))}
                  >
                    <XIcon />
                  </Button>
                ) : null}
              </AlertActions>
            ) : null}
          </Alert>
        </div>
      ) : null}
      {builtInAgent && !hosted ? (
        <ProviderApiKeyCommand
          isOpen={keyManagerOpen}
          onClose={() => setKeyManagerOpen(false)}
          initialProviderId={providerId}
        />
      ) : null}
    </>
  );
}
