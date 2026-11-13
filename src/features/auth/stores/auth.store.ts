import { create } from "zustand";
import type { AuthUser, SessionCheckFailure, SubscriptionInfo } from "../services/auth-api";
import { createSelectors } from "@/utils/zustand-selectors";

interface AuthState {
  user: AuthUser | null;
  subscription: SubscriptionInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  /**
   * Set while a saved session exists but could not be checked because the server did not
   * answer. The session is kept and checked again with backoff; it is not a sign-out.
   */
  sessionCheck: SessionCheckState | null;
}

export interface SessionCheckState extends SessionCheckFailure {
  /** How many checks in a row have failed. */
  attempt: number;
  /** When the next automatic check runs, in epoch milliseconds, or null when none is planned. */
  nextRetryAt: number | null;
}

interface AuthActions {
  initialize: () => Promise<void>;
  /** Checks a saved session that could not be verified again, right now. */
  retrySessionCheck: () => Promise<void>;
  handleAuthCallback: (token: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSubscription: () => Promise<boolean>;
  /**
   * Refreshes the plan and credits after a short quiet period, so several hosted turns or
   * focus changes in a row cost one request. Does nothing while signed out.
   */
  scheduleSubscriptionRefresh: (delayMs?: number) => void;
  setCollaborationSnapshot: (collaboration: SubscriptionInfo["collaboration"] | null) => void;
  logout: () => Promise<void>;
}

interface AuthStore extends AuthState {
  actions: AuthActions;
}

// Legacy feature consumers share a signed-out snapshot; no session is loaded or refreshed.
export function onBeforeLogout(hook: () => Promise<void>) {
  void hook;
  return () => {};
}

export const useAuthStore = createSelectors(
  create<AuthStore>()(() => ({
    user: null,
    subscription: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    sessionCheck: null,
    actions: {
      initialize: async () => {},
      retrySessionCheck: async () => {},
      handleAuthCallback: async () => {
        throw new Error("Athas accounts are not supported.");
      },
      refreshUser: async () => {},
      refreshSubscription: async () => false,
      scheduleSubscriptionRefresh: () => {},
      setCollaborationSnapshot: () => {},
      logout: async () => {},
    },
  })),
);
