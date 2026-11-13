// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ModelConnectionPicker } from "../components/selectors/model-connection-picker";

const state = vi.hoisted(() => ({
  keys: new Map([["ollama", true]]),
  providers: [{ id: "ollama", name: "Ollama", models: [] }],
  models: { ollama: [{ id: "llama3", name: "llama3" }] } as Record<
    string,
    { id: string; name: string }[]
  >,
}));
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({ label: "main" }),
  getAllWebviewWindows: async () => [],
}));
vi.mock("../hooks/use-available-providers", () => ({
  useAvailableProviders: () => state.providers,
  useProviderById: (id: string) => state.providers.find((provider) => provider.id === id),
}));
vi.mock("../hooks/use-ai-model-options", () => ({
  useAIModelOptions: (id: string) => ({
    availableModels: state.models[id] ?? [],
    isLoadingModels: false,
    modelFetchError: null,
  }),
}));
vi.mock("../stores/ai-chat.store", () => ({
  useAIChatStore: (select: (value: unknown) => unknown) =>
    select({ providerApiKeys: state.keys, dynamicModels: {} }),
}));

let root: Root;
let container: HTMLDivElement;
const onChange = vi.fn();

async function render(props: Partial<Parameters<typeof ModelConnectionPicker>[0]> = {}) {
  await act(async () =>
    root.render(
      <ModelConnectionPicker
        aria-label="Default model"
        value={{ providerId: "ollama", modelId: "llama3" }}
        onChange={onChange}
        {...props}
      />,
    ),
  );
}
const trigger = () => container.querySelector<HTMLButtonElement>("button")!;
const rows = () => [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
const sections = () =>
  [...document.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-label"]')].map(
    (item) => item.textContent,
  );

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  Element.prototype.getAnimations = () => [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("settings model picker", () => {
  it("names the current choice and offers the same connections as the composer", async () => {
    await render();
    expect(trigger().textContent).toBe("llama3");
    await act(async () => trigger().click());
    expect(sections()).toEqual(["Ollama"]);
  });

  it("chooses a local model from its connection", async () => {
    await render();
    await act(async () => trigger().click());
    await act(async () =>
      rows()
        .find((row) => row.textContent?.includes("llama3"))!
        .click(),
    );
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ providerId: "ollama", modelId: "llama3" });
  });

  it("follows the default until a feature gets its own model", async () => {
    await render({ value: null, inheritLabel: "Same as default" });
    expect(trigger().textContent).toBe("Same as default");
    await act(async () => trigger().click());
    const inherit = rows().find((row) => row.textContent === "Same as default")!;
    expect(inherit.getAttribute("aria-checked")).toBe("true");

    await render({
      value: { providerId: "ollama", modelId: "llama3" },
      inheritLabel: "Same as default",
    });
    expect(trigger().getAttribute("title")).toBe("llama3 via Ollama");
    await act(async () =>
      rows()
        .find((row) => row.textContent === "Same as default")!
        .click(),
    );
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("names a feature's saved Automatic choice instead of its raw provider id", async () => {
    await render({ value: { providerId: "auto", modelId: "" }, inheritLabel: "Same as default" });
    expect(trigger().textContent).toBe("Automatic");
  });

  it("offers local models for Tab completion", async () => {
    await render({ value: null, inheritLabel: "Automatic", purpose: "completion" });
    expect(trigger().textContent).toBe("Automatic");
    await act(async () => trigger().click());
    expect(sections()).toEqual(["Ollama"]);
    expect(rows().map((row) => row.textContent)).toContain("llama3");
    expect(rows().some((row) => row.textContent?.includes("Kimi"))).toBe(false);
    await act(async () =>
      rows()
        .find((row) => row.textContent?.startsWith("llama3"))!
        .click(),
    );
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ providerId: "ollama", modelId: "llama3" });

    await render({ value: { providerId: "ollama", modelId: "llama3" }, purpose: "completion" });
    expect(trigger().textContent).toBe("llama3");
  });
});
