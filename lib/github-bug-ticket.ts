import "server-only";

// Blueprint V1 Section 9, Phase 5: "Create bug tickets in GitHub" -- one of
// Hermes's write tools ("Hermes detects an error and creates a GitHub
// ticket: what broke, when, how many leads affected, logs"). Scoped to
// exactly that: opening the issue. The rest of the blueprint's bug flow
// (Claude Code fixing it, the owner's Telegram approval, a `bug_tickets`
// mirror table tracking status -- Section 11) is future work, not built
// here.
//
// Same shape as lib/telegram-send.ts: a typed error class, a guard clause
// on the missing-token case that throws before any network call --
// GITHUB_BUG_TICKET_TOKEN is forced empty in .env.development.local
// specifically so this guard is what local dev hits, never a real issue
// filed on the real repo.

const GITHUB_REPO_OWNER = "afitinteriors";
const GITHUB_REPO_NAME = "afitcrm";
const GITHUB_API_VERSION = "2022-11-28";

export type GitHubBugTicketErrorCode = "not_configured" | "github_api_error";

export class GitHubBugTicketError extends Error {
  code: GitHubBugTicketErrorCode;
  constructor(code: GitHubBugTicketErrorCode, message: string) {
    super(message);
    this.name = "GitHubBugTicketError";
    this.code = code;
  }
}

export type CreatedBugTicket = { number: number; htmlUrl: string };

export async function createBugTicket(title: string, body: string): Promise<CreatedBugTicket> {
  const token = process.env.GITHUB_BUG_TICKET_TOKEN;
  if (!token) {
    throw new GitHubBugTicketError("not_configured", "GITHUB_BUG_TICKET_TOKEN is not configured.");
  }

  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body }),
  });

  if (!response.ok) {
    let description = `HTTP ${response.status}`;
    try {
      const errorBody = (await response.json()) as { message?: string };
      if (errorBody.message) description = errorBody.message;
    } catch {
      // GitHub's error body is always JSON in practice; fall back to the
      // HTTP status above for anything else.
    }
    throw new GitHubBugTicketError("github_api_error", `GitHub did not accept this issue: ${description}`);
  }

  const created = (await response.json()) as { number: number; html_url: string };
  return { number: created.number, htmlUrl: created.html_url };
}
