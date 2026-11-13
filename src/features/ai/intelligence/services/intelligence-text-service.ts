import type { AIMessage } from "@/features/ai/types/messages.types";
import {
  getIntelligenceConnection,
  assertIntelligenceConnectionAllowed,
} from "@/features/ai/intelligence/services/intelligence-connection";
import { toIntelligenceSdkPrompt } from "../lib/intelligence-sdk-prompt";

const DEFAULT_INLINE_EDIT_INSTRUCTION = "Improve this code while preserving behavior.";

type IntelligenceTextFeature = NonNullable<InlineEditRequest["feature"]>;

const DEFAULT_TIMEOUT_MS: Record<IntelligenceTextFeature, number> = {
  autocomplete: 10_000,
  "inline-edit": 60_000,
  "commit-message": 45_000,
  "github-draft": 60_000,
  "chat-title": 20_000,
  "terminal-title": 20_000,
  "review-summary": 90_000,
  "review-insight": 90_000,
};

export interface AutocompleteRecentEdit {
  filePath: string;
  snippet: string;
}

/** A summary of another open file, such as a module the current file imports. */
export interface AutocompleteRelatedFile {
  filePath: string;
  snippet: string;
}

export interface AutocompleteDiagnostic {
  line: number;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
}

interface InlineEditRequest {
  feature?:
    | "autocomplete"
    | "inline-edit"
    | "commit-message"
    | "github-draft"
    | "chat-title"
    | "terminal-title"
    | "review-summary"
    | "review-insight";
  provider?: string;
  model: string;
  beforeSelection: string;
  selectedText: string;
  afterSelection?: string;
  instruction?: string;
  filePath?: string;
  languageId?: string;
  recentEdits?: AutocompleteRecentEdit[];
  diagnostics?: AutocompleteDiagnostic[];
  relatedFiles?: AutocompleteRelatedFile[];
}

export class InlineEditError extends Error {
  status: number;
  /** True when the error came from the Athas AI server rather than a local provider. */
  hosted: boolean;

  constructor(message: string, status: number, options?: { hosted?: boolean }) {
    super(message);
    this.name = "InlineEditError";
    this.status = status;
    this.hosted = options?.hosted ?? false;
  }
}

function getDefaultIntelligenceTimeoutMs(feature: IntelligenceTextFeature = "inline-edit") {
  return DEFAULT_TIMEOUT_MS[feature];
}

interface RequestInlineEditOptions {
  useHosted?: boolean;
  useByok?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function requestInlineEdit(
  request: InlineEditRequest,
  options?: RequestInlineEditOptions,
): Promise<{ editedText: string }> {
  options?.signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(
    options?.timeoutMs ?? getDefaultIntelligenceTimeoutMs(request.feature),
  );
  const signal = options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    return await sendInlineEditRequest(request, { ...options, signal });
  } catch (error) {
    if (timeout.aborted && !options?.signal?.aborted) {
      throw new InlineEditError("The model took too long to respond. Try again.", 408);
    }
    throw error;
  }
}

async function sendInlineEditRequest(
  request: InlineEditRequest,
  options: RequestInlineEditOptions & { signal: AbortSignal },
): Promise<{ editedText: string }> {
  const selected = await getIntelligenceConnection(request.feature ?? "inline-edit");
  const connection = request.provider
    ? { ...selected, providerId: request.provider, modelId: request.model }
    : selected;
  assertIntelligenceConnectionAllowed(connection.providerId, request.feature ?? "inline-edit");
  const normalizedRequest = {
    ...request,
    provider: connection.providerId,
    model: connection.modelId.trim(),
    beforeSelection: request.beforeSelection,
    selectedText: request.selectedText,
    afterSelection: request.afterSelection || "",
    instruction: request.instruction?.trim() || DEFAULT_INLINE_EDIT_INSTRUCTION,
  };

  if (!normalizedRequest.model) {
    throw new InlineEditError("Choose a model for this AI feature.", 400);
  }

  return requestProviderInlineEdit(normalizedRequest, options.signal);
}

async function requestProviderInlineEdit(
  request: Required<
    Pick<InlineEditRequest, "provider" | "model" | "beforeSelection" | "selectedText">
  > &
    Omit<InlineEditRequest, "provider" | "model" | "beforeSelection" | "selectedText">,
  signal?: AbortSignal,
): Promise<{ editedText: string }> {
  const [{ generateText }, { getIntelligenceSdkModel }] = await Promise.all([
    import("ai"),
    import("./intelligence-sdk-model"),
  ]);
  const model = await getIntelligenceSdkModel(request.provider, request.model, request.feature);
  signal?.throwIfAborted();
  const maxOutputTokens =
    request.feature === "autocomplete"
      ? 256
      : ["chat-title", "terminal-title"].includes(request.feature ?? "")
        ? 128
        : 4096;
  const result = await generateText({
    model,
    ...toIntelligenceSdkPrompt(buildInlineEditMessages(request)),
    maxOutputTokens,
    maxRetries: 0,
    abortSignal: signal,
  });
  signal?.throwIfAborted();
  if (result.finishReason === "length" && request.feature !== "autocomplete")
    throw new InlineEditError("The result exceeded its limit. Try a smaller selection.", 502);
  return { editedText: cleanInlineEditOutput(result.text) };
}

function buildInlineEditMessages(request: InlineEditRequest): AIMessage[] {
  const instructions = {
    autocomplete:
      "Complete the code at the cursor between before and after. Return only the new text to insert, preserving indentation. The completion may span several lines when the next logical step does, such as finishing a function body. Use recentEdits, diagnostics and relatedFiles (summaries of other open files, such as modules this file imports), when present, as hints for what the user is doing and which APIs exist. Do not repeat surrounding code, use markdown fences, or explain. Return nothing when a completion is not useful.",
    "inline-edit":
      "Rewrite only the selected code. Return replacement code without markdown fences or explanations. Preserve the surrounding code.",
    "commit-message":
      "Write a Git commit message from the supplied staged diff. Follow the requested format and repository style. Return only the message.",
    "github-draft":
      "Write the requested GitHub draft using the supplied context and output format. Do not claim unperformed tests or actions.",
    "chat-title":
      "Write a short concrete title for the conversation. Return only the title, not an answer to the conversation.",
    "terminal-title": "Write a short concrete title for the terminal task. Return only the title.",
    "review-summary":
      "Explain the supplied code-review changes, grounded in the patch. Follow the requested JSON format without markdown fences.",
    "review-insight":
      "Review the supplied code changes for the requested insight. Ground claims in the patch and follow the requested JSON format.",
  };
  return [
    { role: "system", content: instructions[request.feature ?? "inline-edit"] },
    {
      role: "user",
      content: JSON.stringify({
        file: request.filePath,
        language: request.languageId,
        instruction: request.instruction || DEFAULT_INLINE_EDIT_INSTRUCTION,
        before: request.beforeSelection,
        selection: request.selectedText,
        after: request.afterSelection || "",
        ...(request.recentEdits?.length ? { recentEdits: request.recentEdits } : {}),
        ...(request.diagnostics?.length ? { diagnostics: request.diagnostics } : {}),
        ...(request.relatedFiles?.length ? { relatedFiles: request.relatedFiles } : {}),
      }),
    },
  ];
}

function cleanInlineEditOutput(value: string): string {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
  return fenceMatch ? fenceMatch[1] : value;
}
