# Hooks

## Supported mechanism

Claude Code hooks are configured in `.claude/settings.json` (or
`.claude/settings.local.json` for a machine-local, untracked override) —
not by dropping arbitrary instruction files into `.claude/hooks/`. A hook
entry in `settings.json` names an event (e.g. `PreToolUse`), a `matcher`
(a tool name or pattern), and a `command` to run; `.claude/hooks/` is just
the conventional place to keep the actual scripts `settings.json` points
at. This README documents that real mechanism rather than inventing a
fake `.claude/hooks/*.md` config format.

## Currently configured

One hook, **`git-and-schema-safety`**
(`.claude/hooks/git-and-schema-safety.sh`), registered in
`.claude/settings.json` under two `PreToolUse` matchers:

1. **`Bash`** — inspects the command string for `git commit`, `git push`
   (including `--force`/`--force-with-lease`), `git reset --hard`, or
   `git clean -f`.
2. **Five specific Supabase MCP tool names** — `apply_migration`,
   `pause_project`, `delete_branch`, `reset_branch` unconditionally, and
   `execute_sql` only when its `query` input contains
   `CREATE`/`ALTER`/`DROP`/`TRUNCATE`.

On a match it returns `permissionDecision: "ask"` — it never hard-blocks
and never silently allows. A genuinely approved commit/push/migration
still proceeds through Claude Code's normal permission prompt; the hook's
only job is making sure that prompt can never be silently skipped for
these specific operations.

## What this protects

- Accidental or unreviewed `git commit` / `git push` (including a force
  push).
- Destructive git operations (`reset --hard`, `clean -f`).
- Schema-mutating or project-lifecycle-mutating Supabase operations
  (migrations, DDL via `execute_sql`, pausing/deleting/resetting a
  project branch).

## What is intentionally NOT hooked

- **No automatic-deploy or automatic-commit hook exists, and none should
  be added.** Deployment and commits stay a deliberate, per-turn human
  decision (CLAUDE.md's Deployment Rules; `.claude/rules/deployment.md`).
- Ordinary reads, lint/typecheck/build, and non-destructive Bash commands
  are not intercepted — the hook is deliberately narrow so normal
  development stays fast.
- Phase boundaries, UI-before-backend ordering, and scope discipline are
  **not** hook-enforced — they stay behavioral (CLAUDE.md's Development
  Workflow, `.claude/rules/phase-workflow.md` and `ui-first.md`), since a
  hook can only inspect one tool call at a time and can't judge whether a
  whole session is staying in scope.
- No `PostToolUse`, `SessionStart`, or other hook events are currently
  used — add one only if a concrete, recurring risk justifies it; don't
  add hooks speculatively, and don't add anything that makes routine
  development noticeably slower.
