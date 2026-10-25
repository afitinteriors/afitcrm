# CLAUDE.md — AFIT CRM + WhatsApp Automation + AI Agent
**This file is read automatically by Claude Code every session. It is the source of truth for build order, architecture and rules. Read it completely before touching any file.**

Business: AFIT Interiors — gypsum plastering (primary service, build first) and interior design/production (second service line, structure now, activate later).
Owner: Afsal ("afs"). Operator: Azhar (owner's brother, runs leads/sales day to day). Team size today: 2. Must support adding more staff later with zero new code — only Settings → Team.

---

## 0. Critical build rules

0. **No-code for the owner — read `docs/00_NO_CODE_REQUIREMENT.md` before anything else.** The owner is not a developer and will never edit code, config files, or the database to run this business. Automation rules are built and changed through a visual drag-and-drop workflow builder in the app (`docs/00`, `docs/12`). The AI agent is trained through an example-based interface in the app (`docs/00`, `docs/11`), never a prompt file. Team, permissions, pipeline stages, keywords, and message templates are all editable from Settings screens, never by a developer touching a file. Treat these Settings screens as required core product scope, not optional admin extras.
1. **Audit before editing.** Inspect the repository, current branch, latest commits, existing `crm/` files, Supabase project/migrations, generated types, and environment files. Report what exists before changing anything.
2. **Continue from the current repository.** Do not create a replacement project or duplicate an existing feature.
3. **Locked stack:** React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui + Lucide Icons + React Router + TanStack Query + Zustand + React Hook Form + Zod + PWA. Backend: Supabase (Postgres, Auth, Storage, Edge Functions, Cron).
4. **CRM location:** top-level `crm/` directory beside existing `lib/`, `supabase/`, `docs/` — verify this is still accurate before assuming it.
5. Any existing Flutter QR Ordering/Admin app or Broastin-related code is unrelated to AFIT and must remain untouched. **Never assume the Broastin Supabase project is the AFIT backend** — verify target project identity explicitly before any write.
6. **No production mutation without approval.** Inspect migrations/remote state read-only first. Never apply migrations, change RLS/auth settings, seed production data, or enable live WhatsApp sending without explicit approval.
7. Never expose secrets (Supabase service-role key, Meta access token, AI provider key, Telegram bot token) in code, logs, screenshots, README, or committed files. Use environment variables and `.env.example` placeholders only.
8. Build frontend-first with mock data → every primary screen → responsive/empty/loading/error states → reviewed backend integration. Every button works or is explicitly disabled/labelled "coming soon." No dead controls, no fake success toasts, no hard-coded dashboard numbers once connected to real data.
9. Keep UI, domain/business logic, data-access/repository and presentation layers separate. Mock repositories must be swappable for Supabase repositories without rewriting screens.
10. After each milestone: run typecheck, lint, tests, production build. Report exact files changed and unresolved issues.
11. Maintain `README.md`, `CHANGELOG.md`, `DEVELOPER_HANDOVER.md` as you go.
12. Do not claim a phase "complete" until its acceptance criteria in `docs/18_IMPLEMENTATION_PLAN.md` pass. Document any skipped feature as blocked with a reason — never skip silently.
13. **Primary language: English** for all UI labels, code, docs and comments. Malayalam is a per-user Settings toggle only (not the default), and is required only for the AI WhatsApp agent's customer-facing replies (see `docs/11_AI_SALES_AGENT.md`).
14. **Rules/automation before AI.** The deterministic rules engine and workflow engine (follow-up timers, stage logic, notifications) must work completely without any AI model or external provider configured. AI is an assistive layer added after the deterministic system is tested — see `docs/12_AUTOMATION_RULES_ENGINE.md`.

---

## 1. Read order for a coding agent

0. `docs/00_NO_CODE_REQUIREMENT.md` — read this first, it governs every other doc
1. `docs/01_PRODUCT_OVERVIEW.md` — what this system is and is not
2. `docs/02_REQUIREMENTS.md` — functional requirements, non-goals
3. `docs/03_ROLES_AND_PERMISSIONS.md`
4. `docs/09_PIPELINE_AND_LEAD_LIFECYCLE.md` — the core workflow everything else hangs off
5. `docs/04_UI_UX_SPECIFICATION.md` + `docs/14_PWA_SPECIFICATION.md`
6. `docs/05_DATABASE_ARCHITECTURE.md` + `docs/06_DATABASE_SCHEMA.md`
7. `docs/07_SECURITY_AND_RLS.md` + `docs/08_AUTHENTICATION.md`
8. `docs/10_WHATSAPP_META_INTEGRATION.md`
9. `docs/11_AI_SALES_AGENT.md`
10. `docs/12_AUTOMATION_RULES_ENGINE.md`
11. `docs/13_HERMES_TELEGRAM_MANAGER_AGENT.md`
12. `docs/15_REPORTS_AND_DASHBOARD.md`
13. `docs/16_SUPABASE_SETUP.md`
14. `docs/17_TEST_PLAN.md`
15. `docs/18_IMPLEMENTATION_PLAN.md` — phase order, do not skip ahead
16. `docs/19_DEVELOPER_HANDOVER.md`

---

## 2. Master instruction to paste to the coding agent

> You are the implementation engineer for the AFIT CRM, WhatsApp automation and AI sales agent. Read every file in `docs/` in the order listed in this CLAUDE.md and follow it as the product specification. Start with Phase 0 only: audit the existing repository and Supabase configuration read-only. Do not modify files, apply migrations, seed data, enable live WhatsApp/Meta sending, or deploy until you provide the audit report and the exact proposed changes. Preserve the locked stack. Keep any existing Flutter app untouched. Verify the correct Supabase project identity — do not assume the Broastin project is the AFIT backend. After Phase 0, proceed one phase at a time (`docs/18_IMPLEMENTATION_PLAN.md`), making the smallest safe changes, running tests, and maintaining README.md, CHANGELOG.md and DEVELOPER_HANDOVER.md. Never fake API success, WhatsApp delivery, AI replies, payment status or approvals. Deterministic rules and workflows must work with AI and messaging providers fully disabled. Stop and request approval before production writes, migrations, enabling live outbound WhatsApp messages, or deployment. At the end of each phase, report changed files, tests and results, migrations, risks, limitations and the next phase.

---

## 3. What "no involvement" can and cannot mean

A detailed spec reduces back-and-forth; it cannot deliver a fully working production system with literally zero owner involvement. The coding agent still needs: repository access, the correct Supabase project, credentials supplied securely (never pasted into chat/prompts), a Meta Business/WhatsApp Business Account verified by the owner, a deployment target, and explicit approval for production-impacting or paid-provider changes. Build and test mock-backed phases autonomously; request approval only for consequential backend/production/paid-integration steps.
