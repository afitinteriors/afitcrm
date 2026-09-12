-- Documents a schema change that was already applied directly to the live
-- Supabase database (via the Supabase management API) before this file was
-- created. This file is a local record for version control / future
-- migration history -- running it again is a no-op if the column/
-- constraints already exist, but it is NOT meant to be re-executed as part
-- of committing this file; the live database already reflects this change.
--
-- Purpose: adds a soft-retirement marker to `leads`, used by the
-- (not-yet-implemented) legacy phone duplicate merge process. A lead with
-- `merged_into_id` set has been retired in favor of the lead it points to;
-- NULL (the default, and the value on every existing row as of this
-- migration) means the lead is active and unmerged. No existing row's data
-- was changed by this migration -- it only adds a new nullable column.
--
-- ON DELETE RESTRICT: prevents deleting a lead that other leads have been
-- merged into, rather than silently cascading or leaving a dangling
-- reference.
--
-- leads_not_merged_into_self: a lead can never be recorded as merged into
-- itself.

ALTER TABLE leads
  ADD COLUMN merged_into_id uuid NULL REFERENCES leads(id) ON DELETE RESTRICT,
  ADD CONSTRAINT leads_not_merged_into_self
    CHECK (merged_into_id IS DISTINCT FROM id);
