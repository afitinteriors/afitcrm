# Priority & Due-Date Rules

Status: STRATEGY / SPECIFICATION ONLY.

## Starting point: what's actually verified

The V6.6 audit verified, directly from source, exactly one ranking
algorithm (`todayDuty()`'s client-side sort):

```
1. Overdue items rank before non-overdue items.
2. Within the same overdue-ness, sort by due date ascending (soonest first).
```

Nothing else about V6.6's prioritization was verifiable — `closing_score`,
`eligibility_score`, and the `afit_run_sales_brain` engine were all opaque
(the RPC/view definitions were not in the source studied). This document
extends **only** the verified two-rule sort, deliberately, rather than
reconstructing V6.6's unverifiable scoring.

Notably, the current CRM's own `getUpcomingFollowUps()` already implements
this exact philosophy today (a single ascending sort on `due_date`, which
naturally surfaces overdue items first). The extension proposed here is
about **scope** (what enters the queue) and **signal richness** (what else,
beyond overdue/soonest-due, is allowed to matter) — not about replacing an
already-correct sort.

## A. MUST-HAVE priority signals

These are the signals this strategy recommends AFIT actually build on,
because each is either already provable from existing data or is a direct,
unambiguous consequence of a business rule already in force:

1. **Overdue** — a follow-up whose due date has passed. Already computable
   from `follow_ups`.
2. **Due today** — a follow-up due today specifically, distinct from
   "overdue" and from "upcoming." Already computable.
3. **No pending follow-up on an active lead** — a lead in any open stage
   (New through Negotiation) with no scheduled follow-up at all. This is
   the single most direct "zero-miss" signal and does not exist as a
   visible flag today, though it is fully derivable from existing tables
   with no schema change.
4. **Unanswered inbound conversation** — already exists today
   (`getUnansweredConversations()`, already surfaced on the Dashboard).
5. **New uncontacted lead** — already exists today (`getUncontactedLeads()`,
   status = `new`, already surfaced on the Dashboard).
6. **Quotation-stage lead with no recent activity** — a quotation sitting
   without a follow-up or response is real, at-risk pipeline value already
   captured in `quotation_amount`.

These six are "must-have" specifically because none of them require
inventing a score — they are direct, explainable facts a salesperson would
immediately understand ("this is overdue," "this lead has never been
followed up," "this quotation has gone quiet").

## B. OPTIONAL future signals

Plausible, but not recommended for a first version, because each requires a
judgment call this document is not making on AFIT's behalf:

1. **Negotiation-stage lead** — arguably deserves elevated priority simply
   by virtue of being close to Won/Lost, but whether it should outrank an
   overdue New lead is a genuine trade-off, not an obvious rule.
2. **Site readiness** (once `03`'s model exists) — a "ready now" site is a
   strong signal, but only once the readiness model itself has been
   validated; using an unvalidated readiness classification to drive
   priority would compound one unproven judgment on top of another.
3. **Expected work start date** — a lead expecting work to start soon is a
   reasonable priority booster, but needs a concrete rule (how soon is
   "soon"?) that doesn't exist yet.
4. **Job value / quotation amount** — larger deals feel intuitively more
   urgent, but rewarding value over urgency risks neglecting smaller,
   time-sensitive leads; this is exactly the kind of trade-off V6.6's
   opaque `afit_run_sales_brain` may or may not have handled well — it
   can't be verified either way, so it should not be assumed correct.

## C. Signals that must NOT be used without validation

1. **Customer buying signal / sentiment** (e.g., "very positive" visit
   response) as a numeric priority booster — a subjective, staff-entered
   judgment should not silently outrank an objective overdue/due-today
   fact until there is real evidence it improves outcomes.
2. **Any V6.6-derived numeric score** (`closing_score`, `eligibility_score`,
   `readiness_score` as originally weighted) — these are unverifiable
   internals from a different business and must not be reused as if they
   were validated for AFIT.
3. **Competitor-quote-driven urgency** (flagged as a possibility in `03`) —
   a real idea, but one that needs an explicit business rule before it's
   allowed to change ranking, not an assumed weight.

**Guiding rule**: a signal moves from category B/C to category A only when
there is a concrete, explainable, business-approved rule for how it affects
ranking — never by assigning it an arbitrary number "because it seems
important."

**[BUSINESS DECISION REQUIRED]**: if/when any signal from B is promoted, the
exact way it interacts with the overdue/soonest-due base sort (e.g., "does
it only break ties, or can it override overdue-first?") must be defined
explicitly, not left implicit.

## Due-date philosophy

The Follow-Up Brain should distinguish exactly these due-date states, and
no others, until evidenced otherwise:

| State | Meaning | Source of truth |
|---|---|---|
| **Overdue** | `follow_ups.due_date` (+`due_time` if set) has passed and the follow-up is still `pending`. | Already computable today. |
| **Due today** | Due date is today, not yet completed. | Already computable today. |
| **Upcoming** | Due date is in the future, within a defined near-term window (the current Dashboard widget already uses a 7-day window for this purpose). | Already computable today. |
| **Nurture** | No specific due date is appropriate yet — the lead is real but not time-sensitive (e.g., an "early/nurture" readiness band from `03`, or a Lost lead with a future re-engagement note). Nurture leads should be visible somewhere, but must not be forced into the overdue/due-today/upcoming queue with a fabricated date. | New concept — see guardrail below. |
| **No action required** | Won, Lost (without an explicit re-engagement), or otherwise correctly inactive. | Already the current behavior. |

### Guardrail: do not invent dates to fill the queue

A recurring risk with "the system must always show a next action" thinking
(as seen in V6.6's trigger-enforced `next_action_due_at`, which was set to
`now()` in every case observed in the audited source, regardless of whether
"immediately" was actually correct) is that it pressures the system into
assigning a plausible-looking due date to a lead that doesn't actually have
one yet — for example, a lead correctly in "Nurture" should not be given a
fake due date just so it sorts somewhere in an overdue/due-today/upcoming
list.

This strategy explicitly rejects that shortcut: **Nurture leads are a
separate, low-urgency bucket, not a due-date fiction.** A lead with no
genuinely scheduled action should be visible as "needs a decision" (does
this need a follow-up scheduled, or is it correctly dormant?) rather than
being assigned an arbitrary date to satisfy a queue-completeness rule.

[BUSINESS DECISION REQUIRED]: the exact rule for when a lead is allowed to
sit in Nurture without an active follow-up (versus being flagged as "no
pending follow-up," one of the MUST-HAVE signals above) needs a business
answer — otherwise Nurture becomes a loophole that defeats the zero-miss
intent entirely.
