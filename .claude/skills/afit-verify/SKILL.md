---
name: afit-verify
description: "Explicit-invocation-only verification procedure for AFIT CRM phase work. Runs this project's standard Admin/Staff, multi-viewport Playwright checks per CLAUDE.md §17/§18 for whatever the current phase actually changed. Invoke by name ('run afit-verify' / '/afit-verify') after implementing a phase, before reporting. Do not auto-trigger on generic build/test/fix requests."
---

# AFIT Verify

Explicit-invocation only. This is *how* to run this project's required
verification, not *what* to verify — CLAUDE.md §17 (viewport/Playwright
requirements) and §18 (quality gates) are the governing spec. Read those,
don't restate them here.

## Scope first

Inspect only the files this phase actually changed (already known from
the session). Don't re-explore the repo. Test only the surfaces those
files affect — don't re-verify unrelated pages that didn't change.

## Static checks

Run `npm run lint` / `npx tsc --noEmit` / `npm run build` only if this
phase touched code that could affect them — skip for doc/config-only
changes. Don't re-run checks already conclusively passed earlier in the
same session with no code change since.

## Live checks (when the phase touched UI/permissions)

- Required viewports: 1440×900, 390×844, 375×812.
- Admin and/or Staff — whichever role(s) the change actually affects.
- Role/permission checks where relevant: staff sees only their own
  scope; direct-URL access to an admin-only route returns a real
  server-side 404, not just a hidden nav link.
- No horizontal overflow: `document.documentElement.scrollWidth ===
  clientWidth` at each narrow viewport.
- Whatever specific UI behavior this phase claims to add/change —
  verify that behavior, not the whole app.

## Known gotchas in this project's Playwright setup

- In dev mode, the Next.js dev-tools overlay can intercept clicks near
  the bottom-right corner — if a click times out complaining an element
  "intercepts pointer events," that's the overlay, not a real bug.
- Match this app's `<select>` options by their visible label text, not
  the underlying enum value (e.g. "Site Visit", not `site_visit`).
- After a Server Action mutates data, the page can take ~1–2s to
  revalidate — wait briefly before re-snapshotting, or a real change can
  look like a bug.

## Boundaries

Never modify product code, schema, or config while verifying —
verification only observes. Never commit. Never push. When done: report
exactly what was checked and the result, then stop.
