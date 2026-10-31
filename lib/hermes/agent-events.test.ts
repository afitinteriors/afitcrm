import { describe, expect, it, vi } from "vitest";
import { privacySafeLeadReference, recordAgentEvent } from "./agent-events";

describe("privacySafeLeadReference", () => {
  it("formats a short id, area and service -- never phone or name", () => {
    const ref = privacySafeLeadReference({
      id: "abcdef12-3456-7890-abcd-ef1234567890",
      location: "Kollam",
      service_required: "Gypsum plastering",
      project_type: "Residential",
    });
    expect(ref).toBe("Lead ABCDEF12 — Kollam — Gypsum plastering");
  });

  it("falls back to project_type when service_required is null", () => {
    const ref = privacySafeLeadReference({
      id: "abcdef12-3456-7890-abcd-ef1234567890",
      location: "Kochi",
      service_required: null,
      project_type: "Interior",
    });
    expect(ref).toBe("Lead ABCDEF12 — Kochi — Interior");
  });

  it("falls back to placeholder text when location/service/type are all null", () => {
    const ref = privacySafeLeadReference({ id: "abcdef12-3456-7890-abcd-ef1234567890", location: null, service_required: null, project_type: null });
    expect(ref).toBe("Lead ABCDEF12 — Unknown area — Unknown service");
  });
});

describe("recordAgentEvent", () => {
  it("inserts the event with the given fields", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const supabase = { from } as never;

    await recordAgentEvent(supabase, { eventType: "read", toolName: "attention", summary: "Read 3 leads." });

    expect(from).toHaveBeenCalledWith("agent_events");
    expect(insert).toHaveBeenCalledWith({
      event_type: "read",
      tool_name: "attention",
      summary: "Read 3 leads.",
      metadata: null,
    });
  });

  it("is fail-open: never throws when the insert errors", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const from = vi.fn().mockReturnValue({ insert });
    const supabase = { from } as never;

    await expect(recordAgentEvent(supabase, { eventType: "create", toolName: "tasks.create", summary: "x" })).resolves.toBeUndefined();
  });

  it("is fail-open: never throws when the client itself throws", async () => {
    const from = vi.fn().mockImplementation(() => {
      throw new Error("connection lost");
    });
    const supabase = { from } as never;

    await expect(recordAgentEvent(supabase, { eventType: "send", toolName: "telegram.send", summary: "x" })).resolves.toBeUndefined();
  });
});
