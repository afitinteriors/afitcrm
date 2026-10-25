# Skills

Skills package reusable operational knowledge Claude Code can invoke by
name. They hold *how to do something*, not project rules (those live in
`CLAUDE.md` and `.claude/rules/`) and not narrow one-off workflows (those
are `.claude/commands/`).

| Skill | Purpose |
|---|---|
| `ui-ux` | AFIT design system, UI-first approach, progressive disclosure, desktop/mobile distinction, stage-aware Lead Detail. |
| `playwright` | General browser-verification methodology: viewports, role testing, overflow checks, targeted regression, evidence-based reporting. |
| `supabase` | How to inspect live schema/RLS/auth safely before assuming, and how to avoid unnecessary schema changes or client-side-only security. |
| `deployment` | Production-safety methodology: env vars, build verification, deployment verification, smoke tests. |
| `crm-workflow` | AFIT's business workflow: pipeline stages, stage-aware Lead Detail, Won/Lost rules, Follow-ups, Admin/Staff boundaries. |
| `afit-verify` *(pre-existing)* | This project's exact, explicit-invocation verification procedure — the concrete implementation of what `playwright` describes in general terms. |
| `ui-ux-pro-max` *(pre-existing, vendored)* | Generic design-exploration tool (styles/palettes/typography database). Use only for genuine design exploration, never as a source of truth — CLAUDE.md's design system is authoritative for this project. |

None of these duplicate `CLAUDE.md` — each links back to the relevant
CLAUDE.md section or `.claude/rules/` file as the authority, and holds
only the reusable "how," not the project's mandatory rules.
