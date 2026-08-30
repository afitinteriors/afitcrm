---
description: Run one CRM phase under the project's standard workflow (plan → UI/UX first → implement → verify → report → stop)
argument-hint: <phase scope/description>
---

Work on exactly this phase, nothing else: $ARGUMENTS

CLAUDE.md is the authoritative source for all rules — read only the
sections relevant to this phase's scope, not the whole file if this
session already has it.

1. Confirm/plan scope first. If anything about the phase above is
   ambiguous, ask before implementing. Do not implement future phases,
   do not refactor unrelated code, do not silently expand scope.
2. If this phase involves UI, establish the UI/UX direction before any
   backend/database work. Invoke the `ui-ux-pro-max` skill only for
   genuine design exploration — not automatically for routine
   implementation.
3. Implement only the approved scope.
4. When verification is required, use the `afit-verify` skill — it owns
   the project's testing procedure; don't re-derive it here.
5. The `git-and-schema-safety` hook stays active throughout and will ask
   for confirmation on any protected git/schema operation — don't try to
   route around it.
6. Never commit. Never push. Never move to the next phase automatically.
   Never run `/clear` yourself.
7. Report exactly: what changed, what was tested/verified, remaining
   gaps, and `git status`.
8. Stop. Wait for explicit human direction before continuing.
