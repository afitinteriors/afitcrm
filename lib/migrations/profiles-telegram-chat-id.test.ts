import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261031170000_profiles_telegram_chat_id.sql"), "utf8");
const code = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .toLowerCase();

describe("profiles telegram_chat_id migration", () => {
  it("adds a nullable text column (no default, no backfill)", () => {
    expect(code).toMatch(/alter table public\.profiles\s+add column if not exists telegram_chat_id text/);
    expect(code).not.toContain("not null");
    expect(code).not.toContain("default");
  });

  it("is additive only -- no trigger, no RLS change, no data touched", () => {
    expect(code).not.toMatch(/create\s+(or replace\s+)?(function|trigger)/);
    expect(code).not.toMatch(/\b(create|alter|drop)\s+policy\b/);
    expect(code).not.toMatch(/\bupdate\s+public\.profiles\b/);
    expect(code).not.toMatch(/\binsert\s+into\b/);
    expect(code).not.toMatch(/\bdrop\b/);
  });

  it("affects only the profiles table", () => {
    const targets = code.match(/\btable\s+(public\.\w+)/g) ?? [];
    expect(new Set(targets)).toEqual(new Set(["table public.profiles"]));
  });
});
