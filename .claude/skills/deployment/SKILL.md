---
name: deployment
description: "Production-deployment safety methodology for AFIT CRM - environment variables, build verification, deployment verification, smoke tests. Use when planning or executing a deployment; pairs with the deploy command."
---

# Deployment (AFIT CRM)

## When to use
Planning or executing anything that ships to production. Pairs with the
`deploy` command, which sequences these checks into one workflow.

## Hosting constraint
This project is committed to zero-cost hosting: GitHub, Supabase, and
Cloudflare Free tier only — no paid Vercel. Cloudflare migration is
currently blocked (Next.js 16 `proxy.ts` vs. OpenNext Cloudflare,
workers-sdk#13755) — don't route around that by weakening auth. Any
deployment plan that drifts from this constraint needs to be flagged, not
quietly followed.

## Environment variables
Confirm every required env var exists for the target environment before
deploying — check presence/length only, never read or print a value.
Missing env vars fail loudly at build/runtime; catching this before
deploying is cheaper than after.

## Build verification
`npm run build` must succeed from a clean state immediately before
deployment — not a build from earlier in the session, and not "it built
once earlier."

## Deployment verification
After deploying: confirm the deployment actually succeeded (build logs,
the live URL responding) before declaring done — don't infer success
from the deploy command exiting 0 alone if a separate confirmation is
available.

## Smoke tests
A small, targeted set of critical-path checks against the live
environment (login, one representative read, one representative write if
safe) — not a full regression suite. The goal is catching an
environment-specific failure (a missing env var, a misconfigured build
output) that local testing can't catch, not re-verifying feature
correctness.

## Never
Blind-deploy uncommitted or unreviewed work. Deploy, commit, or push
automatically — see `.claude/rules/deployment.md`.
