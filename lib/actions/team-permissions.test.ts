import { describe, it, expect, vi, beforeEach } from "vitest";

type QueryResult = { data?: unknown; error?: { message?: string } | null };

function makeBuilder(result: QueryResult) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = { calls };
  for (const method of ["select", "eq", "in", "upsert", "insert", "update", "delete"]) {
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

const inviteUserByEmail = vi.fn();
const updateUserById = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { inviteUserByEmail: (...a: unknown[]) => inviteUserByEmail(...a), updateUserById: (...a: unknown[]) => updateUserById(...a) } } }),
}));

import {
  getAllPermissionGrants,
  setPermissionGrant,
  inviteTeamMember,
  deactivateTeamMember,
  reactivateTeamMember,
  setTelegramUsername,
} from "./team-permissions";

const ADMIN = { id: "admin-1", role: "admin" as const };
const STAFF = { id: "staff-1", role: "staff" as const };

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentProfileMock.mockResolvedValue(ADMIN);
  client = createFake([]);
  inviteUserByEmail.mockResolvedValue({ data: { user: { id: "new-user-1" } }, error: null });
  updateUserById.mockResolvedValue({ error: null });
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


describe("inviteTeamMember", () => {
  const INPUT = { name: "Rahul K.", email: "Rahul@Example.com", role: "staff" as const, telegramUsername: "rahul_afit" };

  it("rejects a non-admin caller before touching Auth or the database", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF);
    expect(await inviteTeamMember(INPUT)).toEqual({ error: "Admin access required." });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects a missing name, an invalid email, or an invalid role", async () => {
    expect(await inviteTeamMember({ ...INPUT, name: "  " })).toEqual({ error: "Enter a name." });
    expect(await inviteTeamMember({ ...INPUT, email: "not-an-email" })).toEqual({ error: "Enter a valid email." });
    expect(await inviteTeamMember({ ...INPUT, role: "owner" as unknown as "admin" })).toEqual({ error: "Invalid role." });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("invites via the Admin API (lowercased email), then inserts the matching profiles row", async () => {
    client = createFake([{ error: null }]);
    const result = await inviteTeamMember(INPUT);
    expect(result).toEqual({ ok: true });
    expect(inviteUserByEmail).toHaveBeenCalledWith("rahul@example.com");
    expect(callsOf(client.builders[0], "insert")[0]).toEqual([
      { id: "new-user-1", role: "staff", display_name: "Rahul K.", telegram_username: "rahul_afit" },
    ]);
  });

  it("surfaces the Admin API error and never touches profiles when the invite itself fails", async () => {
    inviteUserByEmail.mockResolvedValue({ data: null, error: { message: "email rate limit exceeded" } });
    const result = await inviteTeamMember(INPUT);
    expect(result).toEqual({ error: "email rate limit exceeded" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("reports a clear error (not a throw) when the auth user is created but the profiles insert fails", async () => {
    client = createFake([{ error: { message: "boom" } }]);
    const result = await inviteTeamMember(INPUT);
    expect(result).toEqual({ error: "Account created but the team profile could not be saved. Try inviting this email again." });
  });

  it("records a team_member_invited audit event against the new profile id", async () => {
    client = createFake([{ error: null }]);
    await inviteTeamMember(INPUT);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1", action: "team_member_invited", targetType: "profile", targetId: "new-user-1", metadata: { role: "staff" } }),
    );
  });
});

describe("deactivateTeamMember", () => {
  it("rejects a non-admin caller and refuses self-deactivation", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF);
    expect(await deactivateTeamMember("staff-1", null)).toEqual({ error: "Admin access required." });

    getCurrentProfileMock.mockResolvedValue(ADMIN);
    expect(await deactivateTeamMember("admin-1", null)).toEqual({ error: "You can't deactivate your own account." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("sets active=false, bans the Auth account, and reassigns only open leads to the chosen member", async () => {
    client = createFake([{ error: null }, { data: [{ id: "lead-1" }, { id: "lead-2" }], error: null }]);
    const result = await deactivateTeamMember("staff-1", "staff-2");
    expect(result).toEqual({ ok: true, reassignedLeadCount: 2 });

    expect(callsOf(client.builders[0], "update")[0]).toEqual([{ active: false }]);
    expect(updateUserById).toHaveBeenCalledWith("staff-1", { ban_duration: "876000h" });

    expect(callsOf(client.builders[1], "update")[0]).toEqual([{ assigned_to_id: "staff-2" }]);
    expect(callsOf(client.builders[1], "eq")[0]).toEqual(["assigned_to_id", "staff-1"]);
    const [[statusFilter]] = callsOf(client.builders[1], "in");
    expect(statusFilter).toBe("status");
  });

  it("leaves reassigned leads unassigned (null) when no reassignToId is given", async () => {
    client = createFake([{ error: null }, { data: [], error: null }]);
    await deactivateTeamMember("staff-1", null);
    expect(callsOf(client.builders[1], "update")[0]).toEqual([{ assigned_to_id: null }]);
  });

  it("rolls the active flag back and reports an error if banning the Auth account fails", async () => {
    client = createFake([{ error: null }]);
    updateUserById.mockResolvedValue({ error: { message: "boom" } });
    const result = await deactivateTeamMember("staff-1", null);
    expect(result).toEqual({ error: "Could not revoke this member's sign-in access. Nothing was changed." });
    // Each .from("profiles") call gets its own builder instance: the first
    // sets active=false, the second (rollback, after the ban call fails)
    // sets it back to true.
    expect(callsOf(client.builders[0], "update")[0]).toEqual([{ active: false }]);
    expect(callsOf(client.builders[1], "update")[0]).toEqual([{ active: true }]);
  });

  it("records a team_member_deactivated audit event with the reassignment details", async () => {
    client = createFake([{ error: null }, { data: [{ id: "lead-1" }], error: null }]);
    await deactivateTeamMember("staff-1", "staff-2");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "team_member_deactivated",
        targetType: "profile",
        targetId: "staff-1",
        metadata: { reassigned_to: "staff-2", reassigned_lead_count: 1 },
      }),
    );
  });
});

describe("reactivateTeamMember", () => {
  it("rejects a non-admin caller", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF);
    expect(await reactivateTeamMember("staff-1")).toEqual({ error: "Admin access required." });
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("unbans the Auth account before setting active=true", async () => {
    client = createFake([{ error: null }]);
    const result = await reactivateTeamMember("staff-1");
    expect(result).toEqual({ ok: true });
    expect(updateUserById).toHaveBeenCalledWith("staff-1", { ban_duration: "none" });
    expect(callsOf(client.builders[0], "update")[0]).toEqual([{ active: true }]);
  });

  it("does not touch profiles if unbanning fails", async () => {
    updateUserById.mockResolvedValue({ error: { message: "boom" } });
    const result = await reactivateTeamMember("staff-1");
    expect(result).toEqual({ error: "Could not restore this member's sign-in access." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("records a team_member_reactivated audit event", async () => {
    client = createFake([{ error: null }]);
    await reactivateTeamMember("staff-1");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1", action: "team_member_reactivated", targetType: "profile", targetId: "staff-1" }),
    );
  });
});

describe("setTelegramUsername", () => {
  it("rejects a non-admin caller", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF);
    expect(await setTelegramUsername("staff-1", "rahul")).toEqual({ error: "Admin access required." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("trims the value and stores null for a blank username (clearing it)", async () => {
    client = createFake([{ error: null }]);
    await setTelegramUsername("staff-1", "  rahul_afit  ");
    expect(callsOf(client.builders[0], "update")[0]).toEqual([{ telegram_username: "rahul_afit" }]);

    client = createFake([{ error: null }]);
    await setTelegramUsername("staff-1", "   ");
    expect(callsOf(client.builders[0], "update")[0]).toEqual([{ telegram_username: null }]);
  });

  it("records a setting_changed audit event naming the telegram_username field", async () => {
    client = createFake([{ error: null }]);
    await setTelegramUsername("staff-1", "rahul_afit");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1", action: "setting_changed", targetType: "setting", targetId: "staff-1", metadata: { field: "telegram_username" } }),
    );
  });
});
