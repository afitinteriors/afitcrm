# Site Intelligence & Readiness — Candidate Model

Status: STRATEGY / SPECIFICATION ONLY. No table, column, or view is created
by this document. Every field below is a candidate for a future,
separately-approved schema change (see `06`).

This document reviews each field candidate from the V6.6 audit **on its own
merits for AFIT's actual business — gypsum plastering specifically** — not
by accepting the V6.6 audit's classification at face value. AFIT does not do
block work, RCC, flooring, ceiling work, or general construction; it applies
gypsum plaster to walls/ceilings that another contractor has already built.
That distinction drives several reclassifications below.

## Field-by-field review

### Block work status
- **Why it matters**: Gypsum plastering can only proceed once the wall
  structure (block/brick work) is physically complete — plastering an
  unfinished wall is not possible.
- **Decision it affects**: Whether a site visit is even worth scheduling
  yet, and whether "Measurement" or "Nurture" is the right next action.
- **Readiness**: Yes — this is a hard precondition for gypsum work, not a
  soft signal.
- **Urgency**: Yes — "block work running" implies a real, near-term future
  action (check back when complete); "not started" implies long-range
  nurture.
- **Informational only?**: No.

### Walls ready / wall moisture
- **Why it matters**: Gypsum plaster cannot be applied to wet or freshly-wet
  walls — this is the single most direct gypsum-specific readiness signal
  in the entire candidate list.
- **Decision it affects**: Whether measurement/estimate can proceed now or
  must wait for the wall to dry.
- **Readiness**: Yes — arguably the most important single readiness input
  for this specific trade.
- **Urgency**: Yes — "ready and dry" should push toward immediate action;
  "ready but wet" should generate a short, specific follow-up (check back in
  X days), not an indefinite nurture.
- **Informational only?**: No.

### Expected start
- **Why it matters**: Directly tells the salesperson how soon this could
  become real, billable work.
- **Decision it affects**: How aggressively to prioritize this lead against
  others; whether "priority follow-up" or "nurture" is the right action.
- **Readiness**: Yes.
- **Urgency**: Yes — this is one of the strongest candidates for directly
  driving due-date calculation (see `04`), not just readiness classification.
- **Informational only?**: No.

### Measurement status / approximate sqft
- **Why it matters**: A quotation cannot be produced without a real sqft
  figure; this is a hard gate on the `Site Visit → Quotation` transition.
- **Decision it affects**: Whether "Measurement" is the correct next
  action right now.
- **Readiness**: Partially — it's less about "is the customer ready to buy"
  and more about "is the deal ready to be quoted." Worth keeping distinct
  from customer-readiness signals.
- **Urgency**: Yes, once other readiness signals are positive.
- **Informational only?**: No.

### Unloading access
- **Why it matters**: Affects labor/logistics planning, not whether the
  customer is ready to buy.
- **Decision it affects**: Execution planning (post-sale), not sales
  urgency.
- **Readiness**: [BUSINESS DECISION REQUIRED — the V6.6 audit classified
  this as ESSENTIAL because V6.6 covers broader construction logistics; for
  AFIT specifically, this reads as an execution-planning fact rather than a
  sales-readiness signal. Recommend reclassifying to USEFUL/OPTIONAL unless
  AFIT's own experience says otherwise.]
- **Urgency**: No direct effect.
- **Informational only?**: Likely yes, for the sales/follow-up brain
  specifically — still useful to capture for the eventual work order, just
  not as a readiness input.

### Visit response (customer sentiment during/after the visit)
- **Why it matters**: A direct read of buying interest independent of the
  physical site.
- **Decision it affects**: Follow-up urgency and tone.
- **Readiness**: Arguably yes — a very positive response on an
  otherwise-not-fully-ready site could still justify a priority follow-up.
- **Urgency**: Yes.
- **Informational only?**: No.

### Decision maker present
- **Why it matters**: A quotation given to someone who can't approve it is
  less likely to convert quickly.
- **Decision it affects**: Whether to expect a fast decision or plan for a
  longer approval cycle.
- **Readiness**: Minor factor.
- **Urgency**: Minor — affects expected response time, not whether to act.
- **Informational only?**: Mostly informational, with a small effect on
  expected timeline.

### Estimate requested
- **Why it matters**: An explicit customer ask is one of the strongest
  buying signals available.
- **Decision it affects**: Directly determines whether "Estimate" is the
  correct next action (once measurement exists).
- **Readiness**: Yes — a direct, unambiguous customer-driven signal.
- **Urgency**: Yes, high.
- **Informational only?**: No — this should be a near-direct trigger, not
  just a score contributor.

### Major unevenness / hacking required
- **Why it matters**: Affects how much prep work (and therefore cost/time)
  is needed before plastering, and whether the quote needs adjustment.
- **Decision it affects**: Quotation complexity/pricing, not primarily
  whether to follow up.
- **Readiness**: Weak effect — a site needing more prep isn't necessarily
  less ready to buy, just more complex to quote.
- **Urgency**: No direct effect.
- **Informational only?**: Largely yes, for the sales/follow-up brain;
  matters more for accurate quoting than for prioritization.

### RCC status, project type, floor count
- **Why it matters for general construction**: These matter a great deal
  for a full-building contractor.
- **Why they matter less for AFIT specifically**: Gypsum plastering is a
  finishing trade applied regardless of whether the structure is RCC or
  block, one floor or several — these describe the building, not gypsum
  readiness.
- **Decision it affects**: Minimal for follow-up; possibly relevant for
  quoting complexity/pricing.
- **Readiness/Urgency**: No meaningful effect identified.
- **Informational only?**: Yes.

### Rate asked / competitor quote / competitor rate / budget signal
- **Why it matters**: Useful competitive/pricing intelligence.
- **Decision it affects**: Pricing strategy on the quotation, and possibly
  whether "priority follow-up" is warranted (a customer actively comparing
  quotes is time-sensitive).
- **Readiness**: Competitor activity is arguably an urgency signal (a
  customer comparing quotes now is at risk of deciding without AFIT if not
  followed up quickly), even though the V6.6 audit filed this under
  OPTIONAL.
- **Urgency**: Possibly yes — [BUSINESS DECISION REQUIRED: should an active
  competitor quote raise this lead's priority regardless of site readiness?]
- **Informational only?**: Primarily informational for pricing, with a
  possible urgency exception above.

## Revised AFIT-specific classification

| Field | V6.6 audit classification | AFIT-specific recommendation |
|---|---|---|
| Block work status | ESSENTIAL | **ESSENTIAL** (confirmed) |
| Walls ready + wall moisture | ESSENTIAL | **ESSENTIAL** (confirmed, and the single most gypsum-specific signal) |
| Expected start | ESSENTIAL | **ESSENTIAL** (confirmed) |
| Measurement status / approx sqft | ESSENTIAL | **ESSENTIAL** (confirmed) |
| Unloading access | ESSENTIAL | **REJECT for readiness / OPTIONAL for execution records** — reclassified |
| Visit response | USEFUL | **ESSENTIAL** — promoted, direct buying signal |
| Decision maker present | USEFUL | **USEFUL** (confirmed, minor) |
| Estimate requested | USEFUL | **ESSENTIAL** — promoted, near-direct action trigger |
| Major unevenness / hacking required | USEFUL | **OPTIONAL** — reclassified (quoting complexity, not readiness) |
| RCC status | OPTIONAL | **REJECT** — not relevant to a plastering-only trade |
| Project type | OPTIONAL | **OPTIONAL** (context only) |
| Floor count | OPTIONAL | **REJECT** — no identified decision it affects |
| Rate asked | OPTIONAL | **OPTIONAL** (pricing context) |
| Competitor quote/rate | OPTIONAL | **OPTIONAL**, with a flagged possible urgency exception (see above) |
| Budget signal | OPTIONAL | **OPTIONAL** (pricing context) |
| Flooring status, ceiling status, joints visible, mesh required, corner bead required (from the raw V6.6 field list, not previously carried into the audit's summary table) | Not classified in the summary audit | **REJECT** — production/execution-phase technical detail, not a sales-stage signal |

## Candidate readiness model (conceptual only)

**Candidate readiness dimensions** (each ESSENTIAL field above becomes one
input; no weight is assigned here):
1. Block work completeness
2. Wall readiness + moisture condition
3. Expected start timing
4. Measurement/estimate state
5. Direct customer buying signal (visit response + estimate requested,
   treated as a combined "customer wants this" input rather than two
   separate weighted numbers) [BUSINESS DECISION REQUIRED: whether to
   combine or keep separate]

**Candidate readiness bands** (names only — no score thresholds):

| Band | Operational meaning |
|---|---|
| **Ready now** | Every essential precondition met; the correct next action is Measurement or Estimate, immediately. |
| **Near ready** | Most preconditions met, one clear blocker (e.g., wall still drying, expected start >30 days out); next action is a short, specific, dated follow-up. |
| **Developing** | Site is real but not yet ready on multiple dimensions; next action is a longer-interval follow-up, not urgent chasing. |
| **Early / nurture** | Structure not yet at a stage where gypsum work is relevant; next action is Nurture — periodic, low-effort contact, explicitly not treated as overdue-worthy. |

**What must NOT be copied from V6.6**: the specific point weights (20 / 15 /
10 / 10 / 20 / 10 / 10 / 5) and the specific thresholds (≥80 / ≥60 / ≥40) are
V6.6-internal numbers tuned for a different, broader construction business.
They are not evidenced as correct for AFIT and are explicitly **not**
adopted here.

**[BUSINESS DECISION REQUIRED]**: the actual weight (if a numeric score is
wanted at all — a purely rule-based decision tree, as sketched in `02`'s
Site Visit branching, is a legitimate alternative that avoids inventing
weights entirely) and the exact band boundaries. This document defines the
dimensions and the operational meaning of each band; it does not assign
numbers to either, since no AFIT-specific evidence for such numbers exists
yet.
