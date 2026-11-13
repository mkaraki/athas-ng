import { ModelConnectionPicker } from "@/features/ai/components/selectors/model-connection-picker";
import type { IntelligenceConnection } from "@/features/ai/intelligence/types/intelligence.types";
import { useAIModelSettings } from "@/features/ai/hooks/use-ai-model-settings";
import {
  isConnectionAvailable,
  withDefaultConnection,
} from "@/features/ai/services/ai-model-preferences";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { useUIState } from "@/features/layout/stores/ui-state.store";
import { Button } from "@/ui/button";
import Section, { SettingRow, SettingStatus } from "../settings-section";

/**
 * The model new chats and every AI feature except Tab completion use. It saves as it changes and
 * is mirrored on this device, so the composer shows it before a chat exists.
 */
export function DefaultModelSection() {
  const state = useAIModelSettings();
  const { defaultConnection, locked, error, loading, actions } = state;
  const updateSetting = useSettingsStore((store) => store.actions.updateSetting);
  const available = isConnectionAvailable(defaultConnection);
  const openModelsPage = (section?: string) =>
    useUIState.getState().openSettings("ai-models", section);

  const changeDefault = (connection: IntelligenceConnection | null) => {
    if (!connection) return;
    actions.change(withDefaultConnection(state.preferences, connection));
    void updateSetting("aiProviderId", connection.providerId);
    void updateSetting("aiModelId", connection.modelId);
  };

  return (
    <Section title="Default model">
      {!available ? (
        <SettingRow
          label="No model yet"
          description="Connect Ollama and choose an installed local model"
          activateOnClick={false}
        >
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => openModelsPage("Ollama")}>
              Use Ollama
            </Button>
          </div>
        </SettingRow>
      ) : null}
      <SettingRow
        label="Default model"
        control="select"
        description={available ? "Runs locally" : "Choose a local model to start"}
      >
        <ModelConnectionPicker
          aria-label="Default model"
          width="full"
          value={available ? defaultConnection : null}
          onChange={changeDefault}
          disabled={locked}
        />
      </SettingRow>
      {error ? (
        <SettingRow
          label="Could not save"
          description={<SettingStatus tone="danger">{error}</SettingStatus>}
        >
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={loading || !state.editable}
              onClick={() => void actions.save()}
            >
              Try again
            </Button>
            {state.userId !== null ? (
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => void actions.refresh(true)}
              >
                Use saved settings
              </Button>
            ) : null}
          </div>
        </SettingRow>
      ) : null}
    </Section>
  );
}
