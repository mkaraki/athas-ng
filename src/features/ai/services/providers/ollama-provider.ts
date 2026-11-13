import { toOpenAIMessage } from "@/features/ai/lib/image-attachments";
import { tauriFetch } from "@/utils/tauri-fetch";
import {
  DEFAULT_OLLAMA_BASE_URL,
  normalizeOllamaBaseUrl,
} from "@/features/settings/services/ollama-endpoint";
import type { ProviderModel } from "./ai-provider-interface";
import { AIProvider, type ProviderHeaders, type StreamRequest } from "./ai-provider-interface";

/** Local Ollama model discovery and chat requests. */

const OLLAMA_TIMEOUT_MS = 5000;

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
    details?: { parameter_size?: string };
  }>;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs = OLLAMA_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function buildAuthHeaders(apiKey?: string | null): ProviderHeaders {
  const headers: ProviderHeaders = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

async function fetchOllamaTags(baseUrl: string, apiKey?: string | null) {
  return withTimeout(
    tauriFetch(`${normalizeOllamaBaseUrl(baseUrl)}/api/tags`, {
      method: "GET",
      headers: buildAuthHeaders(apiKey),
    }),
  );
}

/**
 * The `capabilities` Ollama reports for a model through `/api/show`, such as `tools` or
 * `vision`, or null when the server is unreachable or too old to report them.
 */
export async function fetchOllamaModelCapabilities(
  baseUrl: string,
  modelId: string,
  apiKey?: string | null,
): Promise<string[] | null> {
  try {
    const response = await withTimeout(
      tauriFetch(`${normalizeOllamaBaseUrl(baseUrl)}/api/show`, {
        method: "POST",
        headers: buildAuthHeaders(apiKey),
        body: JSON.stringify({ model: modelId }),
      }),
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { capabilities?: unknown };
    return Array.isArray(data.capabilities)
      ? data.capabilities.filter((entry): entry is string => typeof entry === "string")
      : null;
  } catch {
    return null;
  }
}

/**
 * Ping `/api/tags` and return whether the server responded OK. Optionally
 * sends an API key for Ollama Cloud. Returns false on any network or auth
 * error so callers can surface a simple "connected / not connected" state.
 */
export async function checkOllamaConnection(
  baseUrl: string,
  apiKey?: string | null,
): Promise<boolean> {
  try {
    const response = await fetchOllamaTags(baseUrl, apiKey);
    return response.ok;
  } catch {
    return false;
  }
}

export class OllamaProvider extends AIProvider {
  private baseUrl: string = DEFAULT_OLLAMA_BASE_URL;
  private apiKey: string | null = null;

  setBaseUrl(url: string): void {
    this.baseUrl = normalizeOllamaBaseUrl(url);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setApiKey(key: string | null): void {
    this.apiKey = key && key.length > 0 ? key : null;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  /**
   * Accepts the API key either from the stream request (preferred — that's
   * the key fetched from secure storage) or falls back to the one stashed
   * on the instance (used by non-streaming calls like `getModels`).
   */
  buildHeaders(apiKey?: string): ProviderHeaders {
    return buildAuthHeaders(apiKey ?? this.apiKey);
  }

  buildPayload(request: StreamRequest) {
    if (request.modelId.endsWith(":cloud") || request.modelId.endsWith("-cloud"))
      throw new Error("Ollama cloud models are not supported.");
    return {
      model: request.modelId,
      messages: request.messages.map(toOpenAIMessage),
      stream: true,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    };
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    return checkOllamaConnection(this.baseUrl, apiKey);
  }

  buildUrl(): string {
    return `${this.baseUrl}/v1/chat/completions`;
  }

  async getModels(): Promise<ProviderModel[]> {
    try {
      const response = await fetchOllamaTags(this.baseUrl, this.apiKey);
      if (!response.ok) return [];

      const data = (await response.json()) as OllamaTagsResponse;
      const models: ProviderModel[] = [];
      for (const model of data.models || []) {
        const id = model.name || model.model;
        if (!id || id.endsWith(":cloud") || id.endsWith("-cloud")) continue;
        const paramSize = model.details?.parameter_size;
        models.push({
          id,
          name: paramSize ? `${id} (${paramSize})` : id,
          maxOutputTokens: 4096,
        });
      }
      return models;
    } catch {
      return [];
    }
  }
}
