-- Phase "Call outcome popup" (docs/BLUEPRINT_V1.md Phase 3; CLAUDE.md
-- Blueprint V1): R-CALL-001 (the outcome popup cannot be skipped) and
-- R-CALL-002 (every outcome needs a next follow-up date, except Wrong
-- number).
--
-- call_logs is append-only history of every call attempt, one row per
-- call. A row starts PENDING (outcome and resolved_at both null) the
-- moment the caller presses "Call now" in the popup, before the outcome
-- is known -- this is what lets the popup survive a page reload or the
-- app losing focus: on next load, any pending row for the signed-in
-- caller reopens the popup. Resolving fills outcome/notes/
-- next_follow_up_date exactly once; a resolved row can never be edited
-- again (enforced by RLS below, not just the UI).
--
-- on delete restrict (not cascade): a lead with any call history,
-- pending or resolved, cannot be deleted -- matches this project's
-- existing "history is never lost" stance (audit_logs is append-only;
-- leads.merged_into_id is already restrict for the same reason).

create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete restrict,
  caller_id uuid not null references public.profiles (id),
  outcome text check (outcome in ('answered', 'no_answer', 'busy', 'wrong_number', 'not_interested')),
  notes text,
  next_follow_up_date date,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  -- A call is either still pending (both null) or fully resolved (both
  -- set) -- never half-filled.
  constraint call_logs_pending_or_resolved check ((outcome is null) = (resolved_at is null)),
  -- R-CALL-002: a next follow-up date is required for every outcome
  -- except wrong_number. Enforced here too (not only in the server
  -- action) so a bug can't silently create a dateless requirement.
  constraint call_logs_followup_required check (
    outcome is null or outcome = 'wrong_number' or next_follow_up_date is not null
  )
);

-- At most one unresolved call per caller at a time. This is what makes
-- "reopen the popup on next load" unambiguous (there is only ever one
-- pending row to find), and it is also the mechanism that stops a second
-- Call tap from starting a parallel, never-resolved row.
create unique index call_logs_one_pending_per_caller
  on public.call_logs (caller_id)
  where (outcome is null);

create index call_logs_lead_id_idx on public.call_logs (lead_id);

alter table public.call_logs enable row level security;
revoke all on public.call_logs from anon;

-- SELECT: admin sees all; a caller always sees their own call history
-- (even if the lead is later reassigned away from them); staff otherwise
-- see call history for leads currently assigned to them -- same
-- admin-or-owner shape as `leads`.
create policy "call_logs_select_admin_or_owner" on public.call_logs
for select to authenticated
using (
  (select private.is_admin())
  or caller_id = (select auth.uid())
  or lead_id in (select id from public.leads where assigned_to_id = (select auth.uid()))
);

-- INSERT: caller_id must always be the signed-in user (nobody logs a
-- call as somebody else, admin included), and the lead must be one they
-- can access (admin, or their own assigned lead).
create policy "call_logs_insert_self" on public.call_logs
for insert to authenticated
with check (
  caller_id = (select auth.uid())
  and (
    (select private.is_admin())
    or lead_id in (select id from public.leads where assigned_to_id = (select auth.uid()))
  )
);

-- UPDATE: resolving a pending call. A caller may only move their OWN
-- still-pending row (outcome is null going in) to resolved (outcome is
-- not null coming out) -- a fill-once operation, not a general edit; a
-- resolved row can never be updated again by this policy. The column
-- grant below further restricts which columns an UPDATE may touch.
create policy "call_logs_update_resolve_own_pending" on public.call_logs
for update to authenticated
using (caller_id = (select auth.uid()) and outcome is null)
with check (caller_id = (select auth.uid()) and outcome is not null);

revoke update on public.call_logs from authenticated;
grant update (outcome, notes, next_follow_up_date, resolved_at) on public.call_logs to authenticated;

-- No DELETE policy -- call history is never deleted, matching audit_logs.

-- audit_logs.action has a CHECK constraint enumerating every allowed
-- value (see 20260920060000_leads_add_delete_admin_only_policy.sql for
-- the same pattern) -- recording the new call_logged action requires
-- adding it. No other change to this table.
alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check
check (action = any (array['login','logout','lead_viewed','lead_created','lead_updated','lead_deleted','conversation_viewed','message_sent','audit_log_viewed','follow_up_created','follow_up_completed','lead_assigned','call_logged']));
