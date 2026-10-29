-- R-CALL-002 (docs/BLUEPRINT_V1.md Blueprint V1, Section 8): "Every call
-- outcome needs a next follow-up date, except Wrong number and Lost."
-- 20261025120000_call_logs.sql only implemented the "Wrong number"
-- exemption -- "Lost" wasn't missed on purpose, it just wasn't built yet:
-- it refers to the LEAD's own current pipeline status (there is no "Lost"
-- call outcome among answered/no_answer/busy/wrong_number/not_interested),
-- so a plain CHECK on call_logs alone can't express it -- CHECK constraints
-- cannot reference another table. This replaces that CHECK with an
-- equivalent BEFORE INSERT/UPDATE trigger that adds exactly one additional
-- condition: a call_logs row for a lead whose leads.status is already
-- 'lost' is exempt from the date requirement too, the same as a
-- 'wrong_number' outcome -- there is nothing left to follow up on once a
-- lead is closed Lost.
--
-- Scope, deliberately narrow: this changes ONLY the follow-up-required
-- check. call_logs_pending_or_resolved, the unique/foreign-key constraints,
-- RLS and column grants from 20261025120000_call_logs.sql are untouched.
-- No existing row is affected (the trigger only evaluates on the write
-- path); this is additive/corrective, not a loosening of any security or
-- ownership rule.

alter table public.call_logs drop constraint call_logs_followup_required;

create or replace function private.call_logs_followup_required()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.outcome is not null
     and new.outcome <> 'wrong_number'
     and new.next_follow_up_date is null
     and not exists (
       select 1 from public.leads where id = new.lead_id and status = 'lost'
     )
  then
    raise exception 'call_logs: next_follow_up_date is required for this outcome (lead_id=%, outcome=%)', new.lead_id, new.outcome
      using errcode = '23514'; -- check_violation, matching what a CHECK constraint would have raised
  end if;
  return new;
end;
$$;

revoke all on function private.call_logs_followup_required() from public;

create or replace trigger call_logs_followup_required_trigger
  before insert or update on public.call_logs
  for each row
  execute function private.call_logs_followup_required();
