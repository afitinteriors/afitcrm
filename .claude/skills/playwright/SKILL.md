---
name: playwright
description: "General browser-verification methodology - required viewports, role-based testing, overflow checks, targeted regression strategy, evidence-based reporting. Use when planning how to verify a UI change live. For AFIT CRM's exact, project-specific procedure, invoke the afit-verify skill instead - this skill is the general method behind it."
---

# Playwright Verification Methodology

## When to use
Planning *how* to verify a UI or permission change lives up to what it
claims. For this project's concrete, ready-to-run procedure, use the
`afit-verify` skill instead — it already encodes everything below plus
this project's specific gotchas (dev-overlay click interception, `<select>`
label matching, Server Action revalidation timing).

## Required viewports
1440×900 (desktop), 390×844 and 375×812 (mobile) — see CLAUDE.md's
Testing Rules section for why these three specifically.

## Admin/Staff testing
Test every role the change actually affects. For a role boundary, verify
both sides: the permitted role can do it, and the restricted role is
blocked *server-side* (a real 404/redirect on direct URL access), not
merely hidden from nav.

## No-overflow testing
Check `document.documentElement.scrollWidth === clientWidth` at each
mobile viewport — a horizontal scrollbar on a card or table is the most
common regression from a UI change.

## Targeted regression strategy
Verify only what the change actually affects. Don't re-run a full
historical regression suite for an unrelated change — that's expensive
and doesn't add signal. Do re-run a regression check when the change
touches shared code (a hook, a shared component, an RLS policy) with
plausible blast radius beyond the immediate feature.

## Evidence-based reporting
Report what was actually observed (a real screenshot, a real console
check, a real DB state), not what should theoretically work from reading
the code. If live verification wasn't possible (no test credentials, a
tooling limitation), say so explicitly — never claim success without it.
