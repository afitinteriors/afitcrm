-- Blueprint V1 Phase 6 (docs/BLUEPRINT_V1.md Section 6/12): the customer
-- AI agent's draft/automatic mode toggle and the per-conversation pending
-- draft it writes. Section 12's Settings table lists "AI agent: ... draft
-- or automatic mode, on or off" as an owner-editable setting -- this is
-- that setting, not a fixed timer (the blueprint's "two weeks in draft
-- mode" is a suggested default rollout, not a schema-enforced countdown;
-- the owner flips the switch whenever they're ready).
--
-- Singleton via a boolean primary key that can only ever be `true` --
-- the standard Postgres "exactly one row" pattern. Defaults to the safe
-- state: mode='draft', enabled=false (the agent does nothing at all until
-- explicitly turned on).
create table public.ai_agent_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  mode text not null default 'draft' check (mode in ('draft', 'automatic')),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.ai_agent_settings (id) values (true);

alter table public.ai_agent_settings enable row level security;

create policy ai_agent_settings_select_authenticated on public.ai_agent_settings
  for select
  to authenticated
  using (true);

create policy ai_agent_settings_update_admin_only on public.ai_agent_settings
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- The AI's drafted first reply, waiting for staff to send/edit/discard in
-- draft mode. Null = no pending draft. One at a time (a new draft would
-- overwrite an unsent one -- there is only ever one "next thing to send"
-- per conversation at this stage of the feature).
alter table public.conversations
  add column if not exists pending_ai_draft text,
  add column if not exists pending_ai_draft_created_at timestamptz;
