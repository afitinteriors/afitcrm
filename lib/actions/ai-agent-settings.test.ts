import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type QueryResult = { data?: unknown; error?: { message?: string } | null };

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  builder.update = vi.fn((payload: unknown) => {
    (builder as { lastUpdate?: unknown }).lastUpdate = payload;
    return builder;
  });
  builder.eq = vi.fn(() => Promise.resolve(result));
  return builder;
}

let fakeSupabase: SupabaseClient<Database>;
let lastUpdatePayload: unknown;
function createFakeSupabase(result: QueryResult) {
  const from = vi.fn(() => {
    const builder = makeBuilder(result);
    const originalUpdate = builder.update as (payload: unknown) => unknown;
    builder.update = (payload: unknown) => {
      lastUpdatePayload = payload;
      return originalUpdate(payload);
    };
    return builder;
  });
  return { from } as unknown as SupabaseClient<Database>;
}

vi.mock("@/lib/supabase/server", () => ({ createClient: () => fakeSupabase }));

const getCurrentProfileMock = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentProfile: () => getCurrentProfileMock() }));

const recordAuditEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit", () => ({ recordAuditEvent: (...args: unknown[]) => recordAuditEventMock(...args) }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateAiAgentSettings } from "./ai-agent-settings";

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("updateAiAgentSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastUpdatePayload = undefined;
    fakeSupabase = createFakeSupabase({ error: null });
  });

  it("rejects a non-admin", async () => {
    getCurrentProfileMock.mockResolvedValue({ id: "s1", role: "staff" });
    expect(await updateAiAgentSettings(null, formDataWith({ mode: "draft" }))).toEqual({ error: "You do not have access to this setting." });
  });

  it("rejects a missing/invalid mode", async () => {
    getCurrentProfileMock.mockResolvedValue({ id: "a1", role: "admin" });
    expect(await updateAiAgentSettings(null, formDataWith({ mode: "not-a-mode" }))).toEqual({ error: "Invalid mode." });
  });

  it("saves enabled=false when the checkbox is unchecked (absent from formData)", async () => {
    getCurrentProfileMock.mockResolvedValue({ id: "a1", role: "admin" });
    const result = await updateAiAgentSettings(null, formDataWith({ mode: "draft" }));
    expect(result).toBeNull();
    expect(lastUpdatePayload).toMatchObject({ enabled: false, mode: "draft", updated_by: "a1" });
  });

  it("saves enabled=true and mode=automatic, and audits the change", async () => {
    getCurrentProfileMock.mockResolvedValue({ id: "a1", role: "admin" });
    const result = await updateAiAgentSettings(null, formDataWith({ enabled: "on", mode: "automatic" }));
    expect(result).toBeNull();
    expect(lastUpdatePayload).toMatchObject({ enabled: true, mode: "automatic" });
    expect(recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({ action: "setting_changed" }));
  });

  it("always touches updated_at -- no DB trigger exists for this table", async () => {
    getCurrentProfileMock.mockResolvedValue({ id: "a1", role: "admin" });
    await updateAiAgentSettings(null, formDataWith({ mode: "draft" }));
    expect(lastUpdatePayload).toMatchObject({ updated_at: expect.any(String) });
  });

  it("surfaces a DB error", async () => {
    getCurrentProfileMock.mockResolvedValue({ id: "a1", role: "admin" });
    fakeSupabase = createFakeSupabase({ error: { message: "db down" } });
    expect(await updateAiAgentSettings(null, formDataWith({ mode: "draft" }))).toEqual({ error: "db down" });
  });
});
