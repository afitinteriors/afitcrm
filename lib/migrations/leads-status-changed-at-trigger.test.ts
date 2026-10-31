import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static guarantees about the migration file itself -- same convention as
// lib/migrations/leads-updated-at-trigger.test.ts. The behavioural proof
// (status_changed_at advances on a status change, not on an unrelated
// field edit) was done live against the local Supabase stack -- see the
// phase report -- because this project's vitest setup has no Postgres.
const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261031100000_leads_status_changed_at.sql"), "utf8");
const code = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .toLowerCase();

describe("leads status_changed_at migration", () => {
  it("adds the column as NOT NULL with a default (no separate backfill UPDATE needed)", () => {
    expect(code).toMatch(/alter table public\.leads\s+add column if not exists status_changed_at timestamptz not null default now\(\)/);
  });

  it("defines a BEFORE UPDATE row trigger on public.leads that calls the private function", () => {
    expect(code).toMatch(
      /create (or replace )?trigger leads_set_status_changed_at\s+before update on public\.leads\s+for each row\s+execute function private\.set_status_changed_at\(\)/,
    );
  });

  it("puts the function in the private schema with an empty search_path", () => {
    expect(code).toContain("create or replace function private.set_status_changed_at()");
    expect(code).toContain("returns trigger");
    expect(code).toContain("set search_path = ''");
    expect(code).not.toMatch(/create (or replace )?function public\./);
  });

  it("only assigns status_changed_at, and only when status actually changed", () => {
    const assignments = code.match(/new\.\w+\s*:?=/g) ?? [];
    expect(assignments).toEqual(["new.status_changed_at :="]);
    expect(code).toContain("new.status is distinct from old.status");
  });

  it("is a separate, additive trigger -- never edits the existing updated_at migration", () => {
    expect(code).not.toContain("set_updated_at");
    expect(code).not.toMatch(/\bupdate\s+public\.leads\b/);
    expect(code).not.toMatch(/\bdelete\s+from\b/);
    expect(code).not.toMatch(/\btruncate\b/);
  });

  it("does not touch RLS or other schema objects", () => {
    expect(code).not.toMatch(/\b(create|alter|drop)\s+policy\b/);
    expect(code).not.toMatch(/row level security/);
    expect(code).not.toMatch(/\bdrop\b/);
    expect(code).not.toMatch(/\bcreate\s+table\b/);
  });

  it("affects only the leads table", () => {
    const targets = code.match(/\bon\s+(public\.\w+)/g) ?? [];
    expect(new Set(targets)).toEqual(new Set(["on public.leads"]));
  });
});
