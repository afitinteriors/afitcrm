import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static guarantee about the migration file itself -- same convention as
// this project's other migration test files. Behavioural proof (table
// exists, RLS enforced) was done live against the local Supabase stack --
// see the phase report.
const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261031160000_agent_events.sql"), "utf8");
const code = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .toLowerCase();

describe("agent_events migration", () => {
  it("creates the table with the expected columns and event_type check", () => {
    expect(code).toContain("create table public.agent_events");
    expect(code).toContain("event_type text not null check (event_type in ('read', 'send', 'create'))");
    expect(code).toContain("tool_name text not null");
    expect(code).toContain("summary text not null");
    expect(code).toContain("metadata jsonb");
  });

  it("enables row level security with an admin-only select policy", () => {
    expect(code).toContain("alter table public.agent_events enable row level security");
    expect(code).toMatch(/create policy agent_events_select_admin_only on public\.agent_events\s+for select\s+using \(private\.is_admin\(\)\)/);
  });

  it("has no insert policy -- the service-role tool server is the only writer", () => {
    expect(code).not.toMatch(/create policy\s+\S*insert/);
    expect(code).not.toContain("for insert");
  });

  it("affects only the agent_events table", () => {
    const targets = code.match(/\b(?:table|policy \w+ on)\s+(public\.\w+)/g) ?? [];
    const tables = new Set(targets.map((t) => t.replace(/^.*\s/, "")));
    expect(tables).toEqual(new Set(["public.agent_events"]));
  });
});
