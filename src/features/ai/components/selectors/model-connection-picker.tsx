import { useState } from "react";
import { ProviderIcon } from "@/features/ai/components/icons/provider-icons";
import { useProviderById } from "@/features/ai/hooks/use-available-providers";
import { getModelIconId } from "@/features/ai/lib/model-vendor";
import type { IntelligenceConnection } from "@/features/ai/intelligence/types/intelligence.types";
import { Button } from "@/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuEmpty,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSearch,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuViewport,
} from "@/ui/dropdown";
import { ChevronDownIcon } from "@/ui/icons";
import { cn } from "@/utils/cn";
import { type MenuSearch, useMenuSearch } from "@/ui/menu-search";
import {
  ModelResultsProvider,
  ProviderModels,
  useModelSearchResults,
} from "./model-connection-menu";
import { useConnectedModelProviders, useModelName } from "@/features/ai/hooks/use-model-providers";

const INHERIT_VALUE = "inherit";

interface ModelConnectionPickerProps {
  /** The chosen connection, or null when the picker follows another setting. */
  value: IntelligenceConnection | null;
  onChange: (connection: IntelligenceConnection | null) => void;
  /** Offers a first row that clears the choice, such as "Same as default". */
  inheritLabel?: string;
  disabled?: boolean;
  /**
   * What the model is for. Tab completion offers Athas's one Tab model instead of the Athas chat
   * catalog, since hosted completions always run on it.
   */
  purpose?: "chat" | "completion";
  /** `full` fills the parent, such as a settings row's shared dropdown width. */
  width?: "content" | "full";
  /** `subtle` drops the field chrome so the picker reads as secondary text inside another surface. */
  appearance?: "field" | "subtle";
  "aria-label": string;
}

/** Picks an installed model from a local Ollama connection. */
export function ModelConnectionPicker({
  value,
  onChange,
  inheritLabel,
  disabled,
  width = "content",
  appearance = "field",
  "aria-label": ariaLabel,
}: ModelConnectionPickerProps) {
  const [isContentMounted, setIsContentMounted] = useState(false);
  const search = useMenuSearch();
  const providerId = value?.providerId ?? "";
  const modelId = value?.modelId ?? "";
  const provider = useProviderById(providerId);
  const modelName = useModelName(providerId, modelId);
  const label = !value
    ? (inheritLabel ?? "Choose a model")
    : providerId === "auto"
      ? "Automatic"
      : modelName || modelId || provider?.name || "Choose a local model";
  const title = value && provider ? `${label} via ${provider.name}` : label;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        setIsContentMounted(open);
        if (!open) search.reset();
      }}
    >
      <span className={cn("inline-flex min-w-0 max-w-full", width === "full" && "w-full")}>
        <DropdownMenuTrigger
          disabled={disabled}
          render={
            <Button
              type="button"
              variant={appearance === "subtle" ? "ghost" : "outline"}
              size={appearance === "subtle" ? "sm" : undefined}
              width={width}
              align={appearance === "subtle" ? "start" : "between"}
              aria-label={`${ariaLabel}: ${label}`}
              title={title}
            />
          }
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {value ? <ProviderIcon providerId={getModelIconId(providerId, modelId)} /> : null}
            <span className="min-w-0 truncate">{label}</span>
          </span>
          <ChevronDownIcon size={12} className="shrink-0 text-subtle-foreground" />
        </DropdownMenuTrigger>
      </span>
      <DropdownMenuContent align="end" viewport="searchable" size="wide">
        <ModelConnectionMenuList
          value={value}
          onChange={onChange}
          inheritLabel={inheritLabel}
          search={search}
          isOpen={isContentMounted}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ModelConnectionMenuListProps {
  value: IntelligenceConnection | null;
  onChange: (connection: IntelligenceConnection | null) => void;
  inheritLabel?: string;
  purpose?: "chat" | "completion";
  search: MenuSearch;
  /** Model sections render only while the menu is open, since they read provider catalogs. */
  isOpen: boolean;
}

/**
 * The searchable model list itself, for a picker's own menu or a submenu of another menu such as
 * the Tab completion status menu. Render it inside a content with `viewport="searchable"`.
 */
export function ModelConnectionMenuList({
  value,
  onChange,
  inheritLabel,
  search,
  isOpen,
}: ModelConnectionMenuListProps) {
  const { reportResults, hasNoResults } = useModelSearchResults();
  const providerId = value?.providerId ?? "";
  const modelId = value?.modelId ?? "";
  const providers = useConnectedModelProviders(providerId ? [providerId] : []);

  return (
    <>
      <DropdownMenuSearch
        value={search.query}
        onChange={(event) => search.setQuery(event.target.value)}
        placeholder="Select a model…"
        autoFocus
      />
      <DropdownMenuViewport>
        {inheritLabel && !search.isSearching ? (
          <>
            <DropdownMenuRadioGroup
              value={value ? "" : INHERIT_VALUE}
              onValueChange={() => onChange(null)}
            >
              <DropdownMenuRadioItem value={INHERIT_VALUE} closeOnClick>
                {inheritLabel}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {isOpen ? (
          <ModelResultsProvider value={reportResults}>
            {providers.map((item) => (
              <ProviderModels
                key={item.id}
                providerId={item.id}
                providerName={item.name}
                selected={item.id === providerId ? modelId : ""}
                search={search}
                onSelect={(id) => onChange({ providerId: item.id, modelId: id })}
              />
            ))}
          </ModelResultsProvider>
        ) : null}
        {isOpen && search.isSearching && hasNoResults ? (
          <DropdownMenuEmpty>No matching models</DropdownMenuEmpty>
        ) : null}
      </DropdownMenuViewport>
    </>
  );
}
