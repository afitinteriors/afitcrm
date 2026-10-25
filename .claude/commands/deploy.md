---
description: Safe, deliberate production deployment — never blind, never automatic.
argument-hint: [target/environment]
---

Prepare and (only if explicitly confirmed) execute a production
deployment: $ARGUMENTS

**This command never deploys silently. Every step below is a checkpoint,
not a formality.**

Before deployment:
1. Inspect `git status` and `git log` — identify the exact commits/files
   that would ship. Flag anything uncommitted or unexpected before going
   further.
2. Verify the build (`npm run build`) succeeds from a clean state.
3. Verify required environment variables/secrets exist for the target
   environment — check for presence only, never print values.
4. Verify the deployment configuration (hosting target, build command,
   any platform-specific config) matches what's actually intended — this
   project is committed to zero-cost hosting (GitHub/Supabase/Cloudflare
   Free only, no paid Vercel); flag any drift from that before proceeding.
5. Confirm with the user there are no unintended changes riding along —
   read back the exact commit range/diff that would ship and get
   explicit go-ahead in the current turn before the actual deploy action.

Never:
- Deploy uncommitted or unreviewed work.
- Expose a secret in output, logs, or a report.
- Modify production infrastructure beyond what's strictly needed for this
  deployment.
- Trigger the actual deploy without an explicit, current-turn
  confirmation — a prior approval does not carry forward.

After deployment:
1. Verify the deployment actually succeeded (build/deploy logs, the live
   URL responding).
2. Run targeted smoke tests against production — the critical paths only
   (login, one representative read, one representative write if safe),
   not a full regression suite.
3. Report the exact result: what shipped, what was verified, and the
   live state.
