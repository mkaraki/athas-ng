import { formatApiError } from "../lib/api-error";
import { resolveAgentModel } from "../intelligence/lib/resolve-agent-model";
import {
  assertIntelligenceConnectionAllowed,
  getIntelligenceConnection,
} from "../intelligence/services/intelligence-connection";
import { useAIChatStore } from "@/features/ai/stores/ai-chat.store";
import type { ChatMode, OutputStyle } from "@/features/ai/types/ai-chat.types";
import type { AcpEvent } from "@/features/ai/types/acp.types";
import type { AgentCompletionResult } from "@/features/ai/types/agent-completion.types";
import type { ContextInfo } from "@/features/ai/types/ai-context.types";
import type { AgentType } from "@/features/ai/types/ai-chat.types";
import type { AIMessage } from "@/features/ai/types/messages.types";
import { getProviderById } from "@/features/ai/types/providers.types";
import { buildProviderSystemPromptContext } from "@/features/ai/services/providers/ai-provider-registry";
import { getModelCatalogKey } from "@/features/ai/services/custom-provider-config";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { AcpStreamHandler } from "./acp-stream-handler";
import { buildContextPrompt, buildSystemPrompt } from "../utils/ai-context-builder";
import { loadContextProjectRules } from "../lib/project-rules";
import {
  compactConversationHistory,
  currentImageCount,
  fitMessagesToProviderLimits,
  getProviderRequestLimits,
  imagesOmittedNotice,
  providerAcceptsImages,
} from "../lib/conversation-history";
import { CODEX_INTEGRATION_ID } from "../integrations/integration-registry";

// Check if an agent uses ACP (CLI-based) vs HTTP API
export const isAcpAgent = (agentId: AgentType): boolean => {
  return agentId !== "custom" && agentId !== CODEX_INTEGRATION_ID;
};

// Generic streaming chat completion function that works with any agent/provider
export const getChatCompletionStream = async (
  agentId: AgentType,
  providerId: string,
  modelId: string,
  userMessage: string,
  context: ContextInfo,
  onChunk: (chunk: string) => void,
  onComplete: (result?: AgentCompletionResult) => void,
  onError: (error: string, canReconnect?: boolean) => void,
  conversationHistory?: AIMessage[],
  onResponseContinuation?: () => void,
  onToolUse?: (event: Extract<AcpEvent, { type: "tool_start" }>) => void,
  onToolUpdate?: (event: Extract<AcpEvent, { type: "tool_update" }>) => void,
  onToolComplete?: (toolName: string, toolId?: string, output?: unknown, error?: string) => void,
  onPermissionRequest?: (event: Extract<AcpEvent, { type: "permission_request" }>) => void,
  onAcpEvent?: (event: AcpEvent) => void,
  mode: ChatMode = "chat",
  outputStyle: OutputStyle = "default",
  onImageChunk?: (data: string, mediaType: string) => void,
  onResourceChunk?: (uri: string, name: string | null) => void,
  chatId?: string,
  systemPromptOverride?: string,
  onResponsePhase?: (phase: "starting" | "waiting" | "stalled") => void,
): Promise<void> => {
  try {
    if (agentId === CODEX_INTEGRATION_ID) {
      throw new Error("Use an ACP agent for Codex.");
    }

    // Handle ACP-based coding agents.
    if (isAcpAgent(agentId)) {
      const handler = new AcpStreamHandler(
        agentId,
        {
          onChunk,
          onComplete,
          onError,
          onResponseContinuation,
          onToolUse,
          onToolUpdate,
          onToolComplete,
          onPermissionRequest,
          onEvent: onAcpEvent,
          onImageChunk,
          onResourceChunk,
          onResponsePhase,
        },
        chatId,
      );
      await handler.start(userMessage, context);
      return;
    }

    await getIntelligenceConnection("agent");
    assertIntelligenceConnectionAllowed(providerId, "agent");
    const provider = getProviderById(providerId);
    const settings = useSettingsStore.getState().settings;
    const model = resolveAgentModel({
      provider,
      modelId,
      dynamicModels:
        useAIChatStore.getState().dynamicModels[getModelCatalogKey(providerId, settings)] ?? [],
      customDefault: settings.aiCustomModelId || settings.aiAutocompleteCustomModelId,
    });
    if (model) modelId = model.id;

    if (!provider || !model) throw new Error("Choose an installed Ollama model in AI settings.");

    if (context.projectRoot || settings.aiUserRules) {
      context = {
        ...context,
        projectRules: await loadContextProjectRules(context, { userRules: settings.aiUserRules }),
      };
    }
    const contextPrompt = buildContextPrompt(context);
    let systemPrompt = systemPromptOverride || buildSystemPrompt(contextPrompt, mode, outputStyle);
    const providerSystemPromptContext = await buildProviderSystemPromptContext(
      providerId,
      settings,
    );
    if (providerSystemPromptContext) {
      systemPrompt = `${systemPrompt}\n\n${providerSystemPromptContext}`;
    }

    // Build messages array with conversation history
    const draftMessages: AIMessage[] = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
    ];

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      draftMessages.push(...(await compactConversationHistory(conversationHistory)));
    }

    // Add the current user message
    draftMessages.push({
      role: "user" as const,
      content: userMessage,
      ...(context.images?.length ? { images: context.images } : {}),
    });
    const acceptsImages = providerAcceptsImages(providerId, model);
    const messages = fitMessagesToProviderLimits(
      draftMessages,
      providerId,
      getProviderRequestLimits(providerId),
      acceptsImages,
    );
    const omittedImages = currentImageCount(draftMessages) - currentImageCount(messages);
    const notices =
      omittedImages > 0
        ? [imagesOmittedNotice({ omitted: omittedImages, acceptsImages, modelName: model.name })]
        : [];

    const { runIntelligenceAgent } = await import("../intelligence/services/intelligence-agent");
    const result = await runIntelligenceAgent({
      sessionId: chatId || crypto.randomUUID(),
      providerId,
      modelId,
      messages,
      root: context.projectRoot,
      readOnly: mode !== "chat",
      maxSteps: settings.aiAgentMaxSteps,
      notices,
      onChunk,
      onToolUse,
      onToolComplete,
      onPermissionRequest,
      onEvent: onAcpEvent,
    });
    onComplete(result);
  } catch (error: any) {
    console.error(`${providerId} streaming chat completion error:`, error);
    onError(formatApiError(providerId, error));
  }
};
