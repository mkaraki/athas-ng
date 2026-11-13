export type GitHubTokenSyncStatus = "synced" | "notSignedIn" | "notConnected";

export async function syncGitHubTokenFromAccount(): Promise<{ status: GitHubTokenSyncStatus }> {
  return { status: "notSignedIn" };
}
