-- Documents a schema change already applied directly to the live Supabase
-- database (via the Supabase management API) before this file was created.
-- This file is a local record for version control / future migration
-- history -- running it again is a no-op if the policy already exists, but
-- it is NOT meant to be re-executed as part of committing this file; the
-- live database already reflects this change.
--
-- Purpose: adds the missing DELETE policy on `leads`. Before this, RLS had
-- SELECT/UPDATE/INSERT policies (all admin-or-owner) but no DELETE policy
-- at all, so the leads table had DELETE effectively disabled for every
-- role, admin included. This policy follows the exact existing convention
-- (private.is_admin(), wrapped in `(select ...)` per this project's RLS
-- performance rule) but is admin-only, with no owner fallback -- staff
-- must never delete a lead, even one assigned to them.
--
-- Related-data behavior on delete (verified against live FK constraints,
-- not assumed): conversations.lead_id and follow_ups.lead_id both already
-- have ON DELETE CASCADE to leads.id, and messages/automation_sessions/
-- automation_runs already cascade from conversations -- so deleting a lead
-- already correctly removes its conversations, messages, and follow-ups as
-- a consequence of existing schema, not new behavior introduced here.
-- audit_logs has no FK to leads (its target_id is polymorphic across
-- target_type), so audit history for a deleted lead is intentionally
-- preserved. leads.merged_into_id -> leads.id is ON DELETE RESTRICT, so
-- deleting a lead that other leads have been merged into will fail at the
-- database level -- the application surfaces this as a specific error
-- rather than working around it.

create policy "leads_delete_admin_only" on public.leads
for delete
to authenticated
using ((select private.is_admin()));

-- audit_logs.action has a CHECK constraint enumerating every allowed
-- value -- recording the new admin delete-lead action requires adding
-- 'lead_deleted' to it. No other change to this table.
alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check
check (action = any (array['login','logout','lead_viewed','lead_created','lead_updated','lead_deleted','conversation_viewed','message_sent','audit_log_viewed','follow_up_created','follow_up_completed','lead_assigned']));
