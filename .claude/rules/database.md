# Database

Expands CLAUDE.md's Current Database Reality section — CLAUDE.md wins on
conflict.

- Inspect the actual live Supabase schema before making an assumption
  about what exists — don't rely on memory of a prior session.
- Do not change schema (a new table, or a new column that introduces a
  new business entity or structural change) without explicit approval
  when it introduces a new business entity or structural architecture.
- Do not duplicate an existing source of truth (e.g. don't add a second
  place that stores qualification score, pipeline stage, or lead
  ownership — there is exactly one owner per concept).
- Prefer a UI-level view over existing columns before promoting to real
  schema (Deals, Site Visits, and Quotations are the established
  pattern).
