-- Blueprint V1 Section 9 (docs/BLUEPRINT_V1.md), Phase 5: Hermes sends
-- Telegram messages via the Bot API's sendMessage, which needs each
-- recipient's numeric chat_id -- a bot cannot message a user by @username
-- alone; the user must have started a chat with the bot first. The
-- existing telegram_username column (20261030160000_team_member_lifecycle.sql)
-- is only ever entered by the owner and was never actually reachable by a
-- bot on its own.
--
-- This column is written by the Telegram webhook
-- (app/api/webhooks/telegram/route.ts), the first time a staff member
-- messages the bot -- matched to their profile by telegram_username. The
-- webhook writes through the service-role (admin) client, which bypasses
-- RLS, same as every other webhook in this app (WABIS, WhatsApp) -- no new
-- RLS policy is needed: reads already go through profiles' existing
-- self-or-admin SELECT policy, unchanged by this column.
--
-- Scope, deliberately narrow: one new column, no backfill (every existing
-- profile defaults to NULL -- no staff member has linked yet), no RLS
-- change.

alter table public.profiles
  add column if not exists telegram_chat_id text;
