import { describe, it, expect, vi, beforeEach } from "vitest";

type QueryResult = { data?: unknown; error?: { message?: string } | null };

function makeBuilder(result: QueryResult) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = { calls };
  for (const method of ["select", "eq", "upsert", "delete"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    });
  }
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder as Record<string, unknown> & { calls: Array<[string, unknown[]]> };
}

function createFake(script: QueryResult[]) {
  const builders: ReturnType<typeof makeBuilder>[] = [];
  const from = vi.fn(() => {
    const b = makeBuilder(script[builders.length] ?? { data: null, error: null });
    builders.push(b);
    return b;
  });
  return { client: { from }, builders, from };
}

function callsOf(b: ReturnType<typeof makeBuilder>, method: string) {
  return b.calls.filter(([m]) => m === method).map(([, args]) => args);
}

let client: ReturnType<typeof createFake>;
vi.mock("@/lib/supabase/server", () => ({ createClient: () => client.client }));

const getCurrentProfileMock = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentProfile: () => getCurrentProfileMock() }));

const recordAuditEvent = vi.fn<(input: Record<string, unknown>) => Promise<void>>();
vi.mock("@/lib/audit", () => ({ recordAuditEvent: (input: Record<string, unknown>) => recordAuditEvent(input) }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getAllPermissionGrants, setPermissionGrant } from "./team-permissions";

const ADMIN = { id: "admin-1", role: "admin" as const };
const STAFF = { id: "staff-1", role: "staff" as const };

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentProfileMock.mockResolvedValue(ADMIN);
  client = createFake([]);
});

describe("getAllPermissionGrants", () => {
  it("returns {} for a non-admin or unauthenticated caller and touches nothing", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF);
    expect(await getAllPermissionGrants()).toEqual({});
    expect(client.from).not.toHaveBeenCalled();

    getCurrentProfileMock.mockResolvedValue(null);
    expect(await getAllPermissionGrants()).toEqual({});
  });

  it("groups flat rows by profile_id into the Record<profileId, PermissionKey[]> shape the UI expects", async () => {
    client = createFake([
      {
        data: [
          { profile_id: "staff-1", permission_key: "leads_view_all" },
          { profile_id: "staff-1", permission_key: "reports_view" },
          { profile_id: "staff-2", permission_key: "audit_log_view" },
        ],
        error: null,
      },
    ]);
    expect(await getAllPermissionGrants()).toEqual({
      "staff-1": ["leads_view_all", "reports_view"],
      "staff-2": ["audit_log_view"],
    });
  });

  it("returns {} (not throw) on a database error", async () => {
    client = createFake([{ data: null, error: { message: "boom" } }]);
    expect(await getAllPermissionGrants()).toEqual({});
  });
});

describe("setPermissionGrant", () => {
  it("rejects a non-admin caller, a missing profile id, and an unknown permission key", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF);
    expect(await setPermissionGrant("staff-1", "leads_view_all", true)).toEqual({ error: "Admin access required." });
    expect(client.from).not.toHaveBeenCalled();

    getCurrentProfileMock.mockResolvedValue(ADMIN);
    expect(await setPermissionGrant("", "leads_view_all", true)).toEqual({ error: "Missing team member." });
    expect(await setPermissionGrant("staff-1", "not_a_real_permission", true)).toEqual({ error: "Unknown permission." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("granting upserts the (profile_id, permission_key) row, recording who granted it", async () => {
    client = createFake([{ error: null }]);
    const result = await setPermissionGrant("staff-1", "leads_view_all", true);
    expect(result).toEqual({ ok: true });
    const [payload, opts] = callsOf(client.builders[0], "upsert")[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(payload).toEqual({ profile_id: "staff-1", permission_key: "leads_view_all", granted_by: "admin-1" });
    expect(opts).toEqual({ onConflict: "profile_id,permission_key" });
    expect(callsOf(client.builders[0], "delete")).toHaveLength(0);
  });

  it("revoking deletes the (profile_id, permission_key) row, not the member's other grants", async () => {
    client = createFake([{ error: null }]);
    const result = await setPermissionGrant("staff-1", "leads_view_all", false);
    expect(result).toEqual({ ok: true });
    expect(callsOf(client.builders[0], "delete")).toHaveLength(1);
    expect(callsOf(client.builders[0], "eq")).toEqual([
      ["profile_id", "staff-1"],
      ["permission_key", "leads_view_all"],
    ]);
    expect(callsOf(client.builders[0], "upsert")).toHaveLength(0);
  });

  it("records a 'setting' audit event naming which member and which permission changed, granted direction included", async () => {
    client = createFake([{ error: null }]);
    await setPermissionGrant("staff-1", "audit_log_view", true);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "setting_changed",
        targetType: "setting",
        targetId: "staff-1",
        metadata: { field: "permission", permission_key: "audit_log_view", granted: true },
      }),
    );
  });

  it("fails closed (no audit event) when the write itself errors", async () => {
    client = createFake([{ error: { message: "boom" } }]);
    const result = await setPermissionGrant("staff-1", "leads_view_all", true);
    expect(result).toEqual({ error: "Could not grant this permission." });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
