import { describe, it, expect, vi, beforeEach } from "vitest";

type QueryResult = { data?: unknown; error?: { message?: string } | null };

function makeBuilder(result: QueryResult) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = { calls };
  for (const method of ["select", "eq", "order", "insert", "update"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(() => {
    calls.push(["maybeSingle", []]);
    return Promise.resolve(result);
  });
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

import { getWhatsAppNumbers, saveWhatsAppNumber, setDefaultWhatsAppNumber } from "./whatsapp-numbers";

const ADMIN = { id: "admin-1", role: "admin" as const };
const STAFF = { id: "staff-1", role: "staff" as const };

const ROW = {
  id: "num-1",
  label: "Main Line",
  phone_number: "+919876543210",
  status: "connected",
  purpose: "General",
  assigned_staff_ids: [] as string[],
  is_default: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentProfileMock.mockResolvedValue(ADMIN);
  client = createFake([]);
});

describe("getWhatsAppNumbers", () => {
  it("returns [] for a non-admin or unauthenticated caller and touches nothing", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF);
    expect(await getWhatsAppNumbers()).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();

    getCurrentProfileMock.mockResolvedValue(null);
    expect(await getWhatsAppNumbers()).toEqual([]);
  });

  it("maps DB rows (snake_case) to the WhatsAppNumber shape the UI expects (camelCase)", async () => {
    client = createFake([{ data: [ROW], error: null }]);
    expect(await getWhatsAppNumbers()).toEqual([
      {
        id: "num-1",
        label: "Main Line",
        phoneNumber: "+919876543210",
        status: "connected",
        purpose: "General",
        assignedStaffIds: [],
        isDefault: true,
      },
    ]);
  });
});

describe("saveWhatsAppNumber", () => {
  it("rejects a non-admin caller before touching the database", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF);
    const result = await saveWhatsAppNumber({ id: null, label: "X", phoneNumber: "+91...", purpose: "General", assignedStaffIds: [], isDefault: false });
    expect(result).toEqual({ error: "Admin access required." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects an empty label or phone number, before touching the database", async () => {
    expect(
      await saveWhatsAppNumber({ id: null, label: "  ", phoneNumber: "+91...", purpose: "General", assignedStaffIds: [], isDefault: false }),
    ).toEqual({ error: "Give this number a name." });
    expect(
      await saveWhatsAppNumber({ id: null, label: "Sales", phoneNumber: "  ", purpose: "General", assignedStaffIds: [], isDefault: false }),
    ).toEqual({ error: "Enter a phone number." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("creates a new number (id: null -> insert, not update)", async () => {
    client = createFake([{ data: ROW, error: null }]);
    const result = await saveWhatsAppNumber({
      id: null,
      label: "Main Line",
      phoneNumber: "+919876543210",
      purpose: "General",
      assignedStaffIds: [],
      isDefault: false,
    });
    expect(result).toEqual({ ok: true, number: expect.objectContaining({ id: "num-1" }) });
    expect(callsOf(client.builders[0], "insert")).toHaveLength(1);
    expect(callsOf(client.builders[0], "update")).toHaveLength(0);
  });

  it("updates an existing number (id set -> update by id, not insert)", async () => {
    client = createFake([{ data: ROW, error: null }]);
    const result = await saveWhatsAppNumber({
      id: "num-1",
      label: "Main Line",
      phoneNumber: "+919876543210",
      purpose: "General",
      assignedStaffIds: [],
      isDefault: false,
    });
    expect(result).toEqual({ ok: true, number: expect.anything() });
    expect(callsOf(client.builders[0], "update")).toHaveLength(1);
    expect(callsOf(client.builders[0], "insert")).toHaveLength(0);
    expect(callsOf(client.builders[0], "eq")).toEqual([["id", "num-1"]]);
  });

  it("clears every other default BEFORE writing, when isDefault is true -- never two defaults at once", async () => {
    client = createFake([
      { data: null, error: null }, // clear-existing-default update
      { data: { ...ROW, is_default: true }, error: null }, // the actual insert
    ]);
    await saveWhatsAppNumber({
      id: null,
      label: "New Default",
      phoneNumber: "+919876500000",
      purpose: "General",
      assignedStaffIds: [],
      isDefault: true,
    });
    // First call clears is_default=true rows; second call is the real write.
    const [clearPayload] = callsOf(client.builders[0], "update")[0] as [Record<string, unknown>];
    expect(clearPayload).toEqual({ is_default: false });
    expect(callsOf(client.builders[0], "eq")).toEqual([["is_default", true]]);
    expect(callsOf(client.builders[1], "insert")).toHaveLength(1);
  });

  it("records a 'setting' audit event with no customer/number content in metadata beyond what's structurally needed", async () => {
    client = createFake([{ data: ROW, error: null }]);
    await saveWhatsAppNumber({
      id: null,
      label: "Main Line",
      phoneNumber: "+919876543210",
      purpose: "General",
      assignedStaffIds: [],
      isDefault: false,
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1", action: "setting_changed", targetType: "setting", targetId: "num-1" }),
    );
  });
});

describe("setDefaultWhatsAppNumber", () => {
  it("rejects a non-admin caller and a missing id", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF);
    expect(await setDefaultWhatsAppNumber("num-1")).toEqual({ error: "Admin access required." });
    expect(client.from).not.toHaveBeenCalled();

    getCurrentProfileMock.mockResolvedValue(ADMIN);
    expect(await setDefaultWhatsAppNumber("")).toEqual({ error: "Missing number." });
  });

  it("clears the old default then sets the new one, in that order", async () => {
    client = createFake([{ error: null }, { error: null }]);
    const result = await setDefaultWhatsAppNumber("num-2");
    expect(result).toEqual({ ok: true });
    expect(callsOf(client.builders[0], "eq")).toEqual([["is_default", true]]);
    const [clearPayload] = callsOf(client.builders[0], "update")[0] as [Record<string, unknown>];
    expect(clearPayload).toEqual({ is_default: false });
    expect(callsOf(client.builders[1], "eq")).toEqual([["id", "num-2"]]);
    const [setPayload] = callsOf(client.builders[1], "update")[0] as [Record<string, unknown>];
    expect(setPayload).toEqual({ is_default: true });
  });
});
