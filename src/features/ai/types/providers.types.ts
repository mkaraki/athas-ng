export interface ModelProvider {
  id: string;
  name: string;
  apiUrl: string;
  requiresApiKey: boolean;
  requiresAuth?: boolean;
  apiKeyUrl?: string;
  apiKeyPlaceholder?: string;
  maxTokens?: number;
  models: Model[];
}

export interface Model {
  id: string;
  name: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  maxTokens?: number;
  proOnly?: boolean;
  /** Whether the model reads images; reported per model by the Athas catalog. */
  supportsImages?: boolean;
}

// Helper to check if a provider ID is an agent

// Get agent by ID

// Update agent installation status

const AI_PROVIDERS: ModelProvider[] = [
  {
    id: "ollama",
    name: "Ollama",
    apiUrl: "http://localhost:11434/v1/chat/completions",
    requiresApiKey: false,
    models: [],
  },
];

export const subscribeToAvailableProviders: (listener: () => void) => () => void = () => () => {};
export const registerModelProviderExtension: (
  extensionId: string,
  provider: ModelProvider,
) => void = () => {
  throw new Error("Direct provider extensions are not supported. Use an ACP agent instead.");
};
export const unregisterModelProviderExtensions: (extensionId: string) => void = () => {};
export const getAvailableProviders = (): ModelProvider[] => AI_PROVIDERS;

// Get installed agents only

export const getProviderById = (id: string): ModelProvider | undefined => {
  return getAvailableProviders().find((provider) => provider.id === id);
};

export const getModelById = (providerId: string, modelId: string): Model | undefined => {
  const provider = getProviderById(providerId);
  return provider?.models.find((model) => model.id === modelId);
};
