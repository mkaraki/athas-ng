export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  provider: string | null;
  github_username: string | null;
  subscription_status: "free" | "pro";
  subscriptionStatus?: "free" | "pro";
  subscriptionPlan?: "free" | "pro" | "teams" | "enterprise";
  created_at: string;
}

export type ProductCapability =
  | "intelligence"
  | "hostedAi"
  | "settingsSync"
  | "cloudWorkspaces"
  | "cloudAgents"
  | "previews"
  | "collaboration"
  | "enterprisePolicy";

type ProductCapabilities = Record<ProductCapability, boolean>;

export interface SubscriptionInfo {
  status: "free" | "pro";
  capabilities?: ProductCapabilities;
  subscription: {
    plan: "free" | "plus" | "pro" | "teams" | "enterprise" | string;
    renews_at: string | null;
    ends_at: string | null;
  } | null;
  collaboration?: {
    enabled: boolean;
    workspace: {
      id: number;
      name: string;
      slug: string;
      role: string;
      visibility: string;
      realtimeProtocolVersion: number;
    } | null;
    members: Array<{
      id: number;
      userId: number | null;
      name: string;
      email: string;
      role: string;
      status: string;
      lastSeenAt: string | null;
    }>;
    invitations: Array<{
      id: number;
      email: string;
      role: string;
      status: string;
      expiresAt: string | null;
    }>;
    projects: Array<{
      id: number;
      name: string;
      visibility: string;
      updatedAt: string | null;
    }>;
    channels: Array<{
      id: number;
      name: string;
      slug: string;
      description: string | null;
      visibility: string;
      parentChannelId: number | null;
      memberCount: number;
      guestCount: number;
      noteVersion: number;
      notePreview: string;
      updatedAt: string | null;
    }>;
    channelNotes: Array<{
      channelId: number;
      contentMarkdown: string;
      version: number;
      updatedAt: string | null;
    }>;
    privateChats: Array<{
      id: number;
      conversationMemberId: number;
      authorMemberId: number;
      body: string;
      createdAt: string | null;
    }>;
    channelGuests: Array<{
      id: number;
      channelId: number;
      email: string;
      name: string;
      role: string;
      status: string;
      expiresAt: string | null;
    }>;
    settings: {
      sharedSettings: Record<string, unknown>;
      editorPolicy: Record<string, unknown>;
    } | null;
    activity: Array<{
      id: number;
      action: string;
      actorUserId: number | null;
      targetType: string | null;
      targetId: string | null;
      metadata: Record<string, unknown>;
      createdAt: string | null;
    }>;
    presence: Array<{
      id: number;
      userId: number | null;
      channelId: number | null;
      channelName: string | null;
      channelSlug: string | null;
      followingUserId: number | null;
      followingUserName: string | null;
      deviceId: string;
      status: string;
      activeFilePath: string | null;
      cursorLabel: string | null;
      heartbeatAt: string | null;
    }>;
    documents: Array<{
      id: number;
      path: string;
      baseVersion: number;
      stateVector: Record<string, unknown>;
      updatedAt: string | null;
    }>;
    documentUpdates: Array<{
      id: number;
      documentId: number;
      clientId: string;
      clientSeq: number;
      serverVersion: number;
      updateType: string;
      createdAt: string | null;
    }>;
    mediaSignals: Array<{
      id: number;
      channelId: number;
      senderDeviceId: string;
      recipientDeviceId: string | null;
      kind: "offer" | "answer" | "ice" | "leave" | string;
      payload: Record<string, unknown>;
      createdAt: string | null;
    }>;
    capabilities: {
      canInvite: boolean;
      canManageMembers: boolean;
      canShareProjects: boolean;
      canCreateChannels: boolean;
      canEditChannelNotes: boolean;
      activityFeed: boolean;
      presence: boolean;
      realtimeDocuments: boolean;
    };
  } | null;
  enterprise: {
    has_access: boolean;
    is_admin: boolean;
    policy: {
      managedMode: boolean;
      requireExtensionAllowlist: boolean;
      allowedExtensionIds: string[];
      allowByok: boolean;
      aiCompletionEnabled: boolean;
      aiChatEnabled: boolean;
      updatedAt: string | null;
    } | null;
  };
  autocomplete?: {
    usage?: Record<string, unknown> | null;
  } | null;
  /**
   * This billing period's included hosted AI credit and the prepaid balance, all in USD cents
   * billed at list price plus the usage markup. Absent on older servers.
   */
  intelligence?: {
    credits?: IntelligenceCredits | null;
  } | null;
}

export interface IntelligenceCredits {
  periodStart: string;
  periodEnd: string;
  allowanceCents: number;
  usedCents: number;
  pendingCents: number;
  remainingCents: number;
  requestsCount: number;
  /** List price multiplier hosted requests are billed at (1.35 = plus 35%), when reported. */
  usageMarkup?: number | null;
  /**
   * Spendable prepaid balance hosted turns draw from after the included credit, with in-flight
   * holds subtracted. Null when the server has no prepaid balance enabled.
   */
  walletBalanceCents?: number | null;
}

interface EnterprisePolicy {
  managedMode: boolean;
  requireExtensionAllowlist: boolean;
  allowedExtensionIds: string[];
  allowByok: boolean;
  aiCompletionEnabled: boolean;
  aiChatEnabled: boolean;
  updatedAt: string | null;
}

export class AuthApiError extends Error {
  status: number;
  /** The server's error code from the response body, when it sent one. */
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
  }
}

export interface SessionCheckFailure {
  reason: "unreachable" | "local_server_down" | "timeout" | "server_error";
  /** One line saying what actually happened, naming the host that was asked. */
  message: string;
  host: string;
}

export function isAuthInvalidError(error: unknown): boolean {
  return error instanceof AuthApiError && error.status === 401;
}

export async function getAuthToken(): Promise<string | null> {
  return null;
}

interface AuthenticatedFetchOptions extends RequestInit {
  timeoutMs?: number | null;
}

export async function authenticatedFetch(
  path: string,
  options: AuthenticatedFetchOptions = {},
  tokenOverride?: string,
): Promise<Response> {
  void path;
  void options;
  void tokenOverride;
  throw new Error("Athas account services are not supported.");
}

export async function updateEnterprisePolicy(policy: Partial<EnterprisePolicy>): Promise<never> {
  void policy;
  throw new Error("Athas account services are not supported.");
}
