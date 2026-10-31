-- R-WON-001 (docs/BLUEPRINT_V1.md Section 8): "Won needs an accepted
-- quotation and advance proof (photo or reference). No advance -> cannot
-- mark Won." This covers the "reference" half only -- a free-text record
-- of the advance payment (UTR / transaction id / a short note) entered by
-- staff when marking a lead Won. The "photo" half would need a new
-- Supabase Storage bucket and an upload flow that doesn't exist anywhere
-- in this app yet (the existing whatsapp-media bucket only stores media
-- that arrived THROUGH WhatsApp, not staff-uploaded files) -- deferred as
-- its own future increment, not built here.
--
-- Scope, deliberately narrow: one new column, no backfill (every existing
-- Won lead defaults to NULL -- this is not retroactive), no RLS change.

alter table public.leads
  add column if not exists advance_proof_reference text;
