import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createBugTicket, GitHubBugTicketError } from "./github-bug-ticket";

describe("createBugTicket", () => {
  const originalToken = process.env.GITHUB_BUG_TICKET_TOKEN;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.GITHUB_BUG_TICKET_TOKEN = originalToken;
    global.fetch = originalFetch;
  });

  it("throws not_configured before any network call when the token is missing", async () => {
    delete process.env.GITHUB_BUG_TICKET_TOKEN;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as never;

    await expect(createBugTicket("Webhook silent", "Details...")).rejects.toMatchObject({ code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("with a configured token", () => {
    beforeEach(() => {
      process.env.GITHUB_BUG_TICKET_TOKEN = "test-github-token";
    });

    it("POSTs to the issues endpoint for afitinteriors/afitcrm with the title and body", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ number: 42, html_url: "https://github.com/afitinteriors/afitcrm/issues/42" }) });
      global.fetch = fetchMock as never;

      const result = await createBugTicket("Webhook silent", "No inbound messages for 3 hours.");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/repos/afitinteriors/afitcrm/issues",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Webhook silent", body: "No inbound messages for 3 hours." }),
        }),
      );
      expect(result).toEqual({ number: 42, htmlUrl: "https://github.com/afitinteriors/afitcrm/issues/42" });
    });

    it("throws github_api_error with GitHub's own message on a non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: "Bad credentials" }) }) as never;

      await expect(createBugTicket("x", "y")).rejects.toMatchObject({
        code: "github_api_error",
        message: expect.stringContaining("Bad credentials"),
      });
    });

    it("falls back to the HTTP status when the error body isn't JSON", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      }) as never;

      await expect(createBugTicket("x", "y")).rejects.toThrow(GitHubBugTicketError);
    });
  });
});
