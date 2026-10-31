---
name: crm-workflow
description: "AFIT CRM's business workflow - pipeline stages, stage-aware Lead Detail, Won/Lost rules, Follow-ups, desktop/mobile and Admin/Staff responsibilities. Use when implementing or reviewing anything that touches the sales pipeline, lead lifecycle, or role boundaries."
---

# AFIT CRM Workflow

## When to use
Implementing or reviewing anything touching the sales pipeline, a lead's
lifecycle, follow-ups, or what Admin vs Staff can see/do. This is
reusable domain knowledge — CLAUDE.md's Lead/Pipeline Architecture and
Admin vs Staff sections are the authoritative rules; this skill is the
"how to think about it" companion, not a replacement.

## Pipeline
Exactly 8 user-facing stages: New → Contacted → Qualified → Site Visit →
Quotation → Negotiation → Won / Lost. `Invalid` may exist internally for
data compatibility but is **never** a user-facing pipeline stage — never
surface it in a selector, filter, or report as if it were one.

## Stage-aware Lead Detail
The lead page shows only what's relevant to its *current* stage
(`STAGE_SECTIONS` in `lib/lead-stage-sections.ts`) — never the full
New→...→Lost history as a permanent section, never a future-stage action
(e.g. no Won/Lost close form on a brand-new lead). When adding a new
lead-related capability, ask which stage(s) it belongs to before wiring
it in everywhere.

## Won/Lost rules
Won requires `job_value`; Lost requires `lost_reason`. Both are only
reachable through their dedicated close workflow
(`markLeadWon()`/`markLeadLost()`), never a generic status write — this
protection must never be removed or routed around.

## Follow-ups
Real, operationally important table (`follow_ups`) with
`assigned_to_id`/`due_date`/`due_time`/`type`/`status`/`completed_at`.
Desktop gets the full filtered workspace; mobile gets a trimmed
today/overdue view — one data layer, two thin UI layers, not two
divergent implementations.

## Desktop vs mobile responsibilities
Desktop = full CRM operations (pipeline management, commercial info,
reports, admin). Mobile = the daily-work subset (Home/Leads/Chats/Tasks
in the bottom bar; Site Visits/Deals/Quotations one tap away in More).
See `.claude/rules/desktop-mobile.md`.

## Admin/Staff boundaries
Admin sees everything; Staff sees only their own assigned
leads/conversations/follow-ups, enforced by RLS, not UI hiding. Automation,
Audit Log, and Settings stay desktop/admin-only. See CLAUDE.md's Admin vs
Staff section for the exact, current list.
