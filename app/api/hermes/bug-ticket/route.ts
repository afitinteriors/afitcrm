import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidHermesApiKey } from "@/lib/hermes-auth";
import { createBugTicket, GitHubBugTicketError } from "@/lib/github-bug-ticket";
import { recordAgentEvent } from "@/lib/hermes/agent-events";

export const runtime = "nodejs";

// Blueprint V1 Section 9, Phase 5: "Create bug tickets in GitHub." Hermes
// supplies title + body (what broke, when, how many leads affected, logs
// -- Section 9's own description of what a ticket should contain); this
// route only opens the issue, nothing more.
export async function POST(request: NextRequest) {
  const expectedKey = process.env.HERMES_API_KEY;
  if (!expectedKey) {
    console.error("HERMES_API_KEY is not set; rejecting Hermes tool request.");
    return new NextResponse("Not found", { status: 404 });
  }

  if (!isValidHermesApiKey(request.headers.get("authorization"), expectedKey)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title : null;
  const description = typeof input.body === "string" ? input.body : null;
  if (!title || !description) {
    return NextResponse.json({ error: "title and body are required." }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const ticket = await createBugTicket(title, description);

    await recordAgentEvent(admin, {
      eventType: "create",
      toolName: "bug-ticket.create",
      summary: `Filed GitHub issue #${ticket.number}: ${title}`,
      metadata: { issueNumber: ticket.number, htmlUrl: ticket.htmlUrl },
    });

    return NextResponse.json({ number: ticket.number, htmlUrl: ticket.htmlUrl }, { status: 201 });
  } catch (err) {
    const message = err instanceof GitHubBugTicketError ? err.message : "Failed to create the bug ticket.";
    await recordAgentEvent(admin, {
      eventType: "create",
      toolName: "bug-ticket.create",
      summary: `Failed to file a GitHub issue: ${title}`,
      metadata: { title, failed: true, reason: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
