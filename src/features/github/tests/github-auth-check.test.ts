import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const harness = vi.hoisted(() => ({
  tauriFetch: vi.fn(),
  authToken: "athas-token" as string | null,
}));

vi.mock("@/utils/tauri-fetch", () => ({ tauriFetch: harness.tauriFetch }));
vi.mock("@/features/auth/services/auth-api", () => ({
  getAuthToken: async () => harness.authToken,
}));
vi.mock("@/features/editor/stores/buffer.store", () => ({
  useBufferStore: { use: { actions: () => ({}) } },
}));

import { commands } from "@/bindings/commands";
import { useGitHubStore } from "../stores/github.store";
import {
  fetchNormalizedPRDetails,
  getGitHubAccountStatus,
  getGitHubErrorMessage,
  isFresh,
  normalizePullRequest,
  normalizePullRequestFiles,
} from "../services/github-pr-store-service";
import type { PullRequest } from "../types/github.types";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  harness.tauriFetch.mockReset();
  harness.authToken = "athas-token";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(commands, "storeGithubToken").mockResolvedValue(null);
  vi.spyOn(commands, "removeGithubToken").mockResolvedValue(null);
  useGitHubStore.getState().actions.markAuthFailed("reset");
  useGitHubStore.getState().actions.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GitHub auth check", () => {
  it("signs in with the stored GitHub token", async () => {
    vi.spyOn(commands, "githubCheckAuth").mockResolvedValue("authenticated");
    vi.spyOn(commands, "githubGetCurrentUser").mockResolvedValue("octocat");

    await useGitHubStore.getState().actions.checkAuth();

    expect(useGitHubStore.getState()).toMatchObject({
      isAuthenticated: true,
      isCheckingAuth: false,
      githubAccountStatus: "connected",
      currentUser: "octocat",
      authError: null,
    });
  });

  it("uses the cached result until it is stale or forced", async () => {
    const check = vi.spyOn(commands, "githubCheckAuth").mockResolvedValue("authenticated");
    vi.spyOn(commands, "githubGetCurrentUser").mockResolvedValue("octocat");

    await useGitHubStore.getState().actions.checkAuth();
    await useGitHubStore.getState().actions.checkAuth();
    expect(check).toHaveBeenCalledOnce();

    await useGitHubStore.getState().actions.checkAuth({ force: true });
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("shares one check between concurrent callers", async () => {
    const pending = deferred<"authenticated">();
    const check = vi.spyOn(commands, "githubCheckAuth").mockReturnValue(pending.promise as never);
    vi.spyOn(commands, "githubGetCurrentUser").mockResolvedValue("octocat");

    const first = useGitHubStore.getState().actions.checkAuth();
    const second = useGitHubStore.getState().actions.checkAuth({ force: true });
    expect(useGitHubStore.getState().isCheckingAuth).toBe(true);
    pending.resolve("authenticated");
    await Promise.all([first, second]);

    expect(check).toHaveBeenCalledOnce();
    expect(useGitHubStore.getState().currentUser).toBe("octocat");
  });

  it("does not fetch account tokens when local credentials are missing", async () => {
    vi.spyOn(commands, "githubCheckAuth").mockResolvedValue("notAuthenticated");
    harness.tauriFetch.mockResolvedValue(json({}, 404));

    await useGitHubStore.getState().actions.checkAuth();
    expect(useGitHubStore.getState()).toMatchObject({
      isAuthenticated: false,
      githubAccountStatus: "notConnected",
      authError: "No valid GitHub token is available for this workspace.",
    });

    harness.authToken = null;
    await useGitHubStore.getState().actions.checkAuth({ force: true });
    expect(useGitHubStore.getState().githubAccountStatus).toBe("notConnected");
    expect(harness.tauriFetch).not.toHaveBeenCalled();
  });

  it("reports a failed auth check", async () => {
    vi.spyOn(commands, "githubCheckAuth").mockRejectedValue({ message: "gh not installed" });

    await useGitHubStore.getState().actions.checkAuth();

    expect(useGitHubStore.getState()).toMatchObject({
      isAuthenticated: false,
      isCheckingAuth: false,
      authStatus: "notAuthenticated",
      authError: "gh not installed",
    });
  });

  it("checks again after a request is rejected for its credentials", async () => {
    const check = vi.spyOn(commands, "githubCheckAuth").mockResolvedValue("authenticated");
    vi.spyOn(commands, "githubGetCurrentUser").mockResolvedValue("octocat");
    await useGitHubStore.getState().actions.checkAuth();

    useGitHubStore.getState().actions.markAuthFailed("Bad credentials");
    expect(useGitHubStore.getState()).toMatchObject({
      isAuthenticated: false,
      currentUser: null,
      authError: "Bad credentials",
    });

    await useGitHubStore.getState().actions.checkAuth();
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("remembers the pull request filter", () => {
    useGitHubStore.getState().actions.setFilter("my-prs" as never);
    expect(useGitHubStore.getState().currentFilter).toBe("my-prs");
  });
});

describe("pull request normalization", () => {
  it("maps sync status to account status and checks cache freshness", () => {
    expect(getGitHubAccountStatus("synced")).toBe("connected");
    expect(getGitHubAccountStatus("notSignedIn")).toBe("notSignedIn");
    expect(getGitHubAccountStatus("notConnected")).toBe("notConnected");
    expect(isFresh(Date.now() - 1_000, 5_000)).toBe(true);
    expect(isFresh(Date.now() - 10_000, 5_000)).toBe(false);
  });

  it("describes errors of any shape", () => {
    expect(getGitHubErrorMessage(new Error("boom"))).toBe("boom");
    expect(getGitHubErrorMessage("plain")).toBe("plain");
    expect(getGitHubErrorMessage({ message: "object" })).toBe("object");
    expect(getGitHubErrorMessage(42)).toBe("42");
  });

  it("keeps only file entries with a path", () => {
    expect(normalizePullRequestFiles("nope")).toEqual([]);
    expect(
      normalizePullRequestFiles([
        { path: " src/a.ts ", additions: 3, deletions: 1 },
        { path: "b.ts", additions: "x" },
        { path: "  " },
        null,
        "c.ts",
      ]),
    ).toEqual([
      { path: "src/a.ts", additions: 3, deletions: 1 },
      { path: "b.ts", additions: 0, deletions: 0 },
    ]);
  });

  it("reads branch refs from any naming the CLI uses", () => {
    const pr = normalizePullRequest({
      number: 1,
      title: "Fix",
      headRefName: "feature",
      base_ref: "main",
    } as unknown as PullRequest);

    expect(pr).toMatchObject({ headRef: "feature", baseRef: "main" });
    expect(console.warn).not.toHaveBeenCalled();

    const missing = normalizePullRequest({ number: 2, title: "No refs" } as PullRequest);
    expect(missing).toMatchObject({ headRef: "", baseRef: "" });
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("fills pull request details from GitHub's alternate field names", async () => {
    vi.spyOn(commands, "githubGetPrDetails").mockResolvedValue({
      number: 5,
      headRefName: "feature",
      baseRefName: "main",
      statusCheckRollup: [{ name: "ci" }],
      closingIssuesReferences: [{ number: 9 }],
      reviews: null,
    } as never);

    const details = await fetchNormalizedPRDetails("/repo", 5);

    expect(commands.githubGetPrDetails).toHaveBeenCalledWith("/repo", 5);
    expect(details).toMatchObject({
      headRef: "feature",
      baseRef: "main",
      statusChecks: [{ name: "ci" }],
      linkedIssues: [{ number: 9 }],
      reviews: [],
      mergedAt: null,
      mergedBy: null,
      closedAt: null,
    });
  });

  it("keeps explicit details and falls back to empty lists", async () => {
    vi.spyOn(commands, "githubGetPrDetails").mockResolvedValue({
      number: 6,
      headRef: "x",
      baseRef: "y",
      statusChecks: [{ name: "lint" }],
      reviews: [{ id: 1 }],
      mergedAt: "2026-01-01",
    } as never);

    const details = await fetchNormalizedPRDetails("/repo", 6);

    expect(details).toMatchObject({
      statusChecks: [{ name: "lint" }],
      linkedIssues: [],
      reviews: [{ id: 1 }],
      mergedAt: "2026-01-01",
    });
  });
});
