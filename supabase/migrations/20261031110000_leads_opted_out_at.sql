-- R-MSG-002 (docs/BLUEPRINT_V1.md Section 8): "Opt-out stops all follow-up
-- and marketing messages." Section 11's data model proposes a dedicated
-- contact_preferences table keyed by customer -- the `customers` table it
-- would key off is a one-time backfill snapshot only, not the live record
-- (Blueprint V1 Decisions, 2026-10-30), so this instead adds the flag
-- directly on `leads`, the table that's actually live today. Nullable
-- timestamp (set once, on the first "stop"), not a boolean -- an opt-out
-- is an event with a "when", matching every other *_at column in this
-- schema.
--
-- Scope, deliberately narrow: one new column, no backfill (every existing
-- row defaults to NULL = not opted out), no RLS change (no new row-level
-- access pattern is introduced), no trigger.

alter table public.leads
  add column if not exists opted_out_at timestamptz;
