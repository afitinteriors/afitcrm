# 01 — Product Overview

## The real problem this solves

Meta ads generate leads who message AFIT on WhatsApp. Today those leads route through a third-party WABA reseller to a human, and the human (Azhar) often doesn't call within a useful window — or doesn't call at all. There is no system record of what happened, so leads silently die and nobody, including the owner, can see it happening.

This product's job is to make that invisible failure visible and then close it with automation:

1. **Capture** every WhatsApp/Meta-ad lead into the CRM automatically — no manual entry, no leads sitting only in a phone's WhatsApp app.
2. **Classify** the lead's service (gypsum plastering vs interior design/production) automatically from the ad it came from and from keywords in the customer's first message — never ask the customer to repeat what they already said in the ad.
3. **Respond** immediately through a bounded AI agent so the customer isn't left waiting, while the deterministic system tracks whether a human followed up.
4. **Force accountability**: every call must get a logged outcome and a next action before the record can be considered "handled." No silent "I called but forgot to update" path exists.
5. **Escalate** anything untouched past a time limit, to the staff member and to the owner.
6. **Report**: the owner should be able to open Telegram and ask "how is Azhar doing" and get a real, current answer, plus get an unprompted nightly summary.

## Who uses it

- **Owner (Afsal)** — desktop dashboard, Telegram manager agent, full visibility, approves team/permissions.
- **Azhar (operator, sales & site coordination)** — mobile-first: Today list, WhatsApp inbox, call button + compulsory outcome, site visit scheduling.
- **Future staff** (site supervisors, more sales) — added via Settings → Team with no new code, each scoped to only what their role needs.

## Service lines

1. **Gypsum plastering and false ceiling** — primary, build first, full pipeline.
2. **Interior design / production** — second service line. Build the data model and pipeline structure for it now (so no migration is needed later) but the screens and AI question-sets for it can ship in a later phase. See `docs/09_PIPELINE_AND_LEAD_LIFECYCLE.md`.

## Non-goals (explicitly out of scope for v1)

- Full statutory accounting/GST filing replacement
- Payroll compliance
- A general-purpose AI chatbot (prohibited under WhatsApp's own Business Platform policy — see `docs/10_WHATSAPP_META_INTEGRATION.md`)
- AI autonomously setting prices, approving discounts, or marking deals Won
- A public customer-facing marketplace or franchise portal

## The three layers (read this before anything else)

1. **Rules Engine (deterministic)** — follow-up timers, required fields, valid stage transitions, escalation thresholds. Same input → same output, always. Must work with zero AI or messaging provider configured.
2. **Workflow Engine (deterministic orchestration)** — multi-step processes (lead intake, qualification, won-deal conversion) that are resumable and idempotent: retrying a step must never create a duplicate lead, task or project.
3. **AI Agent (assistive, bounded)** — drafts replies, extracts candidate fields, classifies service/intent, recommends next action. Its output is a suggestion until a human or a pre-approved rule accepts it. It cannot bypass permissions or business rules, and the CRM must keep working when it is down.

See `docs/12_AUTOMATION_RULES_ENGINE.md` for the full architecture of these three layers working together.

## Success looks like

- Zero leads sit untouched past their configured time limit without an alert firing.
- Every call has a logged outcome within the same session (the popup cannot be dismissed without one).
- The owner can ask the Telegram agent "what happened yesterday" and get an answer sourced from real CRM records, not an invented one.
- A new staff member can be added and scoped to the right permissions in under two minutes, with no deploy.
