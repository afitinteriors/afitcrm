-- Blueprint V1 Section 11 (docs/BLUEPRINT_V1.md): "agent_events: What Hermes
-- read, sent and created. Append only." Phase 5's CRM tool server logs one
-- row here per tool call it serves -- the audit trail for a service that has
-- no Supabase auth session of its own (it authenticates with a separate,
-- limited HERMES_API_KEY -- see lib/hermes-auth.ts -- never the database
-- service role key, per Section 9's "Tools Hermes never gets: ... Direct
-- database access or the database service key").
--
-- Privacy rule (Section 9): "messages Hermes sends or sends to its model
-- show lead number, area and service ... but not phone numbers or full
-- names." summary/metadata here must follow the same rule -- this table is
-- what Hermes actually saw/sent, so it inherits the same privacy floor as
-- the messages themselves.
--
-- No actor_id / auth.uid() check (unlike audit_logs): Hermes has no
-- Supabase auth session. Every insert happens through the service-role
-- client from the Phase 5 tool server routes, which bypasses RLS -- so
-- there is deliberately no INSERT policy below (default deny for
-- anon/authenticated is correct; the service role is the only writer).

create table public.agent_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('read', 'send', 'create')),
  tool_name text not null,
  summary text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index agent_events_created_at_idx on public.agent_events (created_at desc);
create index agent_events_tool_name_idx on public.agent_events (tool_name);

alter table public.agent_events enable row level security;

create policy agent_events_select_admin_only on public.agent_events
  for select
  using (private.is_admin());
