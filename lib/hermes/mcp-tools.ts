import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FollowUpInsert, FollowUpType } from "@/lib/supabase/types";
import { queryLeads, type HermesLeadFilters } from "@/lib/hermes/leads-query";
import { getSystemHealth } from "@/lib/hermes/system-health";
import { getAttentionItems } from "@/lib/hermes/attention";
import { getDailyReport } from "@/lib/hermes/daily-report";
import { recordAgentEvent, privacySafeLeadReference } from "@/lib/hermes/agent-events";
import { sendTelegramMessage, TelegramSendError } from "@/lib/telegram-send";
import { createBugTicket, GitHubBugTicketError } from "@/lib/github-bug-ticket";
import { linkTelegramChat } from "@/lib/telegram-chat-link";
import { FOLLOW_UP_TYPES } from "@/lib/constants";
import { businessDate } from "@/lib/business-time";

// Blueprint V1 Section 9: "AFIT CRM tool server (MCP) with a fixed tool
// list." app/api/hermes/*'s REST routes are that tool server's *first*
// transport (built across Phase 5's 6 increments); this module is its
// *second* -- the actual MCP protocol transport
// (app/api/mcp/hermes/route.ts) that the self-hosted Hermes Agent
// (Nous Research) connects to, since it speaks MCP, not arbitrary REST.
//
// Deliberately NOT a refactor of the REST routes to share this logic --
// each tool function here calls the exact same underlying lib function
// the matching REST route does (queryLeads, getSystemHealth, ...), so the
// two transports can never silently diverge in business logic, while the
// REST routes themselves stay untouched (same reasoning the increment was
// scoped on: keep already-shipped, tested code alone).
//
// Every function returns a plain discriminated result rather than
// throwing a typed error -- the MCP route (and these functions' own
// tests) can treat every tool uniformly: { ok: true, data } becomes a
// normal tool result, { ok: false, error } becomes an isError one. No
// function here ever lets an unexpected exception escape to the MCP
// transport layer; the route wraps each call in try/catch as a last
// resort, but every *expected* failure (no match, bad input, a
// downstream API error) is represented in this return type.
export type ToolResult<T> = { ok: true; data: T } | { ok: false; error: string };

function ok<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}
function fail<T>(error: string): ToolResult<T> {
  return { ok: false, error };
}

export async function listLeadsTool(admin: SupabaseClient<Database>, filters: HermesLeadFilters): Promise<ToolResult<{ items: Awaited<ReturnType<typeof queryLeads>> }>> {
  const items = await queryLeads(admin, filters);
  await recordAgentEvent(admin, {
    eventType: "read",
    toolName: "leads.query",
    summary: `Read ${items.length} lead(s) matching the given filters.`,
    metadata: { count: items.length, filters },
  });
  return ok({ items });
}

export async function getSystemHealthTool(admin: SupabaseClient<Database>): Promise<ToolResult<Awaited<ReturnType<typeof getSystemHealth>>>> {
  const health = await getSystemHealth(admin, new Date());
  await recordAgentEvent(admin, {
    eventType: "read",
    toolName: "system-health",
    summary: health.webhookSilent ? `Webhook silent for ${health.minutesSinceLastInbound} min.` : "Webhook healthy.",
    metadata: health,
  });
  return ok(health);
}

export async function getAttentionTool(admin: SupabaseClient<Database>): Promise<ToolResult<{ items: Awaited<ReturnType<typeof getAttentionItems>> }>> {
  const items = await getAttentionItems(admin, new Date());
  const reasonCounts: Record<string, number> = {};
  for (const item of items) reasonCounts[item.reasonKind] = (reasonCounts[item.reasonKind] ?? 0) + 1;
  await recordAgentEvent(admin, {
    eventType: "read",
    toolName: "attention",
    summary: `Read ${items.length} lead(s) needing attention.`,
    metadata: { count: items.length, reasonCounts },
  });
  return ok({ items });
}

export type CreateTaskInput = { leadId: string | null; dueDate: string | null; dueTime?: string | null; type?: string; notes?: string | null; assignedToId?: string | null };

export async function createTaskTool(admin: SupabaseClient<Database>, input: CreateTaskInput): Promise<ToolResult<{ id: string }>> {
  if (!input.leadId || !input.dueDate) return fail("lead_id and due_date are required.");

  const { data: lead, error: leadError } = await admin.from("leads").select("id, location, service_required, project_type").eq("id", input.leadId).single();
  if (leadError || !lead) return fail("No lead found for lead_id.");

  const type: FollowUpType = isFollowUpType(input.type) ? input.type : "follow_up";
  const insert: FollowUpInsert = {
    lead_id: input.leadId,
    due_date: input.dueDate,
    due_time: input.dueTime ?? null,
    type,
    notes: input.notes ?? null,
    assigned_to_id: input.assignedToId ?? null,
  };
  const { data: created, error } = await admin.from("follow_ups").insert(insert).select("id").single();
  if (error || !created) return fail(error?.message ?? "Failed to create follow-up.");

  await recordAgentEvent(admin, {
    eventType: "create",
    toolName: "tasks.create",
    summary: `Created a ${type} task for ${privacySafeLeadReference(lead)}, due ${input.dueDate}.`,
    metadata: { followUpId: created.id, dueDate: input.dueDate, type },
  });
  return ok({ id: created.id });
}

function isFollowUpType(value: unknown): value is FollowUpType {
  return typeof value === "string" && (FOLLOW_UP_TYPES as string[]).includes(value);
}

export async function getDailyReportTool(admin: SupabaseClient<Database>, date: string | null): Promise<ToolResult<{ date: string; perStaff: Awaited<ReturnType<typeof getDailyReport>> }>> {
  const resolvedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : businessDate();
  const perStaff = await getDailyReport(admin, resolvedDate);
  await recordAgentEvent(admin, {
    eventType: "read",
    toolName: "reports.daily",
    summary: `Read the ${resolvedDate} daily report (${perStaff.length} staff).`,
    metadata: { date: resolvedDate, staffCount: perStaff.length },
  });
  return ok({ date: resolvedDate, perStaff });
}

export async function sendTelegramTool(admin: SupabaseClient<Database>, input: { profileId: string | null; text: string | null }): Promise<ToolResult<{ sent: true }>> {
  if (!input.profileId || !input.text) return fail("profile_id and text are required.");

  const { data: profile, error: profileError } = await admin.from("profiles").select("id, telegram_chat_id").eq("id", input.profileId).single();
  if (profileError || !profile) return fail("No profile found for profile_id.");
  if (!profile.telegram_chat_id) return fail("This profile has not linked a Telegram chat yet.");

  try {
    await sendTelegramMessage(profile.telegram_chat_id, input.text);
  } catch (err) {
    const message = err instanceof TelegramSendError ? err.message : "Failed to send the Telegram message.";
    await recordAgentEvent(admin, {
      eventType: "send",
      toolName: "telegram.send",
      summary: `Failed to send a Telegram message to profile ${input.profileId}: ${message}`,
      metadata: { profileId: input.profileId, textLength: input.text.length, failed: true },
    });
    return fail(message);
  }

  await recordAgentEvent(admin, {
    eventType: "send",
    toolName: "telegram.send",
    summary: `Sent a Telegram message to profile ${input.profileId}.`,
    metadata: { profileId: input.profileId, textLength: input.text.length },
  });
  return ok({ sent: true });
}

export async function createBugTicketTool(admin: SupabaseClient<Database>, input: { title: string | null; body: string | null }): Promise<ToolResult<{ number: number; htmlUrl: string }>> {
  if (!input.title || !input.body) return fail("title and body are required.");

  try {
    const ticket = await createBugTicket(input.title, input.body);
    await recordAgentEvent(admin, {
      eventType: "create",
      toolName: "bug-ticket.create",
      summary: `Filed GitHub issue #${ticket.number}: ${input.title}`,
      metadata: { issueNumber: ticket.number, htmlUrl: ticket.htmlUrl },
    });
    return ok(ticket);
  } catch (err) {
    const message = err instanceof GitHubBugTicketError ? err.message : "Failed to create the bug ticket.";
    await recordAgentEvent(admin, {
      eventType: "create",
      toolName: "bug-ticket.create",
      summary: `Failed to file a GitHub issue: ${input.title}`,
      metadata: { title: input.title, failed: true, reason: message },
    });
    return fail(message);
  }
}

// NEW -- no REST precedent. Once Hermes's own Telegram gateway takes over
// this bot (replacing app/api/webhooks/telegram/route.ts's one-time
// linking role, per the decision to reuse a single bot), Hermes itself
// receives the raw update and is the only thing that can call this.
// Reuses lib/telegram-chat-link.ts's exact matching logic unchanged.
export async function linkTelegramChatTool(admin: SupabaseClient<Database>, input: { username: string | null; chatId: string | null }): Promise<ToolResult<{ linked: boolean }>> {
  if (!input.username || !input.chatId) return fail("username and chat_id are required.");

  const linked = await linkTelegramChat(admin, { username: input.username, chatId: input.chatId });
  await recordAgentEvent(admin, {
    eventType: linked ? "create" : "read",
    toolName: "telegram.link",
    summary: linked ? `Linked Telegram chat for @${input.username}.` : `No profile matched Telegram username @${input.username}.`,
    metadata: { username: input.username, linked },
  });
  return ok({ linked });
}
