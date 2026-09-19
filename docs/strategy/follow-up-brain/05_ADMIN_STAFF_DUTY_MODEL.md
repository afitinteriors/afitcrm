# Admin / Staff Duty Model

Status: STRATEGY / SPECIFICATION ONLY.

This document describes the intended **human experience**, not a database
design. Where a database-enforced mechanism might eventually be justified,
it is explicitly marked `[FUTURE SCHEMA DECISION]` and is not assumed.

## Staff view

The staff mobile/desktop experience should conceptually contain four
groupings. These map onto existing and near-existing data, not new tables:

- **My Duty Now** — see below. New composed view, zero schema change.
- **My Follow-Ups** — existing `follow_ups` scoped to the staff member
  (already RLS-scoped via `assigned_to_id`).
- **My Overdue** — existing `follow_ups` filtered to `due_date` in the
  past, still `pending`. Already computable.
- **My Upcoming** — existing `follow_ups` filtered to a near-term future
  window (the Dashboard's existing 7-day window is a reasonable starting
  point, not a fixed rule).

### My Duty Now

**What appears**: exactly one item — the single highest-priority Next
Required Action currently assigned to this staff member, selected by the
priority rules in `04` (overdue first, then soonest due, extended per the
MUST-HAVE signals once approved).

**Why it was selected**: shown in plain language next to the action itself
— e.g., "Overdue by 2 days" or "Due today" or "No follow-up has ever been
scheduled for this lead" — never a numeric score with no explanation. This
directly follows the V6.6 audit's finding that the one thing worth
preserving from "Do This Now" is a single, unambiguous card, not the
opaque scoring behind it.

**What information the salesperson sees**: customer name, phone, current
pipeline stage, the specific next action text (e.g., "Call to schedule
site visit"), and the reason it's the current duty.

**Available actions**: Call (`tel:` link, already the existing pattern used
elsewhere in the CRM), WhatsApp (`wa.me` link, already the existing
pattern), and "Open Lead" (navigates to the existing Lead Detail page,
which already has stage-appropriate sections via `STAGE_SECTIONS` — this
strategy does not propose a separate "duty workflow" screen that duplicates
Lead Detail).

**How completion works**: completing the underlying follow-up (already an
existing action — marking a follow-up done) or advancing the lead's stage
(already an existing action) is what completes the duty. This strategy
does **not** propose a new, separate "complete duty" action distinct from
the actions that already exist — doing so would recreate exactly the kind
of duplicated-concept risk (multiple overlapping "what did I just finish"
mechanisms) the V6.6 audit flagged.

**What outcome is captured**: whatever the existing completion action
already captures (follow-up completion, or a stage change with its
existing required fields — e.g., `job_value` for Won, `lost_reason` for
Lost). No new free-text "duty result" field is proposed; V6.6's raw
`prompt()`-based free-text completion was explicitly identified as a
pattern *not* to reuse.

**What happens after completion**: the queue recalculates (per `04`'s
existing-data-driven approach) and the next-highest-priority item becomes
the new "My Duty Now." This is deterministic application logic reacting to
already-changed data — not a database trigger (see `06`'s architectural
rule).

### Should "one active duty" be enforced at the database level?

V6.6 enforces this with a hard database constraint (`staff_activity_v5`,
one row with `completed_at IS NULL` per staff member, enforced by raising
an exception). This is a real, working mechanism in V6.6 — but it also
implies a whole additional concept (an explicit "start" action, a running
timer, a lock that must be released) that the current CRM has no
equivalent of today.

This strategy recommends treating "one clear thing to do now" as a **UX
presentation principle first**: the staff screen shows one card, because
that's what's useful to look at — not because the system prevents you from
looking at anything else. A staff member remains free to open any lead
directly; "My Duty Now" is a recommendation surface, not a lock.

`[FUTURE SCHEMA DECISION]`: if AFIT later wants to *enforce* single-tasking
(e.g., to measure real time-on-duty, or to prevent staff from
cherry-picking easy leads while ignoring the system's actual priority
pick), a database-backed active-duty mechanism similar to V6.6's would need
its own explicit approval, its own schema, and its own UX design — it is
not bundled into this strategy.

## Admin view

The admin experience is oversight, not personal task execution. It should
conceptually surface:

- **All priority actions** — the same underlying priority list as staff
  "My Duty Now"/"My Follow-Ups," unscoped by `assigned_to_id` (admin
  already sees all leads via existing RLS).
- **Overdue work** — count and list, across all staff, of overdue
  follow-ups. Already computable.
- **Unassigned leads** — leads with `assigned_to_id IS NULL`. This is a
  real, already-encountered problem (the WABIS-created lead in this
  project's own recent history was invisible to staff specifically because
  it was unassigned) and deserves explicit admin visibility.
- **Stalled leads** — leads in an open stage with no activity/follow-up for
  an extended period. [BUSINESS DECISION REQUIRED: the exact "extended
  period" threshold per stage.]
- **Pipeline at risk** — total `quotation_amount`/`job_value` sitting in
  stalled Quotation/Negotiation leads. Already computable from existing
  columns.
- **Staff workload** — count of open follow-ups/leads per staff member, to
  spot overload or under-assignment. Already computable from existing
  `assigned_to_id` data.
- **Exceptions** — leads that don't fit the normal pattern: e.g., Won
  without a follow-up history, or a lead stuck in one stage far longer
  than typical. [BUSINESS DECISION REQUIRED: exact exception rules.]
- **Zero-miss indicators** — the explicit named counters from the V6.6
  audit, adapted rather than copied: overdue actions, leads with no next
  action/follow-up at all, at-risk pipeline value, unassigned leads. Every
  one of these is computable today with no schema change.

Admin view is explicitly **not** a "duty" screen for the admin to execute
work through — it's a monitoring surface. Reassignment (already
admin-only, already RLS-backed via `assignLead()`) is the primary action an
admin takes from here, not personal task completion.
