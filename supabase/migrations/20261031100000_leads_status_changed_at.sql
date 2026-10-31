-- R-STAGE-002 (docs/BLUEPRINT_V1.md Section 8): "Each stage has a time
-- limit; overdue deals turn red." Needs to know WHEN a lead entered its
-- CURRENT status -- leads.updated_at is not usable for this (any field
-- edit bumps it, not just a status change), so this adds a dedicated
-- column plus the trigger that maintains it.
--
-- Backfill choice: every existing row gets status_changed_at = now() (the
-- column's own default), not an approximation from updated_at/created_at --
-- we genuinely do not know when any existing lead entered its current
-- status, and treating "unknown" as "just now" means this migration cannot
-- retroactively mark anything overdue the moment it ships. The stage timer
-- only starts counting from here forward.
--
-- Scope, deliberately narrow, same shape as
-- 20260922010000_leads_updated_at_trigger.sql:
--   * one new column, NOT NULL with a default (no backfill UPDATE needed)
--   * one trigger function in the `private` schema (not exposed through the API)
--   * one BEFORE UPDATE trigger on public.leads, separate from the existing
--     updated_at trigger (additive -- that migration is never edited)
--   * NO change to any other column, RLS policy, or existing row's data

alter table public.leads
  add column if not exists status_changed_at timestamptz not null default now();

create or replace function private.set_status_changed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.set_status_changed_at() from public;

create or replace trigger leads_set_status_changed_at
  before update on public.leads
  for each row
  execute function private.set_status_changed_at();
