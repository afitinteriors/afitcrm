# Testing

Required quality gates before any phase is done. Expands CLAUDE.md's
Testing Rules section — CLAUDE.md wins on conflict.

```
npm run lint
npx tsc --noEmit
npm run build
```

- Use Playwright (or the `afit-verify` skill, which encodes this
  project's exact procedure) for actual browser behavior — don't claim a
  UI works from source inspection alone when live verification is
  available.
- Standard responsive targets: 1440×900 (desktop), 390×844 and 375×812
  (mobile).
- Test both Admin and Staff roles when the change touches anything
  role-gated.
- Test only the areas actually affected by the change. Do not re-run
  tests that already passed against code that hasn't changed since.
