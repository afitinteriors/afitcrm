# AFIT Follow-Up Brain — Strategy

Status: STRATEGY / SPECIFICATION ONLY. No code, schema, RLS, WABIS, or Meta
changes are implied or authorized by this document. See
`06_IMPLEMENTATION_SCOPE_AND_GUARDRAILS.md` for what may eventually be built,
under separate explicit approval.

## Core principle

> The system should tell the salesperson what to do next.

Today, the current AFIT CRM tells a salesperson *where a lead is*
(pipeline stage) and *what sections are relevant* (`STAGE_SECTIONS`), but it
does not tell them, in one place, *what to do right now, in what order, and
why*. That is the gap this strategy addresses.

This is directly inspired by the strongest verified idea in the AFIT V6.6
audit: a single, unambiguous "Do This Now" focus — one action, one reason,
one button — rather than a stage or a list. It deliberately does **not**
adopt V6.6's scoring internals, which were unverifiable (the actual ranking
RPC, `afit_run_sales_brain`, was not present in the source studied and could
not be audited). Everything proposed here is either already provable from
the current CRM's own data, or explicitly flagged as a business decision
still to be made.

## The complete conceptual loop

```
Lead
 ↓
Pipeline Stage            (existing 8 stages — authoritative, unchanged)
 ↓
Known Facts                (existing lead fields + qualification data)
 ↓
Current Customer/Sales Signals   (derived: unanswered message, no follow-up, overdue, etc.)
 ↓
Next Required Action       (what the salesperson should do — see 02)
 ↓
Due Date                   (when it should happen — see 04)
 ↓
Priority                   (how urgently it competes with other work — see 04)
 ↓
Staff Work Queue           (how it's presented to the person doing the work — see 05)
 ↓
Completion Outcome         (what happened when they acted — structured, not free text)
 ↓
Recalculation              (the loop re-runs: outcome may change stage, facts, or signals)
```

This loop is conceptual, not a new database structure. Section 06 draws the
line between what of this loop is a UI/reporting change (no schema impact)
and what would require new data.

## Six concepts that must NOT be conflated

The AFIT V6.6 audit showed a codebase where "next action," "activity,"
"duty," "follow-up," and "priority" blurred together across multiple,
inconsistent implementations (three different "what to do now" screens with
two different sort orders). The first strategic decision for AFIT is to keep
these concepts distinct from the start:

| Concept | Definition | Current CRM equivalent today |
|---|---|---|
| **Pipeline Stage** | Where the lead sits in the fixed 8-stage sales process. One value per lead, changed deliberately by a staff/admin action. | `leads.status` |
| **Activity** | A discrete thing that happened or was logged (a call, a message, a note). A historical record, not a plan. | `messages`, conversation history, audit log entries |
| **Next Required Action** | The single, current, forward-looking instruction for what should happen next on this lead. Derived from stage + facts + signals, not a free-standing database entity of its own. | Does not exist as a first-class concept today — see 02 |
| **Follow-Up** | A concrete, scheduled task with a due date, tied to a lead, that a staff member is expected to complete. | `follow_ups` table (already exists, already optional/manual) |
| **Priority** | The relative urgency ranking used to decide what a staff member sees first when several things compete for attention. | Partially exists: `getUpcomingFollowUps()` already sorts overdue-first, soonest-due next |
| **Staff Duty** | The operating/UX framing of "the one thing you should be doing right now," as presented to a person. Not necessarily a new database concept — see 05. | Does not exist today; closest analogue is the Dashboard's `NeedsAttention` component |

**Why this separation matters:** a Pipeline Stage answers "where is this
lead," an Activity answers "what has happened," a Next Required Action
answers "what should happen next," a Follow-Up answers "when, concretely, is
that scheduled," Priority answers "which of many Next Required Actions wins
attention right now," and Staff Duty answers "how do I present the winner to
a human being." Collapsing any two of these (as V6.6's multiple overlapping
"duty" screens did) is exactly the kind of duplicated-concept risk the V6.6
audit flagged as something to avoid, not repeat.

## What this strategy deliberately does not do

- It does not add, rename, or reinterpret any of the 8 pipeline stages.
- It does not invent a scoring formula where none is evidenced — every
  numeric threshold or weight in the following documents is either derived
  from something already in the current CRM, or explicitly marked
  `[BUSINESS DECISION REQUIRED]`.
- It does not assume database triggers, a new duty table, or any specific
  schema change is needed — see the architectural rule in
  `06_IMPLEMENTATION_SCOPE_AND_GUARDRAILS.md`.
- It does not touch, or make any assumption about extending, the WABIS
  ingestion pipeline. This brain starts the moment a lead already exists in
  the CRM (see `06`, WABIS Safety note).
