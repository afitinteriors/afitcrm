# 05 — Database Architecture

Backend: Supabase (Postgres + Auth + Storage + Edge Functions + Cron). This document covers conventions; `docs/06_DATABASE_SCHEMA.md` has the table list.

## Conventions

- UUID primary keys everywhere.
- `created_at`, `updated_at`, `created_by`, `updated_by` on every business table.
- Foreign keys enforced; prefer `ON DELETE RESTRICT` for financial and historical records — never silently cascade-delete a paid invoice because a customer row changed.
- Timestamps stored UTC; displayed `Asia/Kolkata` in the UI.
- Monetary values: `numeric` fixed precision, never `float`/`double`.
- Soft-archive (`archived_at`) instead of hard delete for anything with history value (leads, customers, quotations). Hard delete is reserved for genuine mistakes (duplicate test rows) and is itself audit-logged.
- Every business table has an explicit RLS policy — see `docs/07_SECURITY_AND_RLS.md`. No table is left open "temporarily."
- Append-only ledgers (stock movements, stock-free here but same principle applies to `deal_stage_history`, `call_logs`, `payment transactions` later) are never edited in place — corrections are new rows referencing the original.

## Why customer/deal/pipeline is modeled the way it is

See `docs/09_PIPELINE_AND_LEAD_LIFECYCLE.md` for the full reasoning. In short: **one customer row per phone number**, **one deal row per (customer, service)**, so that:
- A customer's full history (both services) is visible from one place.
- Reporting can cleanly separate Gypsum funnel performance from Interior funnel performance.
- Win probability / stage logic is per-deal, not forced onto a single flat "lead" record that tries to represent two different sales processes at once.

## Numbering and concurrency

- Quotation numbers, work-order numbers etc. use a `number_sequences` table with atomic `nextval`-style RPCs — never client-generated sequential numbers (two staff creating quotes simultaneously must never collide).
- All multi-row writes that must succeed or fail together (e.g. Won-deal conversion: create customer link + work order + project + initial tasks) run inside a single Postgres RPC/transaction, keyed by an idempotency key, so a retried request never creates duplicates.

## Automation tables live alongside business tables

Automation/rules/workflow state (`automation_rules`, `workflow_instances`, `lead_score_history`, `message_events`, `ai_suggestions`, etc.) are first-class tables in the same database, not a bolt-on system — see `docs/06_DATABASE_SCHEMA.md` §Automation and `docs/12_AUTOMATION_RULES_ENGINE.md`.

## Generated types

Supabase TypeScript types are generated from the verified live schema after every migration (`npm run gen:types` or the MCP `generate_typescript_types` call). Never hand-maintain a duplicate type file that can drift from the real schema.

## Supabase project identity — hard rule

This repository/business has been conflated with the Broastin (fried chicken) Supabase project in earlier sessions. **Before any migration or write, verify the target Supabase project is the AFIT project, not Broastin's**, by checking the project ref against what the owner confirms, not by assuming continuity from an unrelated earlier project. See `docs/16_SUPABASE_SETUP.md`.
