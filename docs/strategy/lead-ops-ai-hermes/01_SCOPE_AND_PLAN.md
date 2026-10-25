# Lead Ops UI, WhatsApp AI Agent & Hermes (Telegram) — Strategy

Status: STRATEGY / SPECIFICATION ONLY. No code, schema, RLS, WABIS, or Meta
changes are implied or authorized by this document. This document does not
replace, restate, or override the project's `CLAUDE.md` — CLAUDE.md wins on
any conflict. This is a new, additive strategy doc, in the same spirit as
`docs/strategy/follow-up-brain/`.

## Scope of this document

Four pieces, bundled here because the owner asked for them together, but
each is still its own phase with its own go-ahead:

1. **Lead Detail + Call Outcome — UI modernization.** Continuing the
   project's own planned "Phase 0b AppShell onward" (see `app/globals.css`'s
   already-defined `--chrome-900` / `--brand-*` / `--glass-fill` / `--gold`
   tokens, currently unused by any page). No new design system — reuse
   those tokens exactly.
2. **Call Outcome — compulsory capture.** A genuinely new UX pattern, not a
   restyle of something existing. Today, call/contact results are captured
   through `CompleteFollowUpButton.tsx`, `StatusSelect.tsx`, and
   `WonLostForms.tsx` — there is no single, compulsory "what happened on
   this call" step. [BUSINESS DECISION REQUIRED: exact required fields —
   outcome (answered/no-answer/wrong-number/...), notes, next action — must
   be confirmed before building; do not invent a schema.]
3. **WhatsApp AI sales agent.** New. Keyword-based service detection
   (gypsum vs. interior) so the agent never re-asks what's already stated
   in the ad/first message; replies in Malayalam or English matching the
   customer; stays strictly scoped to AFIT's own services, per WhatsApp's
   2026 policy against general-purpose AI chatbots. Trained through an
   example-based in-app interface — never a prompt file the owner would
   have to edit.
4. **Hermes — Telegram manager agent.** New. Daily/scheduled reports and
   nudges to Afsal (owner) and Azhar (staff) on Telegram; natural-language
   Q&A against CRM data. Reaches the CRM only through a narrow, auditable,
   mostly-read tool interface — never raw DB access.

## Binding rules (carried over from `follow-up-brain/06`, apply here too)

- **No database triggers for business logic.** Everything above is
  application/server-action code.
- **WABIS is untouchable.** No phase here touches, assumes changes to, or
  depends on changes to Meta ads config, the WhatsApp Cloud API
  integration, WABIS (Flow 981027), its webhook route/secret, or its
  ingestion logic (`lib/whatsapp/ingest.ts`, `parse-wabis.ts`,
  `wabis-auth.ts`). The new AI agent's outbound replies go through the
  existing, already-live `lib/whatsapp/send-message.ts` send path — audit
  it first, extend it, don't replace it.
- **No invented scoring.** No new "lead score" for the AI agent's
  confidence or the Hermes agent's "urgency" — plain, explainable signals
  only (same rule as `follow-up-brain/04`).
- **RLS is never weakened.** Hermes' CRM access must compose with the
  existing `is_admin() OR assigned_to_id = auth.uid()` shape, scoped
  per-user even when the request arrives from Telegram.
- **No-code, always** (owner's standing requirement): AI agent training =
  example-based in-app screen. Workflow/automation wiring = the existing
  `lib/automations/builder-graph.ts` + `@xyflow/react` visual canvas,
  extended with new node types (AI-reply action, Telegram-notify action) —
  never a new engine, never a config file the owner edits.

## Phase plan (one phase at a time, each needs its own go-ahead)

- **Phase A — Lead Detail / Call Outcome UI, Phase 0b tokens.** Apply the
  existing `--chrome-900`/`--brand-*`/`--glass-fill`/`--gold` tokens to
  Lead Detail; design (not yet build) the compulsory Call Outcome step
  once the `[BUSINESS DECISION REQUIRED]` fields above are confirmed. No
  schema impact if outcome capture reuses existing follow-up/status
  tables; schema impact likely if a new `call_outcomes` table is wanted —
  confirm before migrating.
- **Phase B — WhatsApp AI sales agent.** Audit `lib/whatsapp/*` and
  `lib/automations/*` in full first. Build keyword/service detection,
  Malayalam/English reply generation, and the example-based training
  screen. Outbound sends via the existing send path only.
- **Phase C — Hermes (Telegram).** New Telegram bot + a narrow read/alert
  tool surface over existing `lib/dashboard-brain.ts`, `lib/today.ts`,
  `lib/reports.ts`. Daily report, overdue-lead nudges, Q&A.
- **Phase D — Push notifications wired to "My Duty Now".** Verify how much
  of `push_subscriptions_and_notifications` + `web-push` is already wired
  before specifying as new vs. extend-existing (per
  `follow-up-brain/05`'s single-card duty model).

## What this document deliberately does not do

- It does not pick the Call Outcome's exact fields — that's a business
  decision, not an engineering one.
- It does not assume the AI agent or Hermes architecture before `lib/`
  is audited in Phase B/C's own first step.
- It does not touch `CLAUDE.md`, `AGENTS.md`, or any existing
  `docs/strategy/follow-up-brain/*` file.
