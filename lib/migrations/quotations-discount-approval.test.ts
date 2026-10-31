import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static guarantee about the migration file itself -- same convention as
// this project's other migration test files. Behavioural proof was done
// live against the local Supabase stack -- see the phase report.
const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261031140000_quotations_discount_approval.sql"), "utf8");
const code = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .toLowerCase();

describe("quotations discount-approval migration", () => {
  it("adds two nullable columns: who approved and when", () => {
    expect(code).toContain("add column if not exists discount_approved_by uuid references public.profiles(id)");
    expect(code).toContain("add column if not exists discount_approved_at timestamptz");
    expect(code).not.toContain("not null");
  });

  it("is additive only -- no trigger, no RLS change, no data touched", () => {
    expect(code).not.toMatch(/create\s+(or replace\s+)?(function|trigger|policy)/);
    expect(code).not.toMatch(/\bupdate\s+public\.quotations\b/);
    expect(code).not.toMatch(/\binsert\s+into\b/);
    expect(code).not.toMatch(/\bdrop\b/);
  });

  it("affects only the quotations table", () => {
    const targets = code.match(/\btable\s+(public\.\w+)/g) ?? [];
    expect(new Set(targets)).toEqual(new Set(["table public.quotations"]));
  });
});
