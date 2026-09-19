# Implementation Scope & Guardrails

Status: STRATEGY / SPECIFICATION ONLY. No phase below is authorized to
start by this document. Each phase requires its own explicit go-ahead,
per this project's standing one-phase-at-a-time workflow.

## Architectural rule (binding on every phase below)

- **Do not introduce database triggers simply because V6.6 used triggers.**
  This project's existing architecture intentionally keeps business logic
  in application/server-action code, not in the database. Every
  recalculation described in this strategy (queue re-sorting, next-action
  derivation, zero-miss counters) should be deterministic application/query
  logic, computed on read or on the existing write paths — not a trigger
  fired by Postgres.
- **A database-level constraint is only justified by a demonstrated need**,
  not by precedent from a different codebase. The one candidate flagged in
  `05` (enforced single-active-duty) is explicitly deferred, not assumed.
- **RLS is never weakened.** Every phase below must work within the
  existing `admin-or-owner` RLS shape (`is_admin() OR assigned_to_id =
  auth.uid()`, and equivalents on related tables) — new views/queries
  should compose with existing RLS, not bypass or loosen it.

## WABIS safety (binding on every phase below)

The Follow-Up Brain begins **after** a lead already exists in the CRM. No
phase below touches, assumes changes to, or depends on changes to: Meta ads
configuration, the WhatsApp Cloud API integration, WABIS (Flow 981027 or
any other flow), the WABIS webhook route, its secret, or its ingestion
logic. If a future phase ever appears to require a WABIS-side change, that
is out of this strategy's scope and needs its own separate, explicit
discussion.

---

## Phase A — UI-only / existing-data improvements

- **Purpose**: Prove the core "tell the salesperson what to do next"
  concept using only data that already exists, with zero schema risk.
- **Expected user outcome**: A staff member sees one clear "My Duty Now"
  card (per `05`) and explicit zero-miss counters on their Dashboard,
  instead of three disconnected lists.
- **Existing data used**: `follow_ups`, `getUncontactedLeads()`,
  `getUnansweredConversations()`, `leads.assigned_to_id`.
- **Possible schema impact**: None.
- **Risks**: Low — presentation-layer only. Main risk is scope creep into
  Phase B's decision-engine territory before the simple version is proven.
- **Testing requirements**: Standard Playwright verification at all
  required viewports, both Admin and Staff roles, confirming the new
  surface respects existing RLS (a staff member never sees another staff
  member's unassigned-to-them items).

## Phase B — Follow-up decision engine

- **Purpose**: Formalize the priority rules from `04` (MUST-HAVE signals)
  into a real, queryable ranking, beyond the simple due-date sort.
- **Expected user outcome**: The unified queue reliably surfaces "no
  follow-up exists" leads alongside overdue/due-today ones, correctly
  ordered.
- **Existing data used**: Same as Phase A, combined into one query/view
  rather than three separate ones.
- **Possible schema impact**: None expected, if kept to MUST-HAVE signals
  only (§04A). Would change if any OPTIONAL/validation-pending signal
  (§04B/C) is promoted without first building the data it needs.
- **Risks**: Getting the "no follow-up exists" detection wrong could
  either flood the queue with false positives (leads that are correctly
  dormant) or miss real gaps — needs careful definition of "active lead"
  per stage (informed by `02`'s per-stage "when no follow-up is required"
  column).
- **Testing requirements**: Unit-level correctness tests for the ranking
  query against known fixture data (overdue, due-today, no-follow-up,
  Won/Lost exclusion cases), plus live Playwright verification.

## Phase C — Site intelligence

- **Purpose**: Capture the ESSENTIAL/USEFUL facts identified in `03` at
  site-visit time.
- **Expected user outcome**: Structured facts replace free-text notes for
  the specific fields that matter (block work, wall readiness/moisture,
  expected start, measurement state, visit response, estimate requested).
- **Existing data used**: The existing Site Visit UI-level view over lead
  columns.
- **Possible schema impact**: **Yes, likely** — the ESSENTIAL/USEFUL field
  set from `03` does not fit cleanly into existing `leads` columns; this
  phase would need new columns and/or a new table, requiring explicit
  schema approval before any work starts (per this project's standing
  rule).
- **Risks**: Scope creep toward OPTIONAL/REJECT fields; capturing fields
  that don't end up driving any real decision, adding data-entry burden
  without follow-up-brain value.
- **Testing requirements**: Confirm new fields don't leak into RLS-unsafe
  contexts; confirm the UI stays usable at mobile viewports per this
  project's standard testing rules.

## Phase D — Readiness

- **Purpose**: Turn Phase C's captured facts into the readiness
  classification sketched in `03` (bands, not a copied score).
- **Expected user outcome**: Site Visit leads are classified into a
  readiness band that visibly drives the Measurement/Estimate/Follow-up/
  Nurture branching from `02`.
- **Existing data used**: Phase C's new site-intelligence data.
- **Possible schema impact**: Depends on whether a stored score/band is
  wanted versus a computed-on-read classification; a computed approach
  needs no new column, a stored one does. [BUSINESS DECISION REQUIRED,
  deferred to this phase specifically.]
- **Risks**: The single largest risk in this entire strategy — an unproven
  formula presented with false confidence. This phase must not proceed
  without the `[BUSINESS DECISION REQUIRED]` items in `03` being resolved
  first, and should be validated against real outcomes before being
  trusted to drive priority (per `04`'s "must not be used without
  validation" guidance).
- **Testing requirements**: Beyond standard UI testing, this phase needs a
  validation period against real sales outcomes before its output is
  wired into Phase B's priority ranking.

## Phase E — Advanced staff duty

- **Purpose**: Only if Phase A's simple "My Duty Now" card proves
  insufficient — e.g., if there's a real, demonstrated need to enforce
  single-tasking (the `[FUTURE SCHEMA DECISION]` flagged in `05`).
- **Expected user outcome**: Whatever specific problem prompted this phase
  — not defined speculatively here.
- **Existing data used**: N/A until scoped.
- **Possible schema impact**: Yes — a new duty/activity-lock table,
  mirroring the concept (not the exact schema) of V6.6's
  `staff_activity_v5`.
- **Risks**: Building this without a demonstrated need is the exact
  "porting V6.6's architecture because V6.6 had it" anti-pattern this
  whole strategy is designed to avoid.
- **Testing requirements**: Full concurrency testing (two staff, or one
  staff on two devices, attempting to start duties simultaneously) if
  built, given this project's prior real experience with concurrency bugs
  in the automation-session system.

## Phase F — Reporting / zero-miss

- **Purpose**: Surface the admin-facing zero-miss indicators from `05` as
  a proper reporting view, beyond the Phase A dashboard counters.
- **Expected user outcome**: Admin can see, at a glance, overdue work,
  unassigned leads, stalled leads, pipeline at risk, and staff workload
  across the whole team.
- **Existing data used**: Same underlying queries as Phase A/B, aggregated
  without the staff-level RLS narrowing (admin already sees everything).
- **Possible schema impact**: None expected.
- **Risks**: Low — mostly a reporting/aggregation exercise over data
  already proven correct in earlier phases.
- **Testing requirements**: Confirm admin-only access (staff must not see
  team-wide reporting, per existing permission rules); standard viewport
  testing.

---

## No-schema-change opportunities (can start whenever approved)

- Unified attention queue (Phase A/B)
- "My Duty Now" single-focus card (Phase A)
- Explicit zero-miss counters (Phase A/F)
- "No follow-up exists" detection (Phase B)
- Overdue-first ordering extended beyond `follow_ups` alone (Phase B)
- Quotation/Negotiation "attention" view using existing `quotation_amount`/
  `job_value` (Phase A/B)
- Staff-specific work queue using existing `assigned_to_id` + RLS (Phase A)
- Admin unassigned-leads / workload views (Phase F)

## Features that definitely require schema approval

- Structured site-intelligence fields (Phase C)
- Any stored readiness score/band (Phase D, if a stored approach is chosen)
- A database-enforced single-active-duty mechanism (Phase E, only if
  demonstrated necessary)

Every item in this second list requires the standing project rule to be
followed: inspect current schema, confirm the existing schema genuinely
cannot support the requirement, get explicit approval, and only then
migrate — never speculatively.
