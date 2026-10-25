# 18 — Implementation Plan (do not skip ahead)

Each phase ends with a report: what was delivered, files changed, migrations, tests run and results, known limitations, next phase, and whether owner approval is needed before continuing.

## Phase 0 — Repository and backend audit
Inventory current files, stack, branches, latest commit, existing CRM scaffold if any. Verify Supabase target/project identity read-only (`docs/16`). Identify collisions with any unrelated existing code. Output an audit report and a proposed file list. No destructive edits.

## Phase 1 — Design system and app shell
Responsive app shell: sidebar (desktop), bottom nav (mobile), header, role-aware menu, reusable table/form/dialog/status/empty/loading/error components, matching the published design canvas aesthetic. Mock data only.
**Acceptance:** all navigation works, responsive, no dead menu items.

## Phase 2 — Authentication and permissions
Login, password reset, session handling, protected routes, the full permission catalogue and checkbox-based Team & Permissions screen (`docs/03`, `docs/08`). Backend policies applied only after reviewed target and owner approval.
**Acceptance:** unauthorized screens/API requests blocked; adding a team member works end to end with zero code changes required.

## Phase 3 — Core CRM: customers, leads, pipeline
Customer/deal data model (`docs/06`), the full Gypsum sales-pipeline state machine (`docs/09`), manual lead entry, the pipeline Kanban board, lead detail, call logging with the **compulsory outcome sheet** (`R-ACCT-02` — this is the single most load-bearing feature in the whole product, build and test it thoroughly), site visits and measurements.
**Acceptance:** a lead can be manually created, called, and walked through to Won with correct state-machine enforcement and a full activity history.

## Phase 4 — Quotations and work pipeline
Estimate/BOQ, quotation PDF generation and versioning, the Won-conversion workflow creating a work-pipeline project exactly once, the Gypsum work-pipeline stages.
**Acceptance:** complete lead-to-quotation-to-project journey with idempotent conversion, tested by retrying the conversion request.

## Phase 5 — WhatsApp integration (interim, against the existing provider)
WhatsApp Inbox screen, inbound message capture into `message_conversations`/`message_events`, manual staff replies from the CRM. This phase deliberately does **not** touch the live number migration — see Phase 8.
**Acceptance:** staff can read and reply to WhatsApp conversations from inside the CRM.

## Phase 6 — Automation rules engine + the drag-and-drop workflow builder
Workflows A–F (`docs/12`), the 15-minute escalation timer, lead scoring, **the visual drag-and-drop Automation Rules canvas** (`docs/00_NO_CODE_REQUIREMENT.md` §1 — build the canvas itself, not just a settings form, since this is how the owner will ever touch automation again), in-app notifications.
**Acceptance:** an overdue lead reliably escalates; a duplicated webhook/event never creates duplicate records; every automation can be disabled without breaking manual operation; the owner can open, read, and adjust a timer or message on an existing workflow template from the canvas without asking a developer.

## Phase 7 — AI sales agent (shadow mode → draft mode) + the no-code training screen
Service detection (`docs/11`), field extraction, reply drafting — in shadow mode first (nothing auto-sends), then draft-for-approval. No auto-send yet. **Build Settings → AI Agent Training** (`docs/00` §2) in this phase, not later — keyword tags, example conversations, question-list builder, live test chat.
**Acceptance:** AI drafts are accurate against the labelled test set at a bar the owner accepts; AI outage never blocks manual CRM use; the owner can add a keyword or correct an example from the app and see it affect the next test-chat response, with zero code involved.

## Phase 8 — Direct WhatsApp Cloud API migration
Stand up Cloud API on a test number, verify webhook/templates/ad tracking end to end, then migrate the real number from the existing reseller in a planned window with owner sign-off (`docs/10`). Enable CTWA attribution (`ad_referrals`) and the Conversions API feedback loop.
**Acceptance:** ad attribution visible on the dashboard's campaign table; no messaging gap during migration beyond the agreed window.

## Phase 9 — AI auto-send (low-risk) and reports/dashboard
Enable auto-send for acknowledgement/qualifying-question templates only, with caps and opt-out handling. Build the full dashboard and metric definitions (`docs/15`).
**Acceptance:** dashboard numbers match hand-counted fixtures; AI auto-send respects every limit in `docs/11`.

## Phase 10 — Telegram manager agent (Hermes)
Stand up Hermes Agent, the CRM's narrow read/write MCP server, cron watch-loop and nightly report, owner pairing (`docs/13`).
**Acceptance:** owner's free-text Telegram questions return figures matching the dashboard; nudges reach staff reliably; the agent's write actions are limited to the documented allow-list.

## Phase 11 — Interior service line activation
Interior-specific screens, AI question set, and work-pipeline UI, on top of the data model already built in Phase 3 (`docs/09`).
**Acceptance:** Interior deals flow through their own pipeline independently of Gypsum, with correct reporting separation.

## Phase 12 — PWA, hardening and deployment
Installability, offline draft support (tested, not assumed), accessibility pass, performance, full security review, backup/restore runbook, deployment instructions.
**Acceptance:** production build and full test suite pass; no secrets in the repo; rollback plan exists and is documented in `docs/19_DEVELOPER_HANDOVER.md`.

---

**Phases 0–4 can proceed largely autonomously on mock/local data.** Phases 5, 8, 9, and 10 each involve a paid provider, a live customer-facing channel, or a number migration — each requires explicit owner approval before going live, per `CLAUDE.md` §0.6.
