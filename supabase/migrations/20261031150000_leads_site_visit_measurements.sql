-- Blueprint V1 Section 7 (docs/BLUEPRINT_V1.md): the "Visit done" pipeline
-- stage is defined as entering "when measurements and photos saved" -- but
-- until now the only site-visit data this app captured was the scheduled
-- date/time (leads.site_visit_date, setSiteVisitDate()). This adds the two
-- fields staff record once the visit itself has happened.
--
-- "Photos" is a free-text reference, not a real upload, for the same reason
-- advance_proof_reference is text-only (see
-- 20261031120000_leads_advance_proof_reference.sql): no staff-upload storage
-- flow exists anywhere in this app yet -- deferred as its own future
-- increment, not built here.
--
-- Scope, deliberately narrow: two new columns, no backfill (every existing
-- lead defaults to NULL), no RLS change, no stage-transition side effect --
-- same "activity record, not a stage transition" rule setSiteVisitDate()
-- already follows.

alter table public.leads
  add column if not exists site_visit_measurements text,
  add column if not exists site_visit_photo_reference text;
