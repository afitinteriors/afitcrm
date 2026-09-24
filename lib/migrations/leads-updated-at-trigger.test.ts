import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static guarantees about the migration file itself. The behavioural proof
// (updated_at advances on a real change, not on a no-op, created_at and other
// rows untouched) is done against a scratch table in the database -- see the
// phase report -- because this project's vitest setup has no Postgres.
const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20260922010000_leads_updated_at_trigger.sql"), "utf8");
// Drop `--` comments so the assertions below only see executable SQL.
const code = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .toLowerCase();

describe("leads updated_at migration", () => {
  it("defines a BEFORE UPDATE row trigger on public.leads that calls the private function", () => {
    expect(code).toMatch(/create (or replace )?trigger leads_set_updated_at\s+before update on public\.leads\s+for each row\s+execute function private\.set_updated_at\(\)/);
  });

  it("puts the function in the private schema with an empty search_path", () => {
    expect(code).toContain("create or replace function private.set_updated_at()");
    expect(code).toContain("returns trigger");
    expect(code).toContain("set search_path = ''");
    expect(code).not.toMatch(/create (or replace )?function public\./);
  });

  it("only assigns updated_at, and only when the row actually changed", () => {
    const assignments = code.match(/new\.\w+\s*:?=/g) ?? [];
    expect(assignments).toEqual(["new.updated_at :="]);
    expect(code).toContain("new is distinct from old");
    expect(code).not.toContain("created_at");
  });

  it("never rewrites existing rows or touches data", () => {
    expect(code).not.toMatch(/\bupdate\s+public\.leads\b/);
    expect(code).not.toMatch(/\binsert\s+into\b/);
    expect(code).not.toMatch(/\bdelete\s+from\b/);
    expect(code).not.toMatch(/\btruncate\b/);
  });

  it("does not touch RLS or other schema objects", () => {
    expect(code).not.toMatch(/\b(create|alter|drop)\s+policy\b/);
    expect(code).not.toMatch(/row level security/);
    expect(code).not.toMatch(/\balter\s+table\b/);
    expect(code).not.toMatch(/\bdrop\b/);
    expect(code).not.toMatch(/\bcreate\s+table\b/);
  });

  it("affects only the leads table", () => {
    const targets = code.match(/\bon\s+(public\.\w+)/g) ?? [];
    expect(new Set(targets)).toEqual(new Set(["on public.leads"]));
  });
});
