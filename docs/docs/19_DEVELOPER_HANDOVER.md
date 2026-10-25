# 19 — Developer Handover

Kept current as the project is built — this is the single document a new developer (human or AI) reads to get oriented without re-reading every spec file.

## Architecture summary

React 19 + Vite + TypeScript + Tailwind + shadcn/ui frontend, Supabase backend (Postgres/Auth/Storage/Edge Functions/Cron). Three cooperating layers: deterministic Rules Engine, deterministic Workflow Engine, bounded AI Agent (`docs/12`). A separate Telegram-facing manager agent (Hermes Agent, `docs/13`) talks to the CRM only through a narrow MCP read/write interface — never direct database access.

## Folder map

```
crm/
  src/
    app/            router, providers, layouts, navigation
    components/      ui, data-display, forms, feedback, permissions
    features/        dashboard, leads, pipeline, site-visits, quotations,
                      projects, whatsapp-inbox, automation-rules, team, settings
    domain/          models, enums, policies, calculations, state-machine logic
    repositories/     interfaces, mock, supabase — swappable implementations
    lib/             supabase client, query-client, formatting, permissions, errors
    hooks/
    stores/
  supabase/
    migrations/
    functions/        webhook receiver, AI adapter, MCP server for Hermes, cron jobs
docs/                 this specification set
```

## Environment variables

See `docs/16_SUPABASE_SETUP.md` §Environment variables for the full list and `.env.example`. Never commit real values. Service-role key, Meta token, AI provider key, and Telegram bot token are server-side only.

## Supabase

Project identity must be explicitly confirmed as the AFIT project before any write — see `docs/16_SUPABASE_SETUP.md`. Migrations follow the discipline in `docs/07_SECURITY_AND_RLS.md` §9: read-only review → dry run → owner approval → apply → verify.

## Key invariants to never break

1. The compulsory call-outcome sheet (`docs/09`) can never be bypassed — this is the product's core value proposition.
2. A deal reaching Won always has either an accepted quotation or an audited override — never a bare status change.
3. Rules/Workflow engine works with AI and messaging providers fully disabled.
4. AI and the Telegram agent each run under a fixed, narrow, auditable permission set — never general database access.
5. `ctwa_clid`/`source_id` is captured on the first inbound message of a conversation or it's lost forever — this is the one webhook-handling detail most likely to be missed by an unfamiliar developer.

## Deployment

(Fill in once a hosting target is chosen — Vercel/Netlify for the frontend, Supabase-hosted backend is the default assumption for a Vite+Supabase stack.)

## Rollback

Every migration should be written to be reversible where practical. Before any production deploy, confirm: the previous build is retrievable, the database migration has a documented down-path or is purely additive, and the owner has been told what to watch for in the first hour after deploy.

## Known limitations / deferred items

(Update this section every phase — list anything marked "blocked" or "deferred" in a phase report, with the reason, so it isn't silently forgotten.)

## Changelog

See `CHANGELOG.md` at the repository root for the dated, phase-by-phase change history.
