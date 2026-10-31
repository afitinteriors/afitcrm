---
description: Review a PR or change set for correctness, security, regression risk, and scope — without rewriting it.
argument-hint: [PR number, branch, or path]
---

Review this change set: $ARGUMENTS

Check, in this order:
1. **Correctness** — does the change do what it claims, for the actual
   code paths involved?
2. **Regression risk** — what existing behavior could this break? Check
   callers/callees of anything changed.
3. **Security** — auth, RLS, secrets, input validation, webhook
   signatures — anything touched in this area gets a closer look (invoke
   the `security-auditor` agent for a deeper pass if the change touches
   auth/RLS/webhooks/API routes).
4. **UI/UX consistency** — does it match this project's design tokens and
   desktop/mobile split (CLAUDE.md's UI/UX Rules & Design System and
   Desktop vs Mobile Navigation sections, or `.claude/rules/ui-first.md`
   / `desktop-mobile.md`)?
5. **Responsive behavior** — if UI changed, has it actually been checked
   at 1440×900, 390×844, and 375×812 (not just claimed)?
6. **Tests** — are there tests for the new/changed behavior, and do they
   correspond to real failure scenarios (not padding)?
7. **Build** — does `npm run lint` / `npx tsc --noEmit` / `npm run build`
   pass?
8. **Scope creep** — does the change do only what it claims, or has it
   quietly touched unrelated code, refactored in passing, or expanded
   beyond the stated issue/phase?

Report findings by severity (Critical/High/Medium/Low), each with the
specific file/line and why it matters.

**Do not rewrite the PR automatically.** This command reviews; it does
not fix. If asked to also fix findings, that's a separate, explicit
follow-up step.
