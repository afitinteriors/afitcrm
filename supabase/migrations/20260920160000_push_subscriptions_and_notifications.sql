-- Phase A of push notifications: subscription storage + notification
-- history. NOT a queue -- nothing here schedules or sends anything.
--
-- push_subscriptions: one row per browser/device Web Push subscription.
-- The endpoint is a capability URL, so it is unique and only ever readable
-- by its owner. Owner rows are managed through the user's own session
-- (RLS); the one server-side exception is re-pointing an endpoint from a
-- previous user to the current one when a browser is shared, which is done
-- with the service-role client after the caller proves they hold the
-- subscription (see lib/actions/push.ts).
--
-- notifications: per-user history/state, kept separate from delivery.
-- Rows are created by trusted server code only (service role, which
-- bypasses RLS); users can read their own and mark them read.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  revoked_at timestamptz,
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  entity_type text,
  entity_id uuid,
  title text not null,
  body text not null default '',
  route text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  constraint notifications_user_dedupe_key unique (user_id, dedupe_key)
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;

-- Never reachable without a session.
revoke all on public.push_subscriptions from anon;
revoke all on public.notifications from anon;

-- push_subscriptions: owner-only (auth.uid() wrapped in (select ...) per
-- the project's RLS performance rule). No admin override: an admin has no
-- reason to read another user's push endpoint.
create policy "push_subscriptions_select_own" on public.push_subscriptions
for select to authenticated
using (user_id = (select auth.uid()));

create policy "push_subscriptions_insert_own" on public.push_subscriptions
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "push_subscriptions_update_own" on public.push_subscriptions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "push_subscriptions_delete_own" on public.push_subscriptions
for delete to authenticated
using (user_id = (select auth.uid()));

-- notifications: owner can read their own and mark them read. No INSERT or
-- DELETE policy for users -- creation is server-side only. The column grant
-- below limits what an owner UPDATE can touch to read_at.
create policy "notifications_select_own" on public.notifications
for select to authenticated
using (user_id = (select auth.uid()));

create policy "notifications_update_own" on public.notifications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
