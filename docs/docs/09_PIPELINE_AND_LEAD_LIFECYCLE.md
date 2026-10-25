# 09 — Pipeline and Lead Lifecycle

This is the document everything else hangs off. Read it before the database schema or the automation rules.

## Structure: customer → deal → sales pipeline → work pipeline

```
Customer (one per phone number)
 ├─ Gypsum enquiry (deal)
 │    ├─ Sales pipeline (New → Won)
 │    └─ Work pipeline (Scheduled → Closed)   [created automatically on Won]
 └─ Interior enquiry (deal)
      ├─ Sales pipeline (New → Won)
      └─ Work pipeline (Production → Closed)
```

- **Customer** = one record per normalized phone number. Repeat enquiries from the same number attach to the same customer, never create a duplicate.
- **Deal** = one (customer, service) pair. A customer can have a Gypsum deal and an Interior deal simultaneously, each independent. A customer cannot have two *simultaneously active* deals for the *same* service — a second enquiry for the same service while one is open reopens/links the existing deal instead of creating a parallel one.
- Only a **Won** sales-pipeline deal creates a work-pipeline project, exactly once (idempotent on retry).

## Gypsum plastering — sales pipeline stages

| Stage | Meaning | Who/what moves it | Time limit | Win % |
|---|---|---|---|---|
| New | Lead just captured | Automatic | 15 min | 5% |
| AI Talking | AI agent is gathering details | Automatic | 24 hr | 10% |
| Contacted | Staff spoke with customer | Call outcome popup | — | 15% |
| Qualified | Location, approx area, type, timeline known | Automatic once fields present | 2 days to visit | 20% |
| Visit Scheduled | Site visit date/time fixed | Staff or AI booking | Visit date | 35% |
| Visit Done | Visit + measurement completed | Staff (photo + sqft logged) | 2 days to quote | 50% |
| Quote Sent | Quotation PDF sent | Automatic on send | Follow-up at 1, 3, 7 days | 60% |
| Negotiation | Customer discussing price/terms | Automatic on reply after quote | 7 days | 75% |
| **Won** | Advance received, confirmed | Staff, with evidence | → work pipeline | 100% |

**Side states (not part of the linear flow):**
- **Nurture / Later** — customer asked to be contacted later; re-enters pipeline automatically on the review date.
- **Lost** — requires a reason (price, timing, competitor, no response, scope mismatch, cancelled, invalid, other). See `R-ACCT-05` for the 3-attempt rule before Lost is allowed without override.
- **Junk** — spam, wrong number, irrelevant enquiry. Excluded from conversion-rate reporting but retained for audit.

## Gypsum — work pipeline stages (after Won)

Scheduled → In Progress (daily photo updates) → Completed (final photo + customer OK) → Payment Pending (balance due) → Closed (full paid → triggers automatic review/referral WhatsApp request).

## Interior design/production — sales pipeline stages

New → AI Talking → Contacted → Requirement Taken → Design Meeting → Design/3D → Quote Sent → Negotiation → Won.

## Interior — work pipeline stages

Production → Ready for Dispatch → Installation → Handover → Payment Pending → Closed → Warranty.

**Build note:** implement the Interior pipeline's data model (stage enum, tables) in the same phase as Gypsum so no later migration is needed, but the Interior-specific screens/AI question set can ship in a later implementation phase per `docs/18_IMPLEMENTATION_PLAN.md`.

## Stage rules every stage must declare

For every stage in `automation_rules` / stage config:

| Setting | Example (Visit Scheduled) |
|---|---|
| Entry rule | Visit date+time required before entering this stage |
| Auto action on entry | Confirmation WhatsApp to customer + reminder 1 day before |
| Allowed owner roles | `leads.call` holder assigned to the deal |
| Time limit | If still in this stage past visit date with no outcome → overdue alert |
| Win probability % | Used for pipeline-value forecasting on the dashboard |

Stage names, time limits, win %, and auto-actions are editable from Settings by `settings.manage` holders. Adding/removing a stage is restricted to `team.manage`/owner, since it affects every report.

## Lead → deal state machine (server-enforced)

```
New → Contact Attempted → Contacted → Qualified → Visit Scheduled → Visit Completed
   → Estimate → Quote Sent → Negotiation → Won | Lost | On Hold
```

- Invalid transitions are rejected server-side (e.g. cannot jump New → Won).
- Every stage change is recorded with actor, timestamp, previous stage, next stage, and reason (where applicable) — see `lead_activities` / `deal_stage_history` in `docs/06_DATABASE_SCHEMA.md`.
- A stage change to **Won** requires a linked accepted quotation or an explicit, audited owner override reason. This is the single most important invariant in the system — do not let a dropdown change alone create a Won deal.

## The call outcome requirement (R-ACCT-02, the core accountability mechanic)

1. Staff presses **Call** on a lead from inside the CRM (not their phone's native dialer directly — see `docs/10` for the cloud-telephony option vs. simple call-log mode).
2. When the call ends, a **compulsory outcome sheet** opens (see the published `CallOutcome.dc.html` mockup): Answered / No answer / Busy / Wrong number / Not interested — plus a **required** next-follow-up selection (Tomorrow / In 3 days / Site visit date picker) and an optional note.
3. The sheet cannot be dismissed, backgrounded, or navigated away from without a selection on both the outcome and the next action. This is enforced in the UI (no close button until valid) **and** server-side (the call log row stays in a `pending_outcome` state that blocks the lead showing as "handled" on any dashboard/report until resolved).
4. If outcome = Lost-leaning ("Not interested"), the Lost flow (`R-ACCT-04`) is offered but not forced — staff can still schedule a nurture follow-up.

## Daily/15-minute escalation flow

1. Lead enters **New** → 15-minute timer starts.
2. If no call is logged within 15 minutes: lead turns red/overdue on Azhar's "Today" list, Azhar gets a push + Telegram nudge (`docs/13`), and the owner's dashboard shows it in the "untouched" banner.
3. If still untouched after the configured holding period (default: immediately on breach), an automated WhatsApp holding template goes to the customer (not a full AI conversation — a short "we got your message, calling you shortly" template) so the business doesn't look unresponsive even when staff is slow. This requires an approved WhatsApp template (`docs/10`).
4. Every overdue lead rolls up into the owner's nightly Telegram report (`docs/13`) and the dashboard's "leads by source/service" funnel (`docs/15`).

## Reactivation / lost-lead recovery

- Nurture leads return to the active pipeline automatically on their review date — no manual re-entry.
- Lost leads can be reactivated only by a new inbound interaction from the customer, or an explicit scheduled review the owner sets.
- Conversion rates by source/service/score-band/loss-reason are tracked for the dashboard (`docs/15`).
