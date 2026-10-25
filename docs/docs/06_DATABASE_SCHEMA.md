# 06 — Database Schema

Audit the existing repository's schema first (`CLAUDE.md` §0.1) — this list is the target shape, not a blind migration script. Adapt names to match what already exists where it's reasonable to do so; do not create duplicate equivalents of existing tables.

## Identity & access

- `profiles` — user profile linked to Supabase Auth user (name, phone, avatar, active flag).
- `permissions` — the fixed permission catalogue (see `docs/03`).
- `role_presets` — named starting bundles of permissions.
- `user_permissions` — per-user effective permission grants (preset + overrides).
- `company_settings` — business name, branding, timezone, numbering formats, follow-up timer defaults.

## Core CRM

- `customers` — one per normalized phone number. Name, phone, WhatsApp number, email, locality, tags, notes.
- `service_types` — Gypsum Plastering, False Ceiling, Interior Design, Interior Production (extensible).
- `deals` — one per (customer, service). Stage, temperature/score, assigned owner, pipeline type (sales/work), estimated value, source references.
- `deal_stage_history` — append-only: deal_id, previous stage, next stage, actor, reason, timestamp.
- `lead_activities` — calls, messages, notes, meetings tied to a deal; the single activity timeline.
- `call_logs` — call_id, deal_id, staff_id, started_at, ended_at, outcome (nullable until resolved = `pending_outcome` blocks "handled" status), next_follow_up_date, note.
- `site_visits` — visit_id, deal_id, scheduled_at, assigned_staff, status (Scheduled/Confirmed/Completed/Cancelled/No Show), measurement reference.
- `measurements` — visit_id, zone, length/width/height or sqft, unit, measured_by, photo references.
- `quotations` — quotation_id/number, deal_id, version, status (Draft/Sent/Accepted/Rejected/Expired/Revised), total, validity date, PDF reference.
- `quotation_lines` — quotation_id, description, quantity, unit, rate, line total. Internal cost/margin fields are never exposed to the customer-facing PDF.
- `projects` — created only from a Won deal. project_id, deal_id, service, stage (work pipeline), manager, dates, budget.
- `project_tasks` — work-pipeline checklist items (e.g. "Scheduled," "In Progress" daily photo log reference).
- `payments` — payment_id, deal_id/project_id, amount, date, mode, reference, received_by.
- `lost_reasons` — lookup table: price, timing, competitor, no response, scope mismatch, cancelled, invalid, other.

## WhatsApp / messaging

- `message_conversations` — customer_id, deal_id (nullable until service resolved), channel, external_thread_id, window state (service-window expiry, CTWA-window expiry).
- `message_events` — conversation_id, direction (in/out), body reference (access-controlled, not full-text searchable by unauthorized roles), template/free-form flag, provider message ID (idempotency key), status, timestamps.
- `ad_referrals` — deal_id, `ctwa_clid`, `source_id`, ad headline, captured_at (captured once, from the first inbound message only — see `docs/10`).
- `whatsapp_templates` — name, category (marketing/utility/authentication), approval status, body.
- `contact_preferences` — customer_id, channel, consent state, opt-out timestamp and evidence.

## AI & automation

- `service_keywords` — service_type_id, keyword/phrase, language, active flag (the editable keyword list from `docs/11`, managed entirely from Settings — see `docs/00_NO_CODE_REQUIREMENT.md`).
- `ai_training_examples` — service_type_id, conversation transcript or single exchange, label (good example / bad example / correction), entered_by, created_at — powers the no-code AI training screen (`docs/00` §2, `docs/11`).
- `ai_question_sets` — service_type_id, ordered list of qualifying questions, editable via drag-to-reorder in Settings.
- `ai_suggestions` — entity reference, suggestion type (field extraction/intent/reply draft/next action), proposed content, confidence, status (pending/accepted/rejected/edited), reviewer, timestamps.
- `lead_score_history` — deal_id, score, band, policy version, reason codes, scored_at.
- `automation_rules` — name, trigger, condition JSON (schema-validated, not arbitrary code), action, execution mode (automatic/draft-for-review/manual), enabled, priority, version.
- `workflow_instances` — workflow name/version, related entity, current state, status, correlation/idempotency key.
- `workflow_steps` — ordered step, status, attempts, error, timestamps — for resumable retries.
- `automation_jobs` — scheduled/queued work (timer checks, nightly reports), run time, lock, attempts.
- `notifications` — in-app notification: type, recipient, read state, deep link, created_at.
- `telegram_sessions` — owner's linked Telegram chat ID, last interaction, scheduled-report preference (see `docs/13`).

## Governance

- `audit_logs` — actor, action, entity, before/after (redacted of secrets), timestamp, correlation ID. Covers permission changes, Won-deal conversions, overrides, deletions.
- `idempotency_keys` — used by any RPC that must not duplicate on retry (lead intake, Won conversion, payment recording).
- `documents` — metadata for private Storage objects (quotation PDFs, site photos): entity reference, category, uploaded_by, access classification. Files live in private Supabase Storage buckets with short-lived signed URLs — never a public bucket by default.

## Data-model rules

- Every table has a clear owner/scope and an RLS policy (`docs/07`).
- `deal_id`, `customer_id`, `created_by` used consistently wherever relevant, indexed.
- Sent/approved documents (quotations) are versioned, never mutated in place after Sent.
- Posted payments and approved call outcomes are corrected via new rows, never silently edited.
- Unique constraints on document numbers (quotation number, project code) enforced at the database level, generated via `number_sequences` (see `docs/05`).
- Multi-row transactional operations (receipt allocation, Won-deal conversion, call-outcome save) run as RPCs.
