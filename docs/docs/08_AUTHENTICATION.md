# 08 — Authentication

## Method

Supabase Auth, email/password as the primary method (magic-link as an acceptable alternative if simpler for non-technical staff — decide and document which, don't support both ambiguously). No anonymous auth, no self-signup — every account is created by an owner invite.

## Flows

1. **Invite**: Owner (or anyone with `team.manage`) enters name + mobile/email in Settings → Team → Add Member. System creates a `profiles` row in `invited` state and sends an invite link (email or WhatsApp utility template — see `docs/10`) containing a one-time setup link.
2. **First login**: invited user opens the link, sets a password (or confirms magic-link), lands directly on their role-appropriate home screen (Azhar → Today list; Owner → Dashboard).
3. **Session persistence**: standard Supabase session/refresh-token handling; "stay signed in" on mobile by default since this is a daily-use work tool.
4. **Sign out**: clears session and any per-viewer local cache (see PWA doc for offline-cache clearing on logout).
5. **Password reset**: standard reset-link flow.
6. **Deactivation**: owner toggles a member to inactive in Settings → Team. Their session is invalidated server-side (not just hidden in UI) and `user_permissions` are cleared, while their historical records remain attached to their name for audit/reporting continuity.

## Protected routes

Every route beyond the login screen requires a valid session. Role-aware redirect: a user with no `reports.view` permission who tries to open `/reports` gets redirected with an explanation, not a blank/broken page. This is a UX nicety on top of the real enforcement, which is server-side RLS/RPC checks (`docs/07`).

## Service identities (non-human actors)

Two automated actors need credentials distinct from any human staff member, each scoped to the minimum it needs:

- **AI sales agent** (WhatsApp-facing): can read/write `message_events`, `ai_suggestions`, propose field extractions and deal updates within its allowed action set (`docs/11`). Cannot authenticate as, or inherit permissions from, any human user.
- **Telegram manager agent**: can read reporting data and `lead_score_history`/`deal_stage_history` for answering owner questions, and can write `notifications`/nudges. Cannot record payments, change permissions, or mark deals Won (`docs/13`).

Both run under Supabase service-role access inside server-side functions only — never a key shipped to any client, bot process, or n8n-style workflow running outside the trusted backend.

## What NOT to build in v1

- No SSO/OAuth (unnecessary complexity for a 2–10 person team).
- No multi-factor auth requirement in v1 — can be added later without a data-model change if the owner asks.
