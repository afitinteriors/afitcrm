import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261101090000_ai_agent_settings_and_drafts.sql"), "utf8");
const code = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .toLowerCase();

describe("ai_agent_settings_and_drafts migration", () => {
  it("creates ai_agent_settings as a boolean-key singleton defaulting to the safe state", () => {
    expect(code).toContain("create table public.ai_agent_settings");
    expect(code).toContain("id boolean primary key default true check (id)");
    expect(code).toContain("enabled boolean not null default false");
    expect(code).toContain("mode text not null default 'draft' check (mode in ('draft', 'automatic'))");
    expect(code).toContain("insert into public.ai_agent_settings (id) values (true)");
  });

  it("enables RLS with select-all-authenticated and update-admin-only policies", () => {
    expect(code).toContain("alter table public.ai_agent_settings enable row level security");
    expect(code).toMatch(/create policy ai_agent_settings_select_authenticated on public\.ai_agent_settings\s+for select/);
    expect(code).toMatch(/create policy ai_agent_settings_update_admin_only on public\.ai_agent_settings\s+for update/);
  });

  it("adds two nullable draft columns to conversations, no backfill", () => {
    expect(code).toContain("add column if not exists pending_ai_draft text");
    expect(code).toContain("add column if not exists pending_ai_draft_created_at timestamptz");
    const alterConversations = code.slice(code.indexOf("alter table public.conversations"));
    expect(alterConversations).not.toContain("not null");
    expect(alterConversations).not.toContain("default");
  });

  it("affects only ai_agent_settings and conversations", () => {
    const targets = code.match(/\b(?:table|policy \w+ on)\s+(public\.\w+)/g) ?? [];
    const tables = new Set(targets.map((t) => t.replace(/^.*\s/, "")));
    expect(tables).toEqual(new Set(["public.ai_agent_settings", "public.conversations"]));
  });
});
