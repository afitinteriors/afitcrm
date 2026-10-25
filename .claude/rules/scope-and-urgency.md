# Scope & Urgency

Mandatory. Expands CLAUDE.md's Claude Code Scope Enforcement section —
CLAUDE.md wins on conflict. This is the authoritative rule for scope
discipline, urgency handling, and syllabus boundaries across every phase.

## Syllabus boundary

The user's syllabus/implementation plan is the source of truth for what
phase we're in and what's in scope. Before implementing, determine:
- What exact phase are we in, and what exact requirement is being
  implemented?
- What is explicitly in scope? What is explicitly out of scope?
- What existing functionality must remain untouched?

If the requested work is ambiguous or conflicts with the syllabus, **stop
and ask** before expanding scope. Never infer permission to expand scope
from: roadmap items, TODOs, code comments, "future improvement" ideas,
common CRM patterns, or your own architectural preferences.

## Scope discipline

Work only on: (1) the exact current phase, (2) the exact current
requirement, (3) directly necessary dependencies, (4) verification of
what was implemented. Anything outside that requires explicit user
approval.

Never:
- Invent new phases, features, or scope expansion.
- Redesign or refactor unrelated areas.
- Introduce speculative architecture.
- Create a table, field, component, abstraction, API, dependency,
  automation, or route "because it might be useful" or "because CRMs
  usually have this" — see `.claude/rules/database.md` and
  `ui-first.md`.
- Start future roadmap work early.
- Perform unrelated cleanup while doing a small task.
- Turn a small task into a broad audit.
- Continue into the next phase automatically.

## Minimum change rule

Prefer the smallest correct change that satisfies the actual requirement.
Before adding a new table/field/component/abstraction/API/dependency/
automation/route, verify the existing system cannot already satisfy the
requirement, and confirm you aren't duplicating an existing source of
truth.

## No speculative work

Never implement something merely because "we may need this later" —
hypothetical integrations, speculative analytics, unused schema/APIs,
future UI/permissions/automation/reporting are all out of scope unless
the current syllabus explicitly requires them now.

## Phase discipline

```
PHASE → INSPECT → UI/UX FIRST → IMPLEMENT → TARGETED TEST →
QUALITY GATES → REPORT → STOP → /clear → NEXT PHASE
```
One phase per session (see `.claude/rules/phase-workflow.md`). Never
combine multiple syllabus phases just because they're technically
related, and never auto-start the next one.

## Urgency rule

An explicitly identified urgent task follows the same discipline, faster:

```
URGENT TASK → INSPECT ONLY RELEVANT EXISTING SYSTEM →
IDENTIFY MINIMUM REQUIRED CHANGE → IMPLEMENT MINIMUM REQUIRED CHANGE →
TARGETED TEST → REQUIRED QUALITY GATES → REPORT → STOP
```
Urgency means: less unnecessary investigation, less token usage, sharper
focus on the requested business outcome, no unnecessary architecture
change. Urgency never means: skip security, skip testing, bypass existing
architecture, modify unrelated systems, or deploy blindly.

## Security boundary — never overridden by scope or urgency

Always preserve authentication, authorization, RLS, server-side
validation, webhook verification, and secret protection (full detail in
`.claude/rules/security.md`). Never replace server-side security with UI
hiding, and never weaken security to make a phase faster or easier —
not even under urgency.

## Testing boundary

Testing must be proportional: targeted Playwright coverage for affected
UI/flows, plus `npm run lint` / `npx tsc --noEmit` / `npm run build` (see
`.claude/rules/testing.md`). Don't repeatedly run unrelated exhaustive
tests when nothing relevant changed, and don't claim a feature is
complete without verifying the actual affected behavior.

## Production safety

Never automatically commit, push, or deploy, regardless of urgency (see
`.claude/rules/deployment.md`). Never deploy stale/old code just because
a deployment feels urgent — verify the exact intended
code/version/commit first.

## Meta / WABIS urgency boundary

When the current urgent task is Meta/WABIS/webhook-related:
- Prioritize the exact requested integration only.
- Do not redesign the CRM or build unrelated CRM modules while doing it.
- Do not modify WABIS production configuration without explicit
  approval, and do not replace existing messaging infrastructure without
  evidence that it's actually required.
- Inspect first: the existing webhook endpoint, its auth/signature
  verification, the actual payload shape, lead mapping, attribution
  data, and storage flow — then implement only what this task requires.
- Never invent Meta attribution or conversion data. Clearly distinguish,
  in any report: (1) data actually received, (2) data actually stored,
  (3) data actually sent back, (4) a real optimization capability this
  enables, and (5) data that is simply unavailable — never blur these
  into one claim.

## Token / context discipline

Don't re-read unchanged files, don't repeat an investigation already
completed this session, don't repeat a passed test with no relevant code
change, don't generate giant reports, don't copy large documentation into
a prompt, don't duplicate `CLAUDE.md` content, don't reconstruct old
conversation history unnecessarily (see `.claude/rules/token-efficiency.md`).
Permanent rules belong in project configuration (`CLAUDE.md`,
`.claude/rules/`); phase-specific work belongs in the current task only.
End every phase: **REPORT → STOP → `/clear`.**
