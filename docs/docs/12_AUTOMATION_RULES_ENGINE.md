# 12 — Automation Rules Engine

This is the backbone that makes "fully automatic" actually mean something safe. Build and test this layer **before** enabling AI auto-send (`docs/11`) — the business must run correctly on rules alone, with AI entirely off.

## The three layers

1. **Rules Engine (deterministic)** — evaluates explicit conditions: follow-up due dates, required fields, score weights, approval thresholds, valid state transitions (`docs/09`). Same inputs → same output, always, with no model call involved.
2. **Workflow Engine (deterministic orchestration)** — executes multi-step processes, schedules/retries tasks, records outcomes, connects modules. Every workflow is resumable and idempotent — retrying from a failed step never creates a duplicate lead, task, project or message.
3. **AI Agent (assistive, bounded)** — see `docs/11`. Suggests; does not decide alone.

**The Rules Engine and Workflow Engine must keep working when the AI model or WhatsApp provider is unavailable.** This is the single most important architectural constraint in this document.

## Workflow A — Lead intake

Trigger: lead created via webhook, manual entry, or connector.
1. Validate required fields; normalize phone/email.
2. Find-or-create customer (R-LEAD-04 duplicate warning, never silent auto-merge).
3. Record source, timestamp, consent, attribution (`ad_referrals` if applicable).
4. Resolve service (`docs/11` §Service detection); if unresolved, flag "service unclear."
5. Assign owner (today: always Azhar; configurable round-robin later).
6. Calculate an explainable lead score (see §Lead scoring below).
7. Create the 15-minute qualification task/timer.
8. Notify assigned owner (push + Telegram, `docs/13`).
9. Idempotent: a duplicated webhook delivery must not create a second lead, task, or notification.

## Workflow B — Qualification and site visit

Trigger: deal reaches Qualified, or staff/AI schedules a visit.
1. Check required fields (location, approx area, type, timeline); if missing, create a question list rather than inventing values.
2. Offer visit slots from the real staff calendar if integrated; otherwise staff picks manually.
3. Assign staff by service-area/availability rule.
4. Send confirmation/reminder only through an enabled, permitted channel and template.
5. Capture visit outcome, measurements, photos, next action.
6. Trigger estimate/quotation preparation only once required inputs exist.

## Workflow C — Estimate and quotation

1. Select the approved rate-card/calculation template.
2. Generate a draft from measurements.
3. Calculate price/margin/tax per documented settings only (never an ad-hoc formula).
4. Flag missing quantities/units/terms, and any discount above the permission threshold.
5. Route to the authorized approver when a threshold is crossed.
6. Generate the customer-facing PDF after approval; internal cost/margin fields are never included.
7. Record sent time and version; create follow-up tasks per the 1/3/7-day cadence.
8. A changed quote creates a new version — a sent quotation is never mutated in place.

## Workflow D — Customer replies and objections

1. Save the inbound message and timestamp.
2. AI proposes intent/objection classification and a summary; fields are marked unverified until a human accepts them.
3. Suggest a response draft and next action.
4. Pause scheduled follow-ups while a meaningful reply awaits human review (unless it's a safe pre-approved auto-reply case).
5. Staff approves/edits the response; outcome is recorded.
6. Re-score the lead using only verified signal updates.

## Workflow E — Won deal conversion

1. Verify acceptance evidence, quotation version, final scope, terms.
2. Check advance/start conditions; if not met, create a "Ready to Start" checklist instead of falsely marking the project Active.
3. Link (never duplicate) the customer.
4. Create the work-pipeline project tied to the accepted quotation version, exactly once (idempotency key).
5. Notify operations/finance per permissions.
6. Mark conversion complete only once every required record is committed.
7. A failed step resumes from the last committed step on retry — never creates a duplicate customer link, project, or work order.

## Workflow F — Unresponsive/lost-lead recovery

1. Check follow-up attempts, consent, and last meaningful interaction.
2. Stop immediately if opted out.
3. Use approved templates with a capped attempt count.
4. No reply after the sequence → Nurture/On Hold with a future review date (`docs/09`).
5. Lost requires a reason; reactivation only via a new inbound message or an owner-scheduled review.
6. Track conversion rates by source/service/score-band/loss-reason for the dashboard.

## Lead scoring (explainable, not a black box)

A configurable, versioned 100-point scoring policy:

| Signal | Max points |
|---|---:|
| Project fit / stage completeness | 20 |
| Buying temperature (urgency, explicit interest) | 10 |
| Recent activity | 10 |
| Customer response signal | 15 |
| Estimate/negotiation signal | 10 |
| Site readiness | 20 |
| Budget/commercial fit | 15 |

- Store score, band, policy version, reasons, scored_at (`lead_score_history`).
- Bands (default, configurable): 75–100 High, 45–74 Medium, 0–44 Low.
- Missing data is "unknown," never a negative signal by default. Never infer sensitive personal traits (income, religion, caste, health) to score a lead.
- Score prioritizes attention; it never auto-rejects a lead or guarantees conversion.
- Recalculated when a meaningful field changes; history retained for explainability. Staff corrections to extracted fields are audited and the score recalculated.

## Automation Rules admin UI (Settings → Automation Rules) — must be the visual builder in `docs/00_NO_CODE_REQUIREMENT.md`

This is not a settings form — it is a **drag-and-drop workflow canvas** (Zapier/n8n-style, simplified), per `docs/00` §1. The underlying rule/workflow data model below is what the canvas reads and writes; the owner never sees it directly.

- Rule name, purpose, enabled/disabled, priority/order — set from the canvas's rule header, not a separate admin table.
- Trigger block + condition blocks + action blocks, dragged onto the canvas and connected (validated fields/operators only — never arbitrary SQL or code; the canvas's block palette *is* the allow-list).
- Execution mode per workflow: automatic / draft-for-review / manual — a toggle on the canvas.
- Delay/schedule, permitted business hours, retry policy, idempotency key strategy — set inside each action block's detail panel.
- Failure notification + escalation owner — a block setting.
- **"Test with a sample lead"** — dry-run mode with a sample record preview, runs the whole chain and shows each block's result before it's live.
- Execution history (queued/running/succeeded/skipped/failed/retrying) shown in plain language ("Ran 14 times today, 1 failed — tap to see why"), input/output summaries with sensitive values redacted.
- Pause/disable with rollback guidance — disabling a rule never corrupts existing records or blocks manual operation.
- The six workflows A–F below ship as **pre-built templates** on this canvas so the owner starts from a working example, not a blank page.

## Architecture notes for implementation

- Domain rules/scoring: typed TypeScript functions, unit-tested; critical validations re-enforced server-side.
- Durable state: Postgres tables + transactional RPCs in the verified AFIT Supabase project.
- Scheduled execution: Supabase Cron or an Edge Function worker — do not assume a scheduler already exists; verify.
- AI adapter: a narrow interface (`summarizeConversation`, `extractLeadFacts`, `classifyIntent`, `draftReply`, `recommendNextAction`) — the browser never receives model/provider secrets.
- Messaging adapter: provider-specific interface (Meta Cloud API); verify template approval, opt-in, rate limits, delivery callbacks before enabling sends.
- All external calls need timeouts, safe retries, idempotency, status logging, and a manual fallback path.

## Acceptance tests (see `docs/17_TEST_PLAN.md` for the full suite)

- A duplicated inbound event creates exactly one lead and one qualification task.
- AI failure never blocks a manual lead/quotation/project action.
- AI cannot change price, approval state, payment state, or role, under any input.
- Every automation rule can be disabled without corrupting records or blocking manual operation.
- Retried Won-conversion creates exactly one customer link, work order, and project.
