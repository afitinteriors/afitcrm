import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const recordAgentEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/hermes/agent-events", () => ({
  recordAgentEvent: (...args: unknown[]) => recordAgentEventMock(...args),
  privacySafeLeadReference: (lead: { id: string }) => `Lead ${lead.id.slice(0, 8).toUpperCase()}`,
}));

const queryLeadsMock = vi.fn();
vi.mock("@/lib/hermes/leads-query", () => ({ queryLeads: (...args: unknown[]) => queryLeadsMock(...args) }));

const getSystemHealthMock = vi.fn();
vi.mock("@/lib/hermes/system-health", () => ({ getSystemHealth: (...args: unknown[]) => getSystemHealthMock(...args) }));

const getAttentionItemsMock = vi.fn();
vi.mock("@/lib/hermes/attention", () => ({ getAttentionItems: (...args: unknown[]) => getAttentionItemsMock(...args) }));

const getDailyReportMock = vi.fn();
vi.mock("@/lib/hermes/daily-report", () => ({ getDailyReport: (...args: unknown[]) => getDailyReportMock(...args) }));

const sendTelegramMessageMock = vi.fn();
vi.mock("@/lib/telegram-send", async () => {
  const actual = await vi.importActual<typeof import("@/lib/telegram-send")>("@/lib/telegram-send");
  return { ...actual, sendTelegramMessage: (...args: unknown[]) => sendTelegramMessageMock(...args) };
});

const createBugTicketMock = vi.fn();
vi.mock("@/lib/github-bug-ticket", async () => {
  const actual = await vi.importActual<typeof import("@/lib/github-bug-ticket")>("@/lib/github-bug-ticket");
  return { ...actual, createBugTicket: (...args: unknown[]) => createBugTicketMock(...args) };
});

const linkTelegramChatMock = vi.fn();
vi.mock("@/lib/telegram-chat-link", () => ({ linkTelegramChat: (...args: unknown[]) => linkTelegramChatMock(...args) }));

vi.mock("@/lib/business-time", () => ({ businessDate: () => "2026-11-01" }));

import {
  listLeadsTool,
  getSystemHealthTool,
  getAttentionTool,
  createTaskTool,
  getDailyReportTool,
  sendTelegramTool,
  createBugTicketTool,
  linkTelegramChatTool,
} from "./mcp-tools";
import { TelegramSendError } from "@/lib/telegram-send";
import { GitHubBugTicketError } from "@/lib/github-bug-ticket";

function fakeAdmin(script: { from?: (table: string) => unknown } = {}): SupabaseClient<Database> {
  return { from: script.from ?? vi.fn(() => ({})) } as unknown as SupabaseClient<Database>;
}

beforeEach(() => {
  recordAgentEventMock.mockClear();
});

describe("listLeadsTool", () => {
  it("returns the items and logs a read event", async () => {
    queryLeadsMock.mockResolvedValue([{ id: "l1" }]);
    const result = await listLeadsTool(fakeAdmin(), { location: "Kollam" });
    expect(result).toEqual({ ok: true, data: { items: [{ id: "l1" }] } });
    expect(recordAgentEventMock.mock.calls[0][1]).toMatchObject({ eventType: "read", toolName: "leads.query" });
  });
});

describe("getSystemHealthTool", () => {
  it("returns the health data and logs it", async () => {
    getSystemHealthMock.mockResolvedValue({ webhookSilent: false, minutesSinceLastInbound: 2 });
    const result = await getSystemHealthTool(fakeAdmin());
    expect(result).toEqual({ ok: true, data: { webhookSilent: false, minutesSinceLastInbound: 2 } });
    expect(recordAgentEventMock.mock.calls[0][1]).toMatchObject({ toolName: "system-health" });
  });
});

describe("getAttentionTool", () => {
  it("returns items and counts reasons", async () => {
    getAttentionItemsMock.mockResolvedValue([{ reasonKind: "unresponded" }, { reasonKind: "unresponded" }, { reasonKind: "stage_overdue" }]);
    const result = await getAttentionTool(fakeAdmin());
    expect(result.ok).toBe(true);
    expect(recordAgentEventMock.mock.calls[0][1]).toMatchObject({ metadata: { count: 3, reasonCounts: { unresponded: 2, stage_overdue: 1 } } });
  });
});

describe("createTaskTool", () => {
  function fromWith(lead: unknown, insertResult: { data: { id: string } | null; error: { message: string } | null }) {
    return vi.fn((table: string) => {
      if (table === "leads") return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: lead, error: lead ? null : { message: "not found" } }) }) }) };
      if (table === "follow_ups") return { insert: () => ({ select: () => ({ single: () => Promise.resolve(insertResult) }) }) };
      throw new Error(`unexpected table: ${table}`);
    });
  }

  it("fails fast when lead_id or due_date is missing", async () => {
    const result = await createTaskTool(fakeAdmin(), { leadId: null, dueDate: "2026-11-01" });
    expect(result).toEqual({ ok: false, error: "lead_id and due_date are required." });
  });

  it("fails when lead_id doesn't resolve", async () => {
    const admin = fakeAdmin({ from: fromWith(null, { data: null, error: null }) });
    const result = await createTaskTool(admin, { leadId: "nope", dueDate: "2026-11-01" });
    expect(result).toEqual({ ok: false, error: "No lead found for lead_id." });
  });

  it("creates the follow-up, defaults type, and logs it", async () => {
    const admin = fakeAdmin({ from: fromWith({ id: "l1", location: "Kollam", service_required: "Gypsum", project_type: null }, { data: { id: "fu-1" }, error: null }) });
    const result = await createTaskTool(admin, { leadId: "l1", dueDate: "2026-11-01" });
    expect(result).toEqual({ ok: true, data: { id: "fu-1" } });
    expect(recordAgentEventMock.mock.calls[0][1]).toMatchObject({ toolName: "tasks.create", metadata: { type: "follow_up" } });
  });

  it("surfaces an insert error", async () => {
    const admin = fakeAdmin({ from: fromWith({ id: "l1", location: null, service_required: null, project_type: null }, { data: null, error: { message: "db down" } }) });
    const result = await createTaskTool(admin, { leadId: "l1", dueDate: "2026-11-01" });
    expect(result).toEqual({ ok: false, error: "db down" });
  });
});

describe("getDailyReportTool", () => {
  it("defaults to today's business date when no date is given", async () => {
    getDailyReportMock.mockResolvedValue([]);
    const result = await getDailyReportTool(fakeAdmin(), null);
    expect(result).toEqual({ ok: true, data: { date: "2026-11-01", perStaff: [] } });
    expect(getDailyReportMock).toHaveBeenCalledWith(expect.anything(), "2026-11-01");
  });

  it("uses a given valid date instead", async () => {
    getDailyReportMock.mockResolvedValue([]);
    const result = await getDailyReportTool(fakeAdmin(), "2026-10-15");
    expect(result).toEqual({ ok: true, data: { date: "2026-10-15", perStaff: [] } });
  });

  it("falls back to today for a malformed date", async () => {
    getDailyReportMock.mockResolvedValue([]);
    const result = await getDailyReportTool(fakeAdmin(), "not-a-date");
    expect(result).toEqual({ ok: true, data: { date: "2026-11-01", perStaff: [] } });
  });
});

describe("sendTelegramTool", () => {
  function fromWithProfile(profile: { telegram_chat_id: string | null } | null) {
    return vi.fn(() => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: profile, error: profile ? null : { message: "not found" } }) }) }) }));
  }

  it("fails fast when profile_id or text is missing", async () => {
    expect(await sendTelegramTool(fakeAdmin(), { profileId: null, text: "hi" })).toEqual({ ok: false, error: "profile_id and text are required." });
  });

  it("fails when the profile doesn't exist", async () => {
    const admin = fakeAdmin({ from: fromWithProfile(null) });
    expect(await sendTelegramTool(admin, { profileId: "p1", text: "hi" })).toEqual({ ok: false, error: "No profile found for profile_id." });
  });

  it("fails when the profile has no linked chat", async () => {
    const admin = fakeAdmin({ from: fromWithProfile({ telegram_chat_id: null }) });
    expect(await sendTelegramTool(admin, { profileId: "p1", text: "hi" })).toEqual({ ok: false, error: "This profile has not linked a Telegram chat yet." });
  });

  it("sends and logs without leaking the message text", async () => {
    sendTelegramMessageMock.mockResolvedValue(undefined);
    const admin = fakeAdmin({ from: fromWithProfile({ telegram_chat_id: "chat-1" }) });
    const result = await sendTelegramTool(admin, { profileId: "p1", text: "secret details" });
    expect(result).toEqual({ ok: true, data: { sent: true } });
    expect(sendTelegramMessageMock).toHaveBeenCalledWith("chat-1", "secret details");
    expect(JSON.stringify(recordAgentEventMock.mock.calls[0][1])).not.toContain("secret details");
  });

  it("fails and logs when Telegram rejects the send", async () => {
    sendTelegramMessageMock.mockRejectedValue(new TelegramSendError("telegram_api_error", "chat not found"));
    const admin = fakeAdmin({ from: fromWithProfile({ telegram_chat_id: "chat-1" }) });
    const result = await sendTelegramTool(admin, { profileId: "p1", text: "hi" });
    expect(result).toEqual({ ok: false, error: "chat not found" });
    expect(recordAgentEventMock.mock.calls[0][1].metadata).toMatchObject({ failed: true });
  });
});

describe("createBugTicketTool", () => {
  it("fails fast when title or body is missing", async () => {
    expect(await createBugTicketTool(fakeAdmin(), { title: null, body: "x" })).toEqual({ ok: false, error: "title and body are required." });
  });

  it("files the ticket and logs it", async () => {
    createBugTicketMock.mockResolvedValue({ number: 42, htmlUrl: "https://github.com/x/y/issues/42" });
    const result = await createBugTicketTool(fakeAdmin(), { title: "Webhook silent", body: "details" });
    expect(result).toEqual({ ok: true, data: { number: 42, htmlUrl: "https://github.com/x/y/issues/42" } });
  });

  it("fails and logs on a GitHub API error", async () => {
    createBugTicketMock.mockRejectedValue(new GitHubBugTicketError("github_api_error", "rate limited"));
    const result = await createBugTicketTool(fakeAdmin(), { title: "x", body: "y" });
    expect(result).toEqual({ ok: false, error: "rate limited" });
    expect(recordAgentEventMock.mock.calls[0][1].metadata).toMatchObject({ failed: true });
  });
});

describe("linkTelegramChatTool", () => {
  it("fails fast when username or chat_id is missing", async () => {
    expect(await linkTelegramChatTool(fakeAdmin(), { username: null, chatId: "1" })).toEqual({ ok: false, error: "username and chat_id are required." });
  });

  it("reports linked:true and logs a create event on a match", async () => {
    linkTelegramChatMock.mockResolvedValue(true);
    const result = await linkTelegramChatTool(fakeAdmin(), { username: "azhar", chatId: "999" });
    expect(result).toEqual({ ok: true, data: { linked: true } });
    expect(linkTelegramChatMock).toHaveBeenCalledWith(expect.anything(), { username: "azhar", chatId: "999" });
    expect(recordAgentEventMock.mock.calls[0][1]).toMatchObject({ eventType: "create", toolName: "telegram.link" });
  });

  it("reports linked:false and logs a read event when nothing matches", async () => {
    linkTelegramChatMock.mockResolvedValue(false);
    const result = await linkTelegramChatTool(fakeAdmin(), { username: "stranger", chatId: "1" });
    expect(result).toEqual({ ok: true, data: { linked: false } });
    expect(recordAgentEventMock.mock.calls[0][1]).toMatchObject({ eventType: "read", toolName: "telegram.link" });
  });
});
