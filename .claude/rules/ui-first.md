# UI-First Rule

**UI/UX FIRST → BACKEND SECOND.** Expands CLAUDE.md's UI/UX Rules &
Design System section — CLAUDE.md wins on conflict.

For any new CRM functionality, in this order:
1. Establish the user flow.
2. Define desktop behavior.
3. Define mobile behavior.
4. Define Admin vs Staff behavior.
5. Implement the UI.
6. Only then determine backend/data requirements.
7. Implement only the backend support the UI actually needs.

## Mandatory
- Do not create schema, a table, or a backend structure merely because it
  seems convenient or "for later" — see CLAUDE.md's Current Database
  Reality section and `.claude/rules/database.md`.
- If backend persistence turns out to be genuinely required to finish the
  UI, stop and report the dependency explicitly rather than building it
  silently.
