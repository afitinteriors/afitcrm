---
description: Fix one concrete, well-defined bug or issue — minimal scope, no drift.
argument-hint: <issue description>
---

Fix exactly this issue, nothing else: $ARGUMENTS

Workflow (do not skip or reorder steps):
1. INSPECT — read the actual current code around the reported area.
2. REPRODUCE — confirm the bug actually happens, with real evidence
   (run it, hit the route, check the browser/console/logs) rather than
   assuming from the report alone.
3. IDENTIFY ROOT CAUSE — trace to the specific cause, not just the
   symptom.
4. MINIMAL FIX — the smallest change that fixes the root cause. Do not
   refactor, rename, or "clean up" anything else while you're in the
   file.
5. TARGETED TEST — verify the fix against the exact reproduction from
   step 2, plus a quick check nothing adjacent broke. Don't re-run the
   whole test/regression suite unless the change plausibly affects it.
6. LINT/TYPECHECK/BUILD — `npm run lint`, `npx tsc --noEmit`,
   `npm run build`.
7. REPORT — what was wrong, what changed, what was verified.

Do not expand scope beyond the reported issue. If you discover a second,
unrelated problem while investigating, report it — don't fix it in the
same pass unless asked.

Never commit. Never push.
