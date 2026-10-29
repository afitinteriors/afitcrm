-- Settings -> Team & Permissions: the PERMISSION GRANTS half of this page
-- has been a local-state-only UI preview (lib/settings/team-permissions.ts's
-- own header comment: "no `permissions` table... exists yet... Persisting
-- permissions for real is a backend decision that needs its own explicit
-- approval before a migration runs"). This migration is that approval, for
-- the grants only.
--
-- Deliberately OUT of scope here, unchanged from before this migration:
-- creating new staff accounts ("Add member" in the UI). That flow needs
-- Supabase Auth's Admin API / an invite-email mechanism -- a genuinely
-- different, more security-sensitive piece of work than persisting a
-- checkbox grid for EXISTING real profiles, and lib/settings/
-- team-permissions.ts's own comment already flags it as needing its own
-- separate approval. TeamMemberFormModal's "Add member" form stays exactly
-- the local-only draft it already was and already says it is -- nothing
-- about it changes here.
--
-- PERMISSION_KEYS (lib/settings/team-permissions.ts) is a small, fixed,
-- developer-defined set (9 keys) -- not user-editable -- so a normalized
-- "does this grant exist" table is simpler and safer than a JSONB blob:
-- a typo'd/unknown key is rejected by the CHECK constraint at write time,
-- not silently stored and silently ignored everywhere it's read.

create table public.profile_permissions (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  permission_key text not null check (
    permission_key in (
      'leads_view_all',
      'leads_reassign',
      'leads_bulk_export',
      'conversations_view_all',
      'reports_view',
      'automation_access',
      'audit_log_view',
      'settings_manage_whatsapp',
      'settings_manage_team'
    )
  ),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles (id),
  primary key (profile_id, permission_key)
);

alter table public.profile_permissions enable row level security;
revoke all on public.profile_permissions from anon;

-- Admin manages every grant. A profile may also read its OWN grants --
-- this table is permission-set bookkeeping, not privileged secret data,
-- and a future phase that actually enforces these permissions (rather
-- than just displaying them, which is this phase's whole scope) will need
-- the signed-in user to read their own row anyway; no reason to block
-- that read now and add a second migration for it later.
create policy "profile_permissions_select_admin_or_self" on public.profile_permissions
for select to authenticated
using ((select private.is_admin()) or profile_id = (select auth.uid()));

create policy "profile_permissions_write_admin_only" on public.profile_permissions
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
