-- Blueprint V1 Phase 6, increment 2 (docs/BLUEPRINT_V1.md Section 6):
-- multi-turn qualification. Increment 1 (20261101090000) only ever asked
-- ONE question (the first reply) with no memory of what was asked; this
-- adds the state to track a question-by-question conversation through to
-- a final confirm-then-save, per R-AI-001 (Section 8): "AI-filled fields
-- are saved only after customer confirmation and tagged AI until
-- verified."
--
-- Two separate pieces of state, deliberately not merged into one:
--  - pending_ai_draft_kind/pending_ai_draft_field describe a draft sitting
--    in conversations.pending_ai_draft RIGHT NOW, waiting for staff to
--    send/edit/discard (increment 1's existing column).
--  - ai_session_status/ai_pending_field/ai_collected_data describe what
--    the customer was already ASKED (sent, not just drafted) and is
--    expected to answer next. A drafted-but-unsent question has no
--    session state yet -- the session only starts once staff actually
--    sends it (lib/actions/ai-draft.ts), since "asking" means a question
--    really reached the customer.
--
-- ai_collected_data holds tentative answers ONLY until the customer
-- confirms the full summary -- at that point they're written into
-- leads.* and this column is cleared; if the customer corrects/declines
-- the summary instead, this is cleared without ever touching leads.*,
-- so an unconfirmed guess can never leak into the real record.

alter table public.conversations
  add column if not exists pending_ai_draft_kind text check (pending_ai_draft_kind in ('question', 'confirmation', 'closing')),
  add column if not exists pending_ai_draft_field text check (pending_ai_draft_field in ('location', 'estimated_sqft', 'project_type', 'expected_start_date')),
  add column if not exists ai_session_status text check (ai_session_status in ('asking', 'confirming')),
  add column if not exists ai_pending_field text check (ai_pending_field in ('location', 'estimated_sqft', 'project_type', 'expected_start_date')),
  add column if not exists ai_collected_data jsonb;
