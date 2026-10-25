# 13 — Owner's Telegram Manager Agent (Hermes Agent)

The owner wants to manage the business from Telegram: nudge staff, watch the pipeline, and get reports, without opening the CRM app every time. This is a **separate process from the AI sales agent** (`docs/11`, which talks to customers on WhatsApp) — this agent talks to the **owner only**, on Telegram, about the business's internal state.

## What it is

[Hermes Agent](https://github.com/NousResearch/hermes-agent) (Nous Research, open source, MIT) is an agent runtime with a built-in messaging gateway (Telegram, Discord, Slack, WhatsApp, Signal), a cron scheduler for unattended scheduled runs, and MCP (Model Context Protocol) support for connecting it to external tools/data. It is not a CRM feature to build from scratch — it is infrastructure to stand up and connect to this CRM's data through a narrow, read-mostly MCP interface. [Hermes Desktop](https://github.com/fathah/hermes-desktop) is a third-party (not official Nous Research) GUI installer/companion for it if the owner prefers a desktop app over the CLI — either is fine; the agent's capabilities are identical, the desktop app is just an installer/chat UI wrapper.

## What it must do

1. **Nudge staff** — when a lead breaches its response timer (`docs/09`), the Rules Engine fires the alert; this agent is one of the delivery channels (alongside in-app/push) that can message Azhar directly on his own Telegram.
2. **Watch** — the agent runs on a cron schedule (e.g. every 15 minutes) checking for overdue leads, stuck deals, and anomalies, and proactively messages the owner when something needs attention — not just when asked.
3. **Answer the owner's questions** — free-text Telegram messages like "how is azhar doing this week" or "how many leads from the Kollam ad" get answered with figures pulled live from the CRM, never invented. This is the same constraint as `R-REP-02`.
4. **Nightly report** — a scheduled message (default 8 PM IST, configurable) summarizing the day: leads in, called, site visits booked, deals won, follow-ups completed, untouched leads, and the staff scorecard.

## Architecture — CRM stays the source of truth

```
Telegram  ⇄  Hermes Agent (gateway + cron + chat)
                 │
                 │  MCP server (built as part of this CRM project)
                 ▼
         AFIT CRM read API + narrow write actions
         (Supabase, same RLS-protected tables everything else uses)
```

The Hermes Agent **never talks to Supabase directly with its own credentials for arbitrary access.** It talks to a purpose-built MCP server exposed by the CRM backend (an Edge Function or small API service), which:
- Exposes **read** tools: `get_pipeline_summary`, `get_staff_scorecard(staff_id, date_range)`, `get_overdue_leads()`, `get_lead(id)`, `get_campaign_performance()`.
- Exposes a **narrow set of write** tools: `send_nudge(staff_id, message)` (creates a `notifications` row + sends via Telegram/WhatsApp, does not touch deal state), and nothing else by default.
- **Never** exposes `mark_won`, `record_payment`, `change_permissions`, or any tool that could let a Telegram message (from the owner or anyone who gains access to that chat) silently mutate business-critical state without going through the CRM's own audited flows. If the owner later wants the agent to be able to do more (e.g. "reassign this lead to Azhar"), that is an explicit, reviewed addition to the MCP tool list — not an open-ended capability.
- Runs under its own service identity (`docs/08_AUTHENTICATION.md` §Service identities), scoped by RLS like everything else.

This mirrors `docs/12`'s rule for the AI sales agent: **the agent is an assistive layer with a fixed, narrow, auditable action set — never a general backdoor into the database.**

## Setup (owner-facing, non-technical steps)

1. Install Hermes Agent (`hermes` CLI, or Hermes Desktop for a GUI) on a small always-on machine or a cheap VPS — it needs to run continuously to watch and nudge on schedule, not just when the owner's laptop is open.
2. Create a Telegram bot via @BotFather, get the bot token; run `hermes gateway setup` to connect it.
3. Choose the AI model/provider Hermes uses for its own reasoning (OpenRouter, Anthropic, OpenAI, or Nous Portal) — a separate provider/key from the CRM's own AI sales agent, since they serve different purposes and have different safety boundaries.
4. Point Hermes at the CRM's MCP server URL and credential (an MCP server config entry — see Hermes's MCP Integration docs) so it can call `get_pipeline_summary` etc.
5. Set up the cron jobs in Hermes: watch-loop (every 15 min), nightly report (8 PM IST) — Hermes has a built-in cron scheduler for exactly this.
6. Pair the owner's Telegram account with the bot (DM pairing / allowed-user config) so only the owner can issue commands and receive reports — this is a Hermes-side access control setting, confirm it's configured before go-live so a stranger can't message the bot and get business data.

## Scope boundary (repeat of the core safety rule)

This agent is for the **owner**, reporting on and nudging about the business. It is not:
- A second way for customers to reach the business (that's the AI sales agent on WhatsApp, `docs/11`).
- A way to bypass the CRM's own permission/approval flows — every write it can perform is a thin, audited, allow-listed action, never raw database access.
- A replacement for the Rules/Workflow engine (`docs/12`) — it consumes and reports on what that engine already tracks; it does not independently decide stage transitions.

## Build order

This is built **after** the core CRM, Rules Engine and AI sales agent are working (see `docs/18_IMPLEMENTATION_PLAN.md` Phase ordering) — it is a reporting/convenience layer on top of a system that must already be correct on its own.
