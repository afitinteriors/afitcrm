# 16 — Supabase Setup

## Project identity — read this before touching anything

Earlier sessions on this account have conflated AFIT (gypsum plastering/interior) with Broastin (fried chicken) — a completely unrelated business that happens to share the same owner's attention. **Verify with the owner which Supabase project is the AFIT project before any migration, read, or write.** Never assume continuity from a Broastin project reference seen in another conversation or file. If no AFIT Supabase project exists yet, creating one is itself a decision the owner should confirm, not something to infer silently.

## Environment variables (`.env.example` — commit this with empty placeholders, never real values)

```
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side only, never in VITE_ prefix, never in browser bundle

# Meta / WhatsApp Cloud API
META_APP_ID=
META_APP_SECRET=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_SYSTEM_USER_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# AI sales agent provider
AI_PROVIDER_API_KEY=

# Telegram manager agent (Hermes Agent side, not this repo's own server necessarily — document where it actually lives)
TELEGRAM_BOT_TOKEN=
HERMES_MCP_SERVER_URL=
HERMES_MCP_SERVICE_TOKEN=
```

## Setup checklist

1. Confirm project identity (above).
2. Enable RLS on every table as it's created — never ship a table with RLS off "to fix later."
3. Auth: email/password (or magic link — pick one, document which) configured; invite-only, no public signup.
4. Storage buckets: private by default, path convention per `docs/06`. Signed URLs with short expiry for file access.
5. Edge Functions for: WhatsApp webhook receiver, AI adapter calls, the CRM's MCP server for the Telegram agent (`docs/13`), scheduled jobs (if not using Supabase Cron directly).
6. Supabase Cron (or equivalent worker) for: 15-minute overdue-lead sweep, nightly report trigger (owner-side trigger lives in Hermes's own cron per `docs/13`, but the CRM's own data-refresh/escalation jobs run here).
7. Generate TypeScript types after every schema change (`npm run gen:types` or the equivalent MCP call) — never hand-maintain a drifting duplicate.

## Migration discipline

For any migration beyond local/dev: local review → read-only remote verification against the **confirmed** AFIT project → dry run → show diff and risk → **stop for explicit owner approval** → apply → verify schema/RLS/RPCs/tests pass. See `docs/07_SECURITY_AND_RLS.md` §9 for the full rule — it is repeated here deliberately because this is the step most likely to be rushed.
