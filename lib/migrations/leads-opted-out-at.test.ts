import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static guarantee about the migration file itself -- same convention as
// lib/migrations/leads-updated-at-trigger.test.ts and
// leads-status-changed-at-trigger.test.ts. Behavioural proof (column exists,
// defaults to NULL) was done live against the local Supabase stack -- see
// the phase report.
const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261031110000_leads_opted_out_at.sql"), "utf8");
const code = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .toLowerCase();

describe("leads opted_out_at migration", () => {
  it("adds a nullable timestamptz column (no default, no backfill)", () => {
    expect(code).toMatch(/alter table public\.leads\s+add column if not exists opted_out_at timestamptz/);
    expect(code).not.toContain("not null");
    expect(code).not.toContain("default");
  });

  it("is additive only -- no trigger, no RLS change, no data touched", () => {
    expect(code).not.toMatch(/create\s+(or replace\s+)?(function|trigger)/);
    expect(code).not.toMatch(/\b(create|alter|drop)\s+policy\b/);
    expect(code).not.toMatch(/\bupdate\s+public\.leads\b/);
    expect(code).not.toMatch(/\binsert\s+into\b/);
    expect(code).not.toMatch(/\bdrop\b/);
  });

  it("affects only the leads table", () => {
    const targets = code.match(/\btable\s+(public\.\w+)/g) ?? [];
    expect(new Set(targets)).toEqual(new Set(["table public.leads"]));
  });
});
