# Pipeline → Next Action Matrix

Status: STRATEGY / SPECIFICATION ONLY.

Covers the current CRM's 8 fixed pipeline stages exactly as they exist today
(`lib/lead-stage-sections.ts`, `LEAD_STATUSES`). No new stages are proposed.
Internal actions referenced here (Measurement, Estimate, Follow-up, Priority
Follow-up, Nurture) are **not** pipeline stages — they are Next Required
Action values that can occur within a stage, matching the instruction that
these stay internal concepts.

---

## NEW

- **Purpose of stage**: A lead has just arrived (WABIS webhook, Meta Cloud
  API, or manual entry) and has not yet been contacted.
- **Normal next action**: First contact attempt (call or WhatsApp).
- **Alternative action**: If the lead has no usable phone/contact info
  (rare, but possible from a malformed source), the action is a data-quality
  check rather than a contact attempt. [BUSINESS DECISION REQUIRED: should
  this route to `Invalid` status, which already exists in the schema as a
  non-pipeline disposition, or stay in `New` with a flagged action?]
- **Conditions**: None beyond "not yet contacted."
- **Completion outcome**:
  - No answer → retry (stays in `New`, next action becomes "retry contact,"
    due date pushed forward).
  - Customer responds → move to `Contacted`.
  - Clearly not relevant (wrong number, spam, out of area) →
    [BUSINESS DECISION REQUIRED: does this map to `Lost` with a `lost_reason`,
    or to `Invalid`? The current CRM already distinguishes these two
    dispositions — this strategy does not choose between them without
    business input.]
- **What should cause recalculation**: Any inbound message on the linked
  conversation; any outbound call/contact attempt logged.
- **When no follow-up is required**: Never, while in `New` — every new lead
  should have exactly one outstanding "make first contact" action. This is
  the single clearest candidate for AFIT's own "zero-miss" guarantee (see
  `04_PRIORITY_AND_DUE_DATE_RULES.md`).

## CONTACTED

- **Purpose of stage**: First contact has happened; the lead is being
  qualified.
- **Normal next action**: Complete qualification (gather enough facts to
  decide fit — service match, area, budget signal, timeline).
- **Alternative action**: If the customer needs time before answering
  qualification questions, the action is a scheduled follow-up call rather
  than an immediate qualification attempt.
- **Conditions**: Qualification is considered complete when [BUSINESS
  DECISION REQUIRED: the current CRM has a manual "Staff assessment" score
  field on the Qualification section, but no defined completion threshold or
  required-fields rule. This strategy does not invent one.]
- **Completion outcome**: Qualified → move to `Qualified`. Not qualified /
  not a fit → [BUSINESS DECISION REQUIRED: Lost with reason, or a distinct
  "not interested" path — same open question as in `New`.]
- **What should cause recalculation**: A new inbound message; a completed
  qualification action; an explicit staff qualification note.
- **When no follow-up is required**: Never, while actively being qualified.

## QUALIFIED

- **Purpose of stage**: The lead is a real fit; the next milestone is
  getting eyes on the actual site.
- **Normal next action**: Schedule a site visit.
- **Alternative action**: If the customer is not ready to commit to a visit
  date yet, the action is a scheduled follow-up call to firm up timing,
  not a site visit booking itself.
- **Conditions**: A site visit requires a date/time the customer has agreed
  to (this already exists as `site_visit_date` on the lead).
- **Completion outcome**: Visit scheduled → move to `Site Visit`. Customer
  goes cold before scheduling → [BUSINESS DECISION REQUIRED: how long is
  "before scheduling" allowed to run before this becomes a Lost/nurture
  candidate?]
- **What should cause recalculation**: A site visit date being set; a missed
  scheduling follow-up.
- **When no follow-up is required**: Never, while unscheduled.

## SITE VISIT

- **Purpose of stage**: The physical site has been (or is about to be)
  assessed, to determine real readiness to buy and to gather measurement
  facts.
- **Normal next action**: Capture site intelligence at/after the visit (see
  `03_SITE_INTELLIGENCE_AND_READINESS.md`), then determine readiness.
- **Alternative action**: Depending on what the captured facts show, the
  next action branches into exactly one of: **Measurement** (site is ready
  enough that an accurate sqft figure is now needed), **Estimate**
  (measurement already exists, customer is asking for pricing), **Follow-up**
  (site isn't ready yet but there's a real future opportunity), or
  **Nurture** (site is early-stage / long lead time, keep warm without
  urgent chasing). These four are Next Required Action values, not stage
  changes.
- **Conditions**: The branching above depends on the readiness
  classification defined in `03`. Until that classification exists, this
  branching cannot be automated — [BUSINESS DECISION REQUIRED: until then,
  which of the four should be the default action when a site visit is
  logged with no structured facts?]
- **Completion outcome**: Measurement finalized and quotation-ready → move
  to `Quotation`. Site clearly not viable / customer withdraws →
  [BUSINESS DECISION REQUIRED: Lost with reason].
- **What should cause recalculation**: New site-visit facts being recorded;
  a measurement being finalized.
- **When no follow-up is required**: Never, while the visit hasn't produced
  a quotation-ready outcome yet.

## QUOTATION

- **Purpose of stage**: A commercial number has been given to the customer;
  the goal is to move them toward a decision.
- **Normal next action**: Send/confirm the quotation was received, then
  follow up for a response.
- **Alternative action**: If the customer has questions about the
  quotation itself (scope, pricing breakdown), the action is "clarify
  quotation" rather than a plain follow-up. If the customer raises a
  specific concern, the action is "identify objection," which typically
  precedes/overlaps with moving to `Negotiation`.
- **Conditions**: A quotation amount must exist (`quotation_amount` already
  on the lead) before this stage's actions make sense.
- **Completion outcome**: Customer accepts terms and price without further
  back-and-forth → move to `Negotiation` (or directly toward `Won`, per
  existing `WON_REACHABLE_FROM` rule which already allows Won from
  `quotation`). Customer pushes back on price/terms → move to
  `Negotiation`. Customer goes cold → stays in `Quotation` with an overdue
  follow-up (a strong "pipeline at risk" signal — see `04`).
- **What should cause recalculation**: Customer response of any kind
  (message, call outcome); quotation amount being updated.
- **When no follow-up is required**: Never, while the quotation is
  outstanding and the lead isn't Won/Lost.

## NEGOTIATION

- **Purpose of stage**: Active back-and-forth on price/terms/objections
  toward a decision.
- **Normal next action**: Objection handling / commercial discussion.
- **Alternative action**: If the customer has functionally agreed and is
  just confirming logistics, the action shifts to a closing action (moving
  toward `Won`).
- **Conditions**: None beyond being in active discussion.
- **Completion outcome**: Customer agrees → `Won` (requires `job_value`,
  already enforced server-side by `markLeadWon()` — this strategy does not
  propose changing that guard). Customer definitively declines → `Lost`
  (requires `lost_reason`, already enforced by `markLeadLost()`).
- **What should cause recalculation**: Every negotiation exchange; a
  customer signal of any kind (this is the stage where a structured
  "customer signal" capture, inspired by V6.6's negotiation-signal concept,
  would matter most — see `04` for how signals should/shouldn't affect
  priority).
- **When no follow-up is required**: Never, while negotiation is active and
  unresolved.

## WON

- **Purpose of stage**: The deal is closed. This is a terminal, successful
  state within the sales pipeline.
- **Normal next action**: No normal sales follow-up. `STAGE_SECTIONS`
  already reflects this — Won shows only the `commercial` record, no
  qualification/site-visit/quotation sections, and no "Mark Won" action
  (correctly, since it's already Won).
- **Alternative action**: None within the sales pipeline. Any post-Won
  workflow (agreements, production handover, invoicing) is explicitly out
  of scope for this Follow-Up Brain — see `06`, and the earlier V6.6 audit's
  conclusion that V6.6's agreement/production/finance layer should not be
  ported.
- **Conditions**: N/A.
- **Completion outcome**: N/A — this is a completed outcome, not a stage
  awaiting one.
- **What should cause recalculation**: N/A — Won leads should not
  re-enter the Follow-Up Brain's active queue. (The current CRM already
  guards against reopening closed leads — this strategy does not propose
  changing that.)
- **When no follow-up is required**: Always — Won leads should never
  generate a sales follow-up action.

## LOST

- **Purpose of stage**: The deal did not close. A terminal, unsuccessful
  state, with a required `lost_reason`.
- **Normal next action**: No active sales follow-up.
- **Alternative action**: A deliberate, explicit re-engagement action may
  be created later (e.g., "check back in 6 months" for a `future_project`
  or `budget` reason) — but this must be an intentional, explicit action a
  staff/admin member creates, never an automatic system-generated one.
  [BUSINESS DECISION REQUIRED: should certain `lost_reason` values (e.g.,
  "not now," "budget," "future project") automatically suggest a
  re-engagement follow-up, or should this always require a human decision?]
- **Conditions**: A `lost_reason` already exists (enforced).
- **Completion outcome**: N/A unless a re-engagement is explicitly created.
- **What should cause recalculation**: Only an explicit staff/admin action
  to re-engage — never automatically.
- **When no follow-up is required**: Always, by default — Lost leads
  should never generate a sales follow-up action unless a human explicitly
  creates one.

---

## Summary table

| Stage | Default Next Required Action | Follow-up ever required? |
|---|---|---|
| New | First contact | Always (until contacted) |
| Contacted | Complete qualification | Always (until qualified/disqualified) |
| Qualified | Schedule site visit | Always (until scheduled) |
| Site Visit | Capture facts → Measurement / Estimate / Follow-up / Nurture | Always (until quotation-ready) |
| Quotation | Send/confirm quotation, follow up for response | Always (until resolved) |
| Negotiation | Objection handling / closing action | Always (until Won/Lost) |
| Won | None | Never |
| Lost | None (unless explicit re-engagement) | Never by default |
