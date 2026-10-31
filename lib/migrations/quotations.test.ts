import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static guarantees about the migration file itself -- same convention as
// this project's other migration test files. Behavioural proof (RLS scoping,
// trigger, real insert/version flow) was done live against the local
// Supabase stack -- see the phase report.
const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261031130000_quotations.sql"), "utf8");
const code = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .toLowerCase();

describe("quotations table migration", () => {
  it("creates the table with a status check constraint and a (lead_id, version) uniqueness guarantee", () => {
    expect(code).toContain("create table if not exists public.quotations");
    expect(code).toContain("check (status in ('draft', 'sent'))");
    expect(code).toContain("unique (lead_id, version)");
  });

  it("enables row level security", () => {
    expect(code).toContain("alter table public.quotations enable row level security");
  });

  it("defines admin-or-assigned-owner policies for select/insert/update, same shape as follow_ups, and no delete policy", () => {
    expect(code).toContain("create policy quotations_select_admin_or_owner");
    expect(code).toContain("create policy quotations_insert_admin_or_owner");
    expect(code).toContain("create policy quotations_update_admin_or_owner");
    expect(code).not.toMatch(/for delete/);
    // Every policy checks is_admin() OR an EXISTS against leads.assigned_to_id.
    const policyBlocks = code.split(/create policy/).slice(1);
    expect(policyBlocks).toHaveLength(3);
    for (const block of policyBlocks) {
      expect(block).toContain("private.is_admin()");
      expect(block).toContain("l.assigned_to_id = (select auth.uid())");
    }
  });

  it("reuses the existing private.set_updated_at() trigger function rather than defining a new one", () => {
    expect(code).toContain("execute function private.set_updated_at()");
    expect(code).not.toMatch(/create\s+(or replace\s+)?function/);
  });

  it("never touches any other table", () => {
    const targets = [...code.matchAll(/\b(?:table|policy|trigger)\s+(?:if not exists\s+|if exists\s+)?(\w+(?:\.\w+)?)/g)].map((m) => m[1]);
    for (const t of targets) {
      expect(t === "public.quotations" || t === "quotations_set_updated_at" || /^quotations_/.test(t)).toBe(true);
    }
  });
});
