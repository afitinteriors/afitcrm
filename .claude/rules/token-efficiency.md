# Token Efficiency

Mandatory. Expands CLAUDE.md's Token / Context Efficiency section —
CLAUDE.md wins on conflict. Claude Code must minimize unnecessary token
consumption on this project:

- Do not repeatedly re-read files that haven't changed since they were
  last read this session.
- Do not repeat a Playwright test that already passed unless the code it
  covers actually changed.
- Do not run redundant shell commands (re-running a check that already
  gave a conclusive answer).
- Do not create huge reports or write conversation history into
  `CLAUDE.md` or any `.claude/` file — see the `doc-writer` agent's
  rules.
- Keep phase scope narrow; use `/clear` after completing a phase.
- Preserve permanent rules in compact documentation, not narrative form.
- Spend tokens on implementation and meaningful verification, not
  repeated context reconstruction.
