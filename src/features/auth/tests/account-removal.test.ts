import { describe, expect, it, vi } from "vite-plus/test";
import { getAuthToken, authenticatedFetch } from "../services/auth-api";
import { useAuthStore } from "../stores/auth.store";

describe("account removal", () => {
  it("never restores or accepts an Athas session", async () => {
    await useAuthStore.getState().actions.initialize();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(await getAuthToken()).toBeNull();
    await expect(useAuthStore.getState().actions.handleAuthCallback("old-token")).rejects.toThrow(
      "not supported",
    );
  });
  it("rejects account requests without accessing the network", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(authenticatedFetch("/api/auth/me", {}, "old-token")).rejects.toThrow(
      "not supported",
    );
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});
