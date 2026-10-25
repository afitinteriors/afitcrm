# 03 — Roles and Permissions

Least privilege. Enforce in the UI *and* at the backend/RLS layer — hiding a button is never security (see `docs/07_SECURITY_AND_RLS.md`).

## Design: permissions, not just roles

The owner manages 2 people today and will add more over time. Rather than hard-coding 5 fixed roles, the system has:

- A **permission catalogue** (a fixed, named list of atomic capabilities).
- **Role presets** (Owner, Sales/Operator, Site Supervisor, Accountant — pre-checked combinations an admin can start from).
- **Per-member overrides** — the owner can tick/untick individual permissions for any member regardless of preset, from Settings → Team.

This is what lets the owner's Settings screen say "click add name, mobile or email — tick what they can do" without a developer touching code for every new hire.

## Permission catalogue (initial set)

| Permission key | Meaning |
|---|---|
| `leads.view` | See lead list and detail (scoped to assigned leads unless `leads.view_all`) |
| `leads.view_all` | See all leads regardless of assignment |
| `leads.create` | Manually create a lead |
| `leads.call` | Use the Call button and log outcomes |
| `leads.edit` | Edit lead/customer fields |
| `quotations.create` | Draft a quotation |
| `quotations.approve_discount` | Approve a discount above the configured threshold |
| `quotations.send` | Send an approved quotation to a customer |
| `projects.view` | See project/work-pipeline records |
| `projects.update_status` | Move a project between work-pipeline stages |
| `finance.view_company_profit` | See company-wide margin/profit figures |
| `finance.record_payment` | Record a customer payment received |
| `team.manage` | Add/deactivate members, change permissions |
| `settings.manage` | Change automation rules, service catalogue, integrations |
| `reports.view` | See dashboards and reports |
| `audit.view` | See the audit log |

Permission keys are typed/allow-listed in code — the Settings UI never accepts an arbitrary string.

## Role presets (starting points, editable per member)

**Owner/Admin** — every permission. Cannot bypass the immutable audit log.

**Sales / Operator (Azhar today)** — `leads.*` except `leads.view_all` initially (owner can grant it), `quotations.create`, `quotations.send`, `projects.view`. No `finance.view_company_profit`, no `quotations.approve_discount` above threshold, no `team.manage`.

**Site Supervisor** (future hire) — `leads.view` (assigned only), `projects.view`, `projects.update_status` (assigned sites only). No quotation or finance access.

**Accountant** (future hire) — `finance.record_payment`, `reports.view`, `finance.view_company_profit`. No lead-calling or quotation permissions by default.

## Enforcement rules

1. Every permission check happens **server-side** (Supabase RLS policy or RPC check), independent of what the client sends. A hidden button is a UX nicety only.
2. A member cannot approve their own exceptional discount unless policy explicitly allows self-approval below a configured ceiling.
3. Deactivating a member revokes access immediately but preserves their name on historical records (`created_by`, `assigned_to` references stay intact).
4. Changing anyone's permissions is written to `audit_logs` with actor, target, before/after permission set, and timestamp.
5. The AI agent and the Telegram manager agent act under a **service identity** with its own fixed, narrow permission set (see `docs/11_AI_SALES_AGENT.md` and `docs/13_HERMES_TELEGRAM_MANAGER_AGENT.md`) — never under an impersonated staff member's permissions.

## Settings → Team screen requirements

- Add member: name + mobile or email → sends invite link. No password set by admin.
- Role preset dropdown + full permission checkbox grid (see `04_UI_UX_SPECIFICATION.md` for the screen spec — this matches the published mockup).
- Deactivate / reactivate toggle.
- Per-member activity: last login, leads assigned, last action — visible to `team.manage` holders only.
