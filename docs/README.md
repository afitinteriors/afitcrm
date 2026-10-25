# AFIT CRM — WhatsApp-to-Close Automation for AFIT Interiors

A CRM built around one problem: Meta ad leads come in through WhatsApp, and the person who should call them doesn't always call them. This system makes a lead impossible to quietly lose — every lead is auto-captured, auto-tagged by service (gypsum plastering first, interior design/production second), auto-replied to by an AI agent, escalated if untouched, and reported on nightly to the owner through a Telegram manager agent.

## What this is

- A sales CRM: Lead → Site Visit → Quotation → Won Deal → Project → Payment, for a gypsum plastering and interior business.
- A direct Meta → WhatsApp Cloud API → CRM pipeline (no third-party WABA reseller in the loop).
- A bounded AI agent that replies on WhatsApp, detects which service the customer wants from keywords, collects missing details, and books site visits — never prices, never promises, never marks a deal Won.
- An owner-facing Telegram agent ("Hermes-style manager agent") that nudges staff, answers the owner's questions about the business, and sends nightly reports.

## What this is not

- Not a general-purpose chatbot. Not a full statutory accounting system. Not a payroll engine. Not something that runs with zero human involvement — see `CLAUDE.md` §3.

## Repository layout

```
crm/                  the React application — see docs/05 and docs/19
docs/                 full specification (read CLAUDE.md for the order)
supabase/             migrations, following the project's existing convention
CLAUDE.md             master build instructions — read this first
CHANGELOG.md          dated changes by phase
DEVELOPER_HANDOVER.md architecture, env vars, deployment, rollback
```

## Setup (filled in as the project is built)

```bash
cd crm
npm install
cp .env.example .env.local   # fill in your own Supabase + Meta + AI keys, never commit this file
npm run dev
```

Required environment variables are documented in `DEVELOPER_HANDOVER.md` and `.env.example`. Never commit real keys. The Supabase service-role key and Meta/WhatsApp access tokens must never reach the browser bundle.

## Build commands

```bash
npm run dev        # local dev server
npm run typecheck  # strict TypeScript
npm run lint
npm run test        # unit + integration tests
npm run build        # production build
```

## Core idea in one sentence

Deterministic rules and workflows (timers, stage transitions, notifications) run the business and work with zero AI configured; the AI agent and Telegram manager agent are an assistive layer on top that can fail safely without breaking the CRM.

## Where to start

Read `CLAUDE.md`, then follow its read order through `docs/`.
