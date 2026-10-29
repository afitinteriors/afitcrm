-- Settings -> WhatsApp Numbers: this page has been a local-state-only UI
-- preview since it was built (lib/settings/whatsapp-numbers.ts's own
-- header comment: "no `whatsapp_numbers` table exists yet... Persisting
-- this for real is a backend decision that needs explicit approval before
-- a table gets created"). That approval is this migration -- the UI/UX was
-- already approved and built; this only gives it a real table to read and
-- write, with no change to its design.
--
-- Scope: WhatsApp number metadata only (label, the number itself, status,
-- purpose, which staff use it, which one is default). This does NOT touch
-- Meta/WABIS integration, does NOT create or change how outbound sends
-- pick a number (lib/whatsapp/send-message.ts), and does NOT touch the
-- live WABIS/ingest files CLAUDE.md's Live Data Safety section protects.
-- Admin-only throughout, per CLAUDE.md's "Admin-only: ... manage WhatsApp
-- configuration."

create table public.whatsapp_numbers (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(trim(label)) > 0),
  phone_number text not null check (char_length(trim(phone_number)) > 0),
  status text not null default 'connected' check (status in ('connected', 'needs_attention', 'disconnected')),
  purpose text not null default 'General' check (purpose in ('Sales', 'Support', 'General')),
  -- Empty array = "all staff can use this number" -- same convention
  -- lib/settings/whatsapp-numbers.ts's WhatsAppNumber type already
  -- documents (explicit empty array, not null, so the app never has to
  -- guess what an absent value means).
  assigned_staff_ids uuid[] not null default '{}',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one default number at a time. A partial unique index (rather than a
-- CHECK/trigger) is the standard Postgres way to enforce "at most one row
-- where this is true" -- setDefaultWhatsAppNumber() clears every other
-- row's is_default in the same statement that sets the new one, so this
-- index is never actually hit in normal operation; it exists as the DB-
-- level backstop CLAUDE.md's security/data-integrity priority calls for,
-- not just an application-level rule.
create unique index whatsapp_numbers_one_default_idx
  on public.whatsapp_numbers ((is_default))
  where (is_default);

create trigger whatsapp_numbers_set_updated_at
  before update on public.whatsapp_numbers
  for each row
  execute function private.set_updated_at();

alter table public.whatsapp_numbers enable row level security;
revoke all on public.whatsapp_numbers from anon;

-- Admin-only in every direction -- matches CLAUDE.md's "Admin-only: ...
-- manage WhatsApp configuration" and the page's own existing page-level
-- admin check (app/(app)/settings/whatsapp-numbers/page.tsx). Staff never
-- see this table at all, not even read-only; the numbers they can send
-- from are decided by conversations.phone_number_id, unrelated to this.
create policy "whatsapp_numbers_admin_only" on public.whatsapp_numbers
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
