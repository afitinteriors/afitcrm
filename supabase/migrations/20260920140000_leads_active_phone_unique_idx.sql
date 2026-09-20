-- NOT YET APPLIED to the live Supabase database. This file is the proposed
-- migration for the lead-creation race-condition hardening phase; it must be
-- reviewed and explicitly approved before being applied.
--
-- Problem: two concurrent webhook deliveries for a brand-new phone number can
-- both pass the application-level "is there an active lead for this phone?"
-- lookup and both INSERT, creating duplicate active leads. Nothing in the
-- database prevented it -- `leads.phone` only has a plain (non-unique) btree
-- index (leads_phone_idx); the only unique constraints are the primary key and
-- leads.wa_message_id.
--
-- Fix: a partial UNIQUE index so the database itself rejects a second ACTIVE
-- lead for the same phone, atomically, no matter how requests interleave.
-- The application inserts and treats a unique violation (SQLSTATE 23505) as
-- "another request already created it -> reuse that lead".
--
-- Why the predicate has a creation-time cutoff: as of authoring, production
-- already contains historical ACTIVE leads that share a phone (six groups).
-- A plain UNIQUE(phone) WHERE merged_into_id IS NULL cannot be created over
-- them, and this phase must not merge or delete anything. So the index only
-- covers leads created AFTER this migration runs: the cutoff is the newest
-- created_at that exists when the migration is applied, computed here (not
-- hard-coded) so the migration succeeds whatever rows exist at apply time and
-- touches none of them. Existing rows, duplicates included, are unchanged.
--
-- Predicate details (verified against the live schema, not assumed):
--   * phone            text NOT NULL   -- all writers store canonical E.164
--                                         (lib/phone.ts: createLead, updateLead,
--                                         createOrLinkLeadForConversation)
--   * merged_into_id   uuid NULL       -- NULL = active; a merged/retired lead
--                                         never blocks an active one
--   * created_at       timestamptz NULL default now() -- rows with a NULL
--                                         created_at (none exist; the app never
--                                         sets it) fall outside the index
--
-- Locking: a plain CREATE UNIQUE INDEX takes a SHARE lock on leads for the
-- duration of the build, which is milliseconds at this table size.
--
-- Rollback (fully reversible, no data touched):
--   DROP INDEX IF EXISTS public.leads_active_phone_unique_idx;
--
-- Idempotent: running it again is a no-op once the index exists.

DO $$
DECLARE
  cutoff timestamptz;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'leads_active_phone_unique_idx'
  ) THEN
    RAISE NOTICE 'leads_active_phone_unique_idx already exists; nothing to do.';
    RETURN;
  END IF;

  SELECT COALESCE(max(created_at), '-infinity'::timestamptz) INTO cutoff FROM public.leads;

  EXECUTE format(
    'CREATE UNIQUE INDEX leads_active_phone_unique_idx ON public.leads (phone) '
    'WHERE merged_into_id IS NULL AND created_at > %L',
    cutoff
  );
END $$;
