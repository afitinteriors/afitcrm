-- Applied via Supabase MCP apply_migration; this file is the repo record,
-- mirroring the convention established by
-- 20260920140000_leads_active_phone_unique_idx.sql.
--
-- Problem: two concurrent/duplicate inbound WhatsApp webhook deliveries for
-- the same contact can both pass findOrCreateConversation()'s
-- "does a conversation exist for this (wa_id, phone_number_id)?" lookup and
-- both INSERT, creating a duplicate conversation row. Confirmed in
-- production (read-only inspection, 2026-10-07): ~90 wa_id/phone_number_id
-- pairs each have exactly 2 conversation rows, created as little as <1ms
-- apart, both linked to the same lead (leads.phone's own unique index
-- already prevents a duplicate LEAD -- see the migration above), with one
-- of the pair always left with 0 messages (an orphan). Nothing in the
-- database prevented the duplicate conversation itself -- conversations
-- only has conversations_wa_id_idx, a plain (non-unique) btree index.
--
-- Fix: a partial UNIQUE index on (wa_id, phone_number_id) so the database
-- itself rejects a second conversation for the same contact on the same
-- WhatsApp number, atomically, no matter how requests interleave. The
-- application (lib/whatsapp/ingest.ts's findOrCreateConversation) inserts
-- and treats a unique violation (SQLSTATE 23505) as "another request
-- already created it -> look it up and reuse it", the same pattern already
-- proven for the leads race.
--
-- Why (wa_id, phone_number_id) and not wa_id alone: phone_number_id is
-- deliberately part of the key architecture-wide (CLAUDE.md: "foundation
-- for future multi-number support") -- the same customer messaging two
-- different business WhatsApp numbers is two separate conversations by
-- design. Confirmed every existing duplicate pair shares the same
-- phone_number_id, so this predicate doesn't just happen to work by
-- accident at today's single-number scale.
--
-- Why the predicate has a creation-time cutoff: as of authoring, production
-- already contains ~90 pairs of duplicate conversations (same wa_id and
-- phone_number_id). A plain UNIQUE(wa_id, phone_number_id) cannot be
-- created over them, and this phase must not merge or delete anything. So
-- the index only covers conversations created AFTER this migration runs:
-- the cutoff is the newest created_at that exists when the migration is
-- applied, computed here (not hard-coded) so the migration succeeds
-- whatever rows exist at apply time and touches none of them. Existing
-- rows, duplicates included, are unchanged.
--
-- Predicate details (verified against the live schema, not assumed):
--   * wa_id            text NOT NULL
--   * phone_number_id  text NOT NULL
--   * created_at       timestamptz NOT NULL default now()
--
-- Locking: a plain CREATE UNIQUE INDEX takes a SHARE lock on conversations
-- for the duration of the build, which is milliseconds at this table size.
--
-- Rollback (fully reversible, no data touched):
--   DROP INDEX IF EXISTS public.conversations_wa_phone_unique_idx;
--
-- Idempotent: running it again is a no-op once the index exists.

DO $$
DECLARE
  cutoff timestamptz;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'conversations_wa_phone_unique_idx'
  ) THEN
    RAISE NOTICE 'conversations_wa_phone_unique_idx already exists; nothing to do.';
    RETURN;
  END IF;

  SELECT COALESCE(max(created_at), '-infinity'::timestamptz) INTO cutoff FROM public.conversations;

  EXECUTE format(
    'CREATE UNIQUE INDEX conversations_wa_phone_unique_idx ON public.conversations (wa_id, phone_number_id) '
    'WHERE created_at > %L',
    cutoff
  );
END $$;
