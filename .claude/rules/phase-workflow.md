# Phase Workflow

Permanent, non-optional loop for every session. Expands CLAUDE.md's
Development Workflow section — CLAUDE.md wins on conflict.

```
ONE PHASE → UI DESIGN → IMPLEMENT → TARGETED FULL TEST → REPORT → /clear → NEXT PHASE
```

- Work exactly one phase per session. Never silently start the next
  phase after finishing one — stop and wait for `/clear` and a new
  instruction.
- Do not ask "should I continue?" as a way to keep going in the same
  turn — actually stop.
- This applies even when the next phase looks small or obvious.
- The `/phase <scope>` command encodes this loop for CRM feature work.
