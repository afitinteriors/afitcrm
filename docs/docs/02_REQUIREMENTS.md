# 02 — Functional Requirements

Requirements are grouped by capability. Each has an ID so other docs and tests can reference it (e.g. `R-LEAD-04`).

## R-LEAD — Lead capture

- **R-LEAD-01**: A WhatsApp message from a Click-to-WhatsApp (CTWA) ad or an existing contact creates exactly one lead record, even if the inbound webhook is delivered twice (idempotency key = provider message ID).
- **R-LEAD-02**: A Meta Lead Ads form submission creates a lead the same way, tagged with source = "lead form."
- **R-LEAD-03**: The CTWA `referral` object (`ctwa_clid`, `source_id`, `headline`) is captured from the *first* inbound message only (Meta does not repeat it) and stored against the lead permanently.
- **R-LEAD-04**: Duplicate phone number produces a warning shown to the assigned staff member; it is never silently auto-merged.
- **R-LEAD-05**: A lead with no detectable service is still created and flagged "service unclear" rather than blocked or discarded.
- **R-LEAD-06**: Manual lead entry (walk-in, phone call, referral) is supported from both desktop and mobile.

## R-SVC — Service detection

- **R-SVC-01**: Service is resolved in this order: (1) which ad the customer tapped, (2) ad headline / pre-filled message text, (3) keyword match against the customer's message (configurable keyword list per service, Malayalam + English + common misspellings), (4) AI semantic understanding if keywords don't match, (5) only if all of the above fail, the AI/human asks.
- **R-SVC-02**: The detected service and the method that found it ("found from: keyword 'plastering'") are both stored and shown to staff, with a one-click correct option.
- **R-SVC-03**: A message that names two services creates/links two deal records, one per service pipeline.

## R-ACCT — Accountability (the core requirement)

- **R-ACCT-01**: Every new lead has a 15-minute (configurable) response timer. Timer breach creates a visible overdue state and an alert to the assigned staff and the owner.
- **R-ACCT-02**: A call can only be logged through the CRM's Call button. Ending a call opens a compulsory outcome form (Answered / No answer / Busy / Wrong number / Not interested, plus next follow-up date) that cannot be dismissed without a selection — see `docs/09` state machine.
- **R-ACCT-03**: Every lead always has a next scheduled action with a due date. A lead cannot exist in a state with no next action.
- **R-ACCT-04**: Marking a lead "Lost" requires a reason from a fixed list.
- **R-ACCT-05**: Marking a lead "Lost" without logging at least 3 prior call attempts requires an owner override, logged in the audit trail.
- **R-ACCT-06**: If a staff member doesn't act before the timer breaches, the system sends the customer an automated WhatsApp holding message (does not require staff action) and alerts the owner — the business never looks unresponsive even if staff is slow.

## R-PERM — Team & permissions

- **R-PERM-01**: Owner can add a team member with name + mobile/email only; invite link is sent automatically. No code change required for any future hire.
- **R-PERM-02**: Owner assigns permissions per member via checkbox toggles (view leads, call leads, create quotations, view company profit, approve discounts, manage team) — not fixed named roles only; named roles are presets that pre-check common combinations.
- **R-PERM-03**: Deactivating a member preserves their historical records and removes their access; it does not delete data.
- **R-PERM-04**: Every permission is enforced server-side (RLS/RPC), not only hidden in the UI. See `docs/07_SECURITY_AND_RLS.md`.

## R-PIPE — Pipeline & deals

- **R-PIPE-01**: Each (customer, service) pair is one deal with its own stage, independent of other services the same customer has enquired about.
- **R-PIPE-02**: Stage transitions follow the state machine in `docs/09`; invalid transitions are rejected server-side (e.g. cannot reach Quote Sent without Visit Done).
- **R-PIPE-03**: A deal reaching "Won" requires either an accepted quotation reference or an explicit, audited owner override — never a bare dropdown change.
- **R-PIPE-04**: Won deals convert to a Work pipeline (Scheduled → In Progress → Completed → Payment Pending → Closed) automatically, without creating a duplicate project on retry.

## R-WA — WhatsApp / Meta integration

See `docs/10_WHATSAPP_META_INTEGRATION.md` for the full spec. Summary requirements:
- **R-WA-01**: Direct Meta WhatsApp Cloud API integration; no WABIS/reseller dependency for new leads once migrated.
- **R-WA-02**: Message window (24h service window, 72h CTWA free window) is tracked per conversation; outbound sends outside the window use an approved template automatically, never a blocked free-form send.
- **R-WA-03**: Opt-out ("STOP") suppresses all marketing/follow-up sends for that contact across every channel.

## R-AI — AI sales agent

See `docs/11_AI_SALES_AGENT.md`. Summary:
- **R-AI-01**: AI can summarize, extract fields, classify intent, draft replies and recommend next action without human approval.
- **R-AI-02**: AI cannot set/change price or discount, mark a deal Won, mark payment received, or send free-form (non-template) messages without a human-reviewed template policy being explicitly enabled.
- **R-AI-03**: AI failure/timeout degrades to "suggestion unavailable" — it never blocks core CRM functions (logging a call, changing a stage, etc).

## R-REP — Reporting

- **R-REP-01**: Every KPI shown must be computed from source transactions, not stored as a hard-coded or cached-without-definition number.
- **R-REP-02**: Owner can query the Telegram manager agent for ad-hoc answers ("how is Azhar doing this week") and receive figures sourced live from the CRM, not invented.
- **R-REP-03**: A nightly summary is sent automatically to the owner's Telegram (configurable time, default 8 PM IST).

## Non-functional requirements

- **NFR-01**: Primary interface language is English; Malayalam is a Settings toggle per user, and is required for AI customer-facing WhatsApp replies (see `docs/11`).
- **NFR-02**: Mobile-first for Azhar/staff screens (390px baseline); desktop-first for owner/admin screens.
- **NFR-03**: Every list has loading, empty and error states; every destructive action is confirmed; no silent data loss.
- **NFR-04**: All timestamps stored UTC, displayed `Asia/Kolkata`.
- **NFR-05**: Monetary values use fixed-precision numeric types, never floating point.
