# 15 — Reports, Dashboard and Metric Definitions

Every number on every screen and every Telegram answer must trace back to a real transaction. No hard-coded demo figures once connected to real data (`CLAUDE.md` §0.8).

## Metric definitions (state these next to the number, or in a tooltip — never leave a figure unlabeled)

- **New leads** — leads created in the selected date range, by `created_at`.
- **Called** — leads with at least one `call_logs` row with a resolved outcome (not `pending_outcome`) in range.
- **Avg first-call time** — median/mean time between lead creation and the first resolved call outcome, in range.
- **Site visits booked / completed** — count of `site_visits` by status, in range.
- **Pipeline value** — sum of deal estimated value, weighted by each deal's current stage win % (`docs/09`), for open deals.
- **Conversion rate** (stage → stage, or lead → won) — count reaching stage B ÷ count that reached stage A, in the matching cohort window. State the cohort window explicitly — conversion computed inconsistently across time windows is misleading.
- **Cost per lead** — ad spend for the period (from Meta, if the Ads connector is wired) ÷ leads attributed to that campaign via `ad_referrals`.
- **Staff scorecard** — calls logged, % within the response-time target, follow-up completion rate, overdue count, all scoped to deals assigned to that staff member in the date range.
- **AI agent stats** — chats replied, service auto-detected count (and method breakdown: ad/keyword/AI/asked), details collected, handed to staff, average reply time — sourced from `ai_suggestions` and `message_events`, not estimated.

## Dashboard (owner, desktop — see `docs/04_UI_UX_SPECIFICATION.md` for layout)

- KPI cards (see above), each clickable through to its filtered underlying list.
- Untouched-leads banner sourced from the live overdue count, never a cached/stale number.
- Funnel widget with the single biggest drop-off stage flagged.
- Staff scorecard panel.
- Ad campaign performance table (requires `docs/10` attribution wiring; shows "attribution not yet connected" rather than fabricated numbers if CAPI/referral capture isn't live yet).
- AI agent panel.

## Telegram manager agent reporting (`docs/13`)

- Nightly summary: leads in, called, site visits booked, deals won (with value), follow-ups completed, untouched leads, staff scorecard — computed by the same queries/definitions as the dashboard, not a separate ad-hoc calculation that could drift.
- Free-text owner questions are answered by calling the same read-only reporting functions the dashboard uses (via the MCP read tools in `docs/13`), never by the agent inventing an answer from its own reasoning about what's "probably" true.

## What not to do

- Never present a correlation (e.g. "AI suggestions accepted went up, so conversion went up") as proof of causation.
- Never blend "invoiced," "collected," "estimated," and "actual" profit into one unlabeled number — see the financial definitions discipline the broader blueprint establishes for any later accounting/billing module, and apply the same discipline here: label exactly what a figure measures.
- Never show a report total that doesn't match what you'd get by manually counting the underlying list — if a discrepancy is found during testing, it's a bug, not a rounding note.
