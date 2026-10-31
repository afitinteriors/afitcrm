-- Blueprint V1 Phase 1: team member lifecycle.
--
-- Three pieces, all additive:
-- 1. `telegram_username` + `active` columns on profiles (Blueprint
--    Section 2: "Owner adds the member's Telegram username so Hermes can
--    talk to them" / "A member who leaves is deactivated, never deleted").
-- 2. profiles previously had ONLY a SELECT policy (self-or-admin) -- no
--    INSERT/UPDATE policy existed at all, so every profiles row to date
--    was created by migration/seed SQL, never by the app. Real team-member
--    management (invite, deactivate, edit Telegram username) needs the app
--    to write this table for the first time, so this adds admin-only
--    INSERT/UPDATE policies -- RLS stays the real security boundary
--    (CLAUDE.md "Auth / RLS / Security"), not a service-role bypass, for
--    every write except the Supabase Auth user creation itself (that part
--    is inherently Admin API-only and happens in
--    lib/actions/team-permissions.ts via lib/supabase/admin.ts).
-- 3. Widen audit_logs' action/target_type CHECK constraints (same pattern
--    as 20261029150000_audit_logs_setting_action.sql) to record the three
--    new team-member events against a real `profile` target.

alter table public.profiles add column telegram_username text;
alter table public.profiles add column active boolean not null default true;

create policy "profiles_insert_admin_only"
  on public.profiles
  for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "profiles_update_admin_only"
  on public.profiles
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check
check (action = any (array['login','logout','lead_viewed','lead_created','lead_updated','lead_deleted','conversation_viewed','message_sent','audit_log_viewed','follow_up_created','follow_up_completed','lead_assigned','call_logged','setting_changed','team_member_invited','team_member_deactivated','team_member_reactivated']));

alter table public.audit_logs drop constraint audit_logs_target_type_check;
alter table public.audit_logs add constraint audit_logs_target_type_check
check (target_type = any (array['lead','conversation','message','follow_up','setting','profile']));
