-- Blueprint V1 Phase 3 gap: R-LOST-001 ("Lost needs at least 3 logged
-- call attempts and a reason. Reasons: price, chose another, plan
-- cancelled, no response, out of area, other.") The minimum-3-call-
-- attempts part is enforced in lib/actions/leads.ts's markLeadLost() by
-- counting resolved public.call_logs rows -- no schema change needed for
-- that half.
--
-- This is the fixed-reason half, additive only: the existing
-- leads.lost_reason column (free text) already holds real historical
-- data that was never validated against Blueprint's 6-value list, so
-- retrofitting a CHECK constraint onto it could break on existing rows.
-- Instead this adds a new, separate structured column; lost_reason stays
-- exactly as it is (now used as an optional supplementary note).
alter table public.leads add column lost_reason_category text
  check (lost_reason_category = any (array['price','chose_another','plan_cancelled','no_response','out_of_area','other']));
