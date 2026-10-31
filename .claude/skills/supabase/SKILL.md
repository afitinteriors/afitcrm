---
name: supabase
description: "How to safely inspect and reason about this project's live Supabase schema, RLS, and auth before making changes - avoiding unnecessary schema changes and client-side-only security. Use before any change touching the database, RLS policies, or authorization."
---

# Supabase (AFIT CRM)

## When to use
Before writing or changing anything that touches the database, RLS
policies, or authorization — including "just a query," since a query's
correctness depends on the RLS it runs under.

## Inspect before assuming
Always check the actual live schema/policies (via the Supabase MCP tools
— `list_tables`, `execute_sql` read-only, `get_advisors` — or by reading
migration files) before assuming a table, column, or policy exists or
behaves a certain way. This project's own history has repeatedly found
real gaps this way (a table with no write policy at all, a policy that
looked sufficient but wasn't) that a memory-only assumption would have
missed. See CLAUDE.md's Current Database Reality section for what's
confirmed live as of the last check.

## RLS
- Baseline pattern project-wide: admin sees everything, a non-admin sees
  only rows they own (see CLAUDE.md's Auth/RLS/Security section for the
  exact `leads` example).
- A known Postgres gotcha specific to this project's history: an
  `UPDATE`/`DELETE` policy alone isn't enough — the row must also be
  visible via some applicable `SELECT` policy for the calling role.
  Always pair a new narrow `UPDATE` policy with a matching `SELECT`
  policy.
- Wrap `auth.uid()`/`private.is_admin()` calls in new policies as
  `(select auth.uid())` — the InitPlan-optimization pattern already
  retrofitted across every existing policy.

## Auth / server-side authorization
Every authorization decision must be enforceable independent of the UI —
a hidden nav link is not access control. Verify a restricted route
returns a real server-side 404/redirect, not just an absent link.

## Avoid unnecessary schema changes
Build a UI-level view over existing columns first (Deals, Site Visits,
Quotations are the established pattern in this project) — promote to
real schema only once that's hit a genuine, demonstrated limit, and only
with explicit approval. See `.claude/rules/database.md`.

## No client-side-only security
Never treat a client-side check (a disabled button, a hidden form) as
the actual security boundary — the database/RLS layer is.
