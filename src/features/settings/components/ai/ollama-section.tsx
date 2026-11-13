import { ProviderIcon } from "@/features/ai/components/icons/provider-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_OLLAMA_BASE_URL,
  resolveOllamaBaseUrl,
} from "@/features/settings/services/ollama-endpoint";
import { setOllamaBaseUrl } from "@/features/ai/services/providers/ai-provider-registry";
import { checkOllamaConnection } from "@/features/ai/services/providers/ollama-provider";
import { getDefaultSetting } from "@/features/settings/config/default-settings";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { Button } from "@/ui/button";
import { ArrowCounterClockwiseIcon } from "@/ui/icons";
import Input from "@/ui/input";
import { Spinner } from "@/ui/spinner";
import Section, { SettingRow } from "../settings-section";

type OllamaStatus = "idle" | "checking" | "ok" | "error";

/** Ollama on this machine or the local network. */
export function OllamaSection() {
  const ollamaBaseUrl = useSettingsStore((state) => state.settings.ollamaBaseUrl);
  const updateSetting = useSettingsStore((state) => state.actions.updateSetting);
  const [ollamaUrl, setOllamaUrl] = useState(ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>("idle");
  const ollamaDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ollamaDraftDirtyRef = useRef(false);
  const ollamaValidationIdRef = useRef(0);

  // Keep the draft aligned with settings loaded after the page mounted.
  useEffect(() => {
    const url = resolveOllamaBaseUrl(ollamaBaseUrl) || DEFAULT_OLLAMA_BASE_URL;
    setOllamaBaseUrl(url);

    if (!ollamaDraftDirtyRef.current) {
      if (ollamaDebounceRef.current) clearTimeout(ollamaDebounceRef.current);
      setOllamaUrl(url);
    }
  }, [ollamaBaseUrl]);

  useEffect(
    () => () => {
      if (ollamaDebounceRef.current) clearTimeout(ollamaDebounceRef.current);
      ollamaValidationIdRef.current += 1;
    },
    [],
  );

  const validateOllamaConnection = useCallback(async (url: string) => {
    const normalizedUrl = resolveOllamaBaseUrl(url);
    const validationId = ++ollamaValidationIdRef.current;
    if (!normalizedUrl) {
      setOllamaStatus("error");
      return;
    }

    setOllamaStatus("checking");
    const ok = await checkOllamaConnection(normalizedUrl);
    if (validationId === ollamaValidationIdRef.current) {
      setOllamaStatus(ok ? "ok" : "error");
    }
  }, []);

  const commitOllamaUrl = useCallback(
    (value: string) => {
      if (ollamaDebounceRef.current) {
        clearTimeout(ollamaDebounceRef.current);
        ollamaDebounceRef.current = undefined;
      }

      const normalizedUrl = resolveOllamaBaseUrl(value);
      if (!normalizedUrl) {
        setOllamaStatus("error");
        return;
      }

      ollamaDraftDirtyRef.current = false;
      setOllamaUrl(normalizedUrl);
      void updateSetting("ollamaBaseUrl", normalizedUrl);
      setOllamaBaseUrl(normalizedUrl);
      void validateOllamaConnection(normalizedUrl);
    },
    [updateSetting, validateOllamaConnection],
  );

  const handleOllamaUrlChange = (value: string) => {
    ollamaDraftDirtyRef.current = true;
    setOllamaUrl(value);
    setOllamaStatus("idle");

    if (ollamaDebounceRef.current) clearTimeout(ollamaDebounceRef.current);
    ollamaDebounceRef.current = setTimeout(() => {
      ollamaDebounceRef.current = undefined;
      void commitOllamaUrl(value);
    }, 600);
  };

  const handleResetOllamaUrl = () => {
    commitOllamaUrl(DEFAULT_OLLAMA_BASE_URL);
  };

  const statusLabel = {
    idle: "Local Ollama server",
    checking: "Checking",
    ok: "Connected",
    error: "Use a local address and check that Ollama is running.",
  }[ollamaStatus];

  return (
    <Section title="Ollama" icon={<ProviderIcon providerId="ollama" />}>
      <SettingRow
        label="Server address"
        description={statusLabel}
        control="field"
        activateOnClick={false}
      >
        <Input
          type="text"
          grow
          value={ollamaUrl}
          onChange={(e) => handleOllamaUrlChange(e.target.value)}
          onBlur={(e) => {
            void commitOllamaUrl(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            e.currentTarget.blur();
          }}
          placeholder={DEFAULT_OLLAMA_BASE_URL}
          spellCheck={false}
          aria-label="Ollama server address"
          aria-invalid={ollamaStatus === "error" || undefined}
        />
        {ollamaStatus === "checking" ? <Spinner label="Checking" compact /> : null}
        {ollamaBaseUrl !== getDefaultSetting("ollamaBaseUrl") ? (
          <Button
            type="button"
            variant="ghost"
            iconOnly
            onClick={handleResetOllamaUrl}
            tooltip="Reset address"
            aria-label="Reset Ollama address to default"
          >
            <ArrowCounterClockwiseIcon />
          </Button>
        ) : null}
      </SettingRow>
    </Section>
  );
}
