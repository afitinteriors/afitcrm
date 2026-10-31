-- R-QUOTE-002 (docs/BLUEPRINT_V1.md Section 8): "Discount above the
-- owner's limit needs owner approval in Telegram. Limit 5%, Azhar enters
-- 8% -> approval request." Telegram/Hermes do not exist yet (Phase 5,
-- unbuilt) -- this implements the approval gate itself, in-app, with the
-- owner alerted via the existing notifications/push infra (lib/rules/
-- alert.ts) instead of Telegram. A Telegram channel can be added later
-- without changing this data model.
--
-- "Discount" here is measured against the quotation's OWN version 1 --
-- this app has no catalog/list-price concept anywhere (no per-sqft price
-- table, no Settings pricing), so there is no independent "list price" to
-- discount from. Version 1 (the first quote shown to the customer) stands
-- in for it: any later version priced lower than v1 by more than the
-- configured percentage needs approval before it can be marked sent.

alter table public.quotations
  add column if not exists discount_approved_by uuid references public.profiles(id),
  add column if not exists discount_approved_at timestamptz;
