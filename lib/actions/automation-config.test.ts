import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildEmptyBuilderGraph, type BuilderGraph } from "@/lib/automations/builder-graph";

// Safety tests for the Automation Builder save action. The rule under test:
// the builder can never make a flow live. Only the existing executor reads
// status 'active', so the action must always write 'draft', ignore any
// client-sent is_active, refuse to edit a live row, and only stamp
// meta.publishedAt when a complete flow is published.

const updates: { table: string; values: Record<string, unknown> }[] = [];
const inserts: { table: string; values: Record<string, unknown> }[] = [];
let existingStatus: string | null = null;
let profileRole: "admin" | "staff" | null = "admin";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getCurrentProfile: vi.fn(async () => (profileRole ? { id: "u1", role: profileRole } : null)),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = vi.fn(chain);
      builder.eq = vi.fn(chain);
      builder.maybeSingle = vi.fn(async () => ({
        data: existingStatus === null ? null : { status: existingStatus },
        error: null,
      }));
      builder.update = vi.fn((values: Record<string, unknown>) => {
        updates.push({ table, values });
        return { eq: vi.fn(async () => ({ error: null })) };
      });
      builder.insert = vi.fn((values: Record<string, unknown>) => {
        inserts.push({ table, values });
        return {
          select: () => ({ single: async () => ({ data: { id: "new-id" }, error: null }) }),
        };
      });
      return builder;
    },
  })),
}));

const { saveAutomationGraph } = await import("@/lib/actions/automation-config");

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

// A complete, publishable flow: keyword trigger -> send text -> end.
function completeGraph(): BuilderGraph {
  const g = buildEmptyBuilderGraph();
  return {
    ...g,
    nodes: [
      { id: "t", type: "trigger", position: { x: 0, y: 0 }, data: { keywords: ["interior"] } },
      { id: "w", type: "send_text", position: { x: 0, y: 0 }, data: { text: "Welcome!" } },
      { id: "e", type: "end_flow", position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [
      { id: "1", source: "t", target: "w", sourceHandle: "matched" },
      { id: "2", source: "w", target: "e", sourceHandle: "next" },
      { id: "3", source: "t", target: "e", sourceHandle: "not_matched" },
    ],
  };
}

const base = { service_id: "svc-1", flow_name: "Interior enquiries" };

beforeEach(() => {
  updates.length = 0;
  inserts.length = 0;
  existingStatus = null;
  profileRole = "admin";
});

describe("saveAutomationGraph (builder safety)", () => {
  it("refuses non-admin callers", async () => {
    profileRole = "staff";
    const result = await saveAutomationGraph(null, form({ ...base, graph: JSON.stringify(completeGraph()) }));
    expect(result).toEqual({ error: "Admin access required." });
    expect(updates).toEqual([]);
    expect(inserts).toEqual([]);
  });

  it("always writes status draft, even when the client asks for is_active=true", async () => {
    await saveAutomationGraph(
      null,
      form({ ...base, graph: JSON.stringify(completeGraph()), is_active: "true", mode: "draft" })
    );
    expect(inserts).toHaveLength(1);
    expect(inserts[0].values.status).toBe("draft");
  });

  it("never writes status active, for either save mode", async () => {
    await saveAutomationGraph(null, form({ ...base, graph: JSON.stringify(completeGraph()), mode: "publish" }));
    await saveAutomationGraph(null, form({ ...base, graph: JSON.stringify(completeGraph()), mode: "draft" }));
    for (const write of [...inserts, ...updates]) {
      expect(write.values.status).not.toBe("active");
    }
  });

  it("refuses to edit a flow that is already live, and writes nothing", async () => {
    existingStatus = "active";
    const result = await saveAutomationGraph(
      null,
      form({ ...base, automation_id: "auto-1", graph: JSON.stringify(completeGraph()) })
    );
    expect(result).toEqual({ error: "This flow is live, so it can't be edited here. Nothing was changed." });
    expect(updates).toEqual([]);
  });

  it("saves a draft with publishedAt cleared", async () => {
    const result = await saveAutomationGraph(null, form({ ...base, graph: JSON.stringify(completeGraph()) }));
    expect(result).toEqual({ automationId: "new-id", publishedAt: null });
    const actions = inserts[0].values.actions as { meta: { publishedAt: string | null } };
    expect(actions.meta.publishedAt).toBeNull();
  });

  it("publish is blocked by validation and writes nothing", async () => {
    const incomplete = completeGraph();
    incomplete.nodes[1] = { ...incomplete.nodes[1], data: { text: "" } };
    const result = await saveAutomationGraph(null, form({ ...base, graph: JSON.stringify(incomplete), mode: "publish" }));
    expect(result).toEqual({ error: expect.stringContaining("Send Text") });
    expect(inserts).toEqual([]);
    expect(updates).toEqual([]);
  });

  it("publish of a complete flow stamps publishedAt but stays a draft", async () => {
    const result = await saveAutomationGraph(null, form({ ...base, graph: JSON.stringify(completeGraph()), mode: "publish" }));
    if (!result || !("automationId" in result)) throw new Error("expected success");
    expect(result.publishedAt).toEqual(expect.any(String));
    const actions = inserts[0].values.actions as { meta: { publishedAt: string | null } };
    expect(actions.meta.publishedAt).toEqual(result.publishedAt);
    expect(inserts[0].values.status).toBe("draft");
  });

  it("rejects a flow name longer than 80 characters", async () => {
    const result = await saveAutomationGraph(
      null,
      form({ ...base, flow_name: "x".repeat(81), graph: JSON.stringify(completeGraph()) })
    );
    expect(result).toEqual({ error: "Flow name must be 80 characters or fewer." });
  });

  it("rejects an unknown block type from the client", async () => {
    const bad = { ...completeGraph(), nodes: [{ id: "x", type: "run_shell", position: { x: 0, y: 0 } }] };
    const result = await saveAutomationGraph(null, form({ ...base, graph: JSON.stringify(bad) }));
    expect(result).toEqual({ error: expect.stringContaining("unknown block type") });
  });
});
