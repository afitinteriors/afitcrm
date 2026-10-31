-- R-QUOTE-001 (docs/BLUEPRINT_V1.md Section 8): "A sent quotation is never
-- edited; a change creates a new version. v1 sent, customer asks change ->
-- v2." leads.quotation_amount today is a single freely-editable number with
-- no history and no lock -- this adds the real versioned record alongside
-- it. leads.quotation_amount is kept (not dropped) and stays the
-- denormalized "current amount" every existing reader (dashboard, reports,
-- the Commercial card) already uses -- the new table is the source of
-- truth staff actually write to; app code keeps it in sync on every write.
-- PDF generation (Phase 7's "versioned quotation PDF") is NOT built here --
-- that is a separate, larger capability, deferred as its own increment.
--
-- Workflow this supports: a quotation starts as a 'draft' row staff can
-- freely edit in place (no version bump for iterating before it's actually
-- shared with the customer). Marking it 'sent' locks that row -- any
-- further change creates a new version, never an edit to a sent row. "Sent"
-- here is a staff-asserted status flag (they shared it some other way --
-- WhatsApp, verbally), not an automated send/delivery -- this app has no
-- quotation-delivery mechanism yet.

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  version integer not null,
  amount numeric not null,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (lead_id, version)
);

create index if not exists quotations_lead_id_idx on public.quotations (lead_id);

alter table public.quotations enable row level security;

-- Same admin-or-assigned-owner shape as follow_ups_*_admin_or_owner --
-- anyone who can see/work the lead can see and manage its quotations.
-- No delete policy (append-only, same as follow_ups/call_logs).

create policy quotations_select_admin_or_owner
  on public.quotations for select
  using (
    (select private.is_admin())
    or exists (select 1 from public.leads l where l.id = quotations.lead_id and l.assigned_to_id = (select auth.uid()))
  );

create policy quotations_insert_admin_or_owner
  on public.quotations for insert
  with check (
    (select private.is_admin())
    or exists (select 1 from public.leads l where l.id = quotations.lead_id and l.assigned_to_id = (select auth.uid()))
  );

create policy quotations_update_admin_or_owner
  on public.quotations for update
  using (
    (select private.is_admin())
    or exists (select 1 from public.leads l where l.id = quotations.lead_id and l.assigned_to_id = (select auth.uid()))
  )
  with check (
    (select private.is_admin())
    or exists (select 1 from public.leads l where l.id = quotations.lead_id and l.assigned_to_id = (select auth.uid()))
  );

create or replace trigger quotations_set_updated_at
  before update on public.quotations
  for each row
  execute function private.set_updated_at();
