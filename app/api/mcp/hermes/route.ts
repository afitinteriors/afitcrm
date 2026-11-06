import { McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidHermesApiKey } from "@/lib/hermes-auth";
import {
  listLeadsTool,
  getSystemHealthTool,
  getAttentionTool,
  createTaskTool,
  getDailyReportTool,
  sendTelegramTool,
  createBugTicketTool,
  linkTelegramChatTool,
  type ToolResult,
} from "@/lib/hermes/mcp-tools";

export const runtime = "nodejs";

// Blueprint V1 Section 9: "AFIT CRM tool server (MCP) with a fixed tool
// list and its own limited API key." This is that MCP transport -- the
// self-hosted Hermes Agent (Nous Research) connects here, not to
// app/api/hermes/* directly (those REST routes stay as they are; see
// lib/hermes/mcp-tools.ts's own comment on why the two aren't merged).
// Same "don't reveal the route exists" 404-on-auth-failure convention as
// every other Hermes/cron route in this app, and the identical
// HERMES_API_KEY credential -- one tool server, two transports, one key.

function toContent<T>(result: ToolResult<T>) {
  if (!result.ok) return { content: [{ type: "text" as const, text: result.error }], isError: true };
  return { content: [{ type: "text" as const, text: JSON.stringify(result.data) }] };
}

function buildServer(admin: SupabaseClient<Database>): McpServer {
  const server = new McpServer({ name: "afit-crm", version: "1.0.0" });

  server.registerTool(
    "leads_query",
    {
      description: "Read AFIT CRM leads matching the given filters.",
      inputSchema: z.object({
        status: z.string().optional(),
        location: z.string().optional(),
        assignedToId: z.string().optional(),
        datePreset: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    },
    async (args) => toContent(await listLeadsTool(admin, args)),
  );

  server.registerTool(
    "system_health",
    { description: "Check whether the WhatsApp webhook has gone silent.", inputSchema: z.object({}) },
    async () => toContent(await getSystemHealthTool(admin)),
  );

  server.registerTool(
    "attention_items",
    { description: "List leads needing attention right now (unresponded, stage overdue, overdue follow-up).", inputSchema: z.object({}) },
    async () => toContent(await getAttentionTool(admin)),
  );

  server.registerTool(
    "tasks_create",
    {
      description: "Create a follow-up task/reminder for a lead.",
      inputSchema: z.object({
        leadId: z.string().describe("The lead's id."),
        dueDate: z.string().describe("YYYY-MM-DD"),
        dueTime: z.string().optional(),
        type: z.string().optional().describe("One of the CRM's follow-up types; defaults to 'follow_up'."),
        notes: z.string().optional(),
        assignedToId: z.string().optional(),
      }),
    },
    async (args) => toContent(await createTaskTool(admin, args)),
  );

  server.registerTool(
    "reports_daily",
    { description: "Get the per-staff daily report for a date (defaults to today).", inputSchema: z.object({ date: z.string().optional().describe("YYYY-MM-DD; defaults to today") }) },
    async ({ date }) => toContent(await getDailyReportTool(admin, date ?? null)),
  );

  server.registerTool(
    "telegram_send",
    { description: "Send a Telegram message to a CRM staff member by their profile id.", inputSchema: z.object({ profileId: z.string(), text: z.string() }) },
    async (args) => toContent(await sendTelegramTool(admin, args)),
  );

  server.registerTool(
    "bug_ticket_create",
    { description: "File a GitHub bug ticket describing what broke.", inputSchema: z.object({ title: z.string(), body: z.string() }) },
    async (args) => toContent(await createBugTicketTool(admin, args)),
  );

  server.registerTool(
    "telegram_link",
    {
      description: "Link a Telegram chat_id to the CRM staff profile whose telegram_username matches. Call this the first time an unlinked user messages the bot.",
      inputSchema: z.object({ username: z.string().describe("The sender's Telegram @username, without the @."), chatId: z.string() }),
    },
    async (args) => toContent(await linkTelegramChatTool(admin, args)),
  );

  return server;
}

async function handleMcpRequest(request: Request): Promise<Response> {
  const expectedKey = process.env.HERMES_API_KEY;
  if (!expectedKey) {
    console.error("HERMES_API_KEY is not set; rejecting Hermes MCP request.");
    return new Response("Not found", { status: 404 });
  }
  if (!isValidHermesApiKey(request.headers.get("authorization"), expectedKey)) {
    return new Response("Not found", { status: 404 });
  }

  const admin = createAdminClient();
  const server = buildServer(admin);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

// Named directly (not re-exported aliases of a shared helper), matching
// every other route handler in this app.
export async function GET(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}
export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}
export async function DELETE(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}
