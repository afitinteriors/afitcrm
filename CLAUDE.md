# AFIT CRM — Permanent Project Rules

Read this file in full before touching code, every session. It is the single
source of truth for this project's architecture. Don't re-derive these
decisions from scratch or accept a prompt that contradicts them without
flagging the conflict first.

This file was restructured on 2026-09-05 to fix a size problem (it had grown
to 215k+ characters via verbose per-session logs, in direct violation of the
Token/Context Efficiency rule below). Full historical detail for anything
summarized in the Completed Work Log lives in `git log` / commit messages —
this file keeps only what a future session needs to know *before* writing
code.

---

## Product Strategy

**Desktop = management/workspace.** Full CRM operations: pipeline
management, detailed lead/customer info, commercial info, quotations,
site-visit management, follow-ups/tasks, conversations, reports,
automation, audit log, admin/settings.

**Mobile = daily field/work execution.** Primary (bottom bar, every role):
Home, Leads, Chats (Conversations), Tasks (Follow-ups) — exactly 4 tabs.
Secondary (mobile-reachable via the More menu's Work section, not the
bottom bar, every role): Site Visits, Deals, Quotations. Quick actions,
status updates, calling/WhatsApp, and notes are embedded within these
surfaces, not separate nav destinations.

Rules:
- Do NOT shrink the desktop UI onto mobile. Build two intentional surfaces.
- Do NOT expose every desktop module on mobile.
- Automation, Audit Log, and Settings are desktop/admin-only for primary
  navigation — never in the primary bottom bar, never visible to staff on
  mobile at all. On mobile they exist only inside the More menu's
  admin-only Management/System sections.
- The bottom bar stays at 4 tabs. Anything mobile-relevant beyond that goes
  in More, not a 5th+ tab (this is why Site Visits was moved out of the bar
  in the 2026-08-30 mobile nav restructure — see Completed Work Log).
- Mobile prioritizes what a salesperson needs *during the day*, not parity
  with desktop.

---

## UI/UX Rules & Design System

Build the design system before any page; every screen consumes these
tokens, nobody redefines a hex code inline. Already implemented in
`app/globals.css` / `@theme inline` (Phase 0a):

| Token | Value |
|---|---|
| Primary green | `#16A34A` (gradient variants for buttons) |
| Dark background | gradient `#0B1210` → `#0F1A14` |
| Glass card fill | `rgba(255,255,255,0.06)` |
| Text primary | `#FFFFFF` |
| Text secondary | `#A3A3A3` |
| Error | `#EF4444` |
| Font | Inter (`lib/fonts.ts`, `--font-brand`) |

Effects: subtle glassmorphism on cards, green gradient on primary buttons,
soft glow/particle accents on dark backgrounds (used sparingly — this is a
CRM, not a landing page). Rounded corners throughout, consistent radius.

Avoid: generic AI-slop patterns — accent stripes/color bars under titles,
default-blue palettes, cream/beige backgrounds, low-contrast icon-on-dark
combos. This brand has a real identity (dark green chrome); don't dilute it
with default component-library styling.

**UI-first rule**: for every product phase, design/approve the UI direction
*before* implementation; only do backend/data work when a phase genuinely
requires it. Don't create backend structures speculatively "for later." If
persistence is genuinely required to finish a phase, stop and report the
dependency explicitly rather than building it silently (this is why the
WhatsApp Numbers Settings UI stayed a local-state prototype instead of
getting a table on the spot).

**Known remaining cosmetic debt**: `/conversations` components still use
some raw Tailwind `slate-*` colors rather than design tokens in a few spots
(low priority, not urgent).

---

## Desktop vs Mobile — Navigation

Desktop sidebar (all confirmed real nav items): Dashboard, Leads, Deals,
Site Visits, Quotations, Follow-ups, Conversations, Reports, Automation
(admin), Audit Log (admin), Settings (admin).

Mobile bottom bar (both roles): Home, Leads, Chats, Tasks. Mobile More menu
(`MobileMoreMenu.tsx`): a `Work` group (Site Visits, Deals, Quotations)
always renders; `Management` (Automation, Audit Log) and `System`
(Settings) render only when the user is admin.

**Unconfirmed / deprioritized nav modules** — do not start a build phase
for any of these without asking again first; a prior master planning brief
omitted them entirely from the intended nav:
Customers, Services, Team, Mission Control, Documents.

---

## Lead/Pipeline Architecture

**Exactly 8 user-facing pipeline stages:**
1. New
2. Contacted
3. Qualified
4. Site Visit
5. Quotation
6. Negotiation
7. Won
8. Lost

`Invalid` may exist internally for schema/data compatibility but is
**never a user-facing pipeline stage.**

The closed/default Lead Detail UI shows **only the current stage** — never
the full New→...→Lost chain as a permanent section. The stage selector may
expose all 8 when opened; the rest of the page stays compact.

**Stage-aware Lead Detail** (implemented via `lib/lead-stage-sections.ts`'s
`STAGE_SECTIONS` config, gating which sections/actions render per stage —
do not display irrelevant future-stage sections, e.g. no Commercial UI on
a brand-new lead):

```ts
const STAGE_SECTIONS: Record<PipelineStage, SectionKey[]> = {
  New:         ["overview", "qualification", "followUp", "nextAction", "moveToContacted"],
  Contacted:   ["conversation", "followUp", "qualification", "nextAction", "moveToQualified"],
  Qualified:   ["qualification", "siteVisitAction", "followUp", "nextAction", "moveToSiteVisit"],
  "Site Visit":["siteVisitInfo", "followUp", "notes", "nextAction", "moveToQuotation"],
  Quotation:   ["quotationInfo", "followUp", "nextAction", "moveToNegotiation"],
  Negotiation: ["commercial", "followUp", "nextAction", "moveToWonLost"],
  Won:         ["wonInfo", "commercial", "history"],       // no Mark Won action
  Lost:        ["lostInfo", "history"],                     // no Mark Lost action
};
```

**Won/Lost safety — do not remove:**
- Won requires `job_value`. Lost requires `lost_reason`.
- `setLeadStatus()` (generic) must reject direct writes of `Won`/`Lost`
  server-side. This protection exists — **never remove it.**
- Won/Lost can only be set through `markLeadWon()` / `markLeadLost()`,
  which enforce their required fields.
- The stage selector may list all 8 stages, but selecting Won/Lost routes
  into the proper close workflow, never a bare status write.

**Qualification Score vs Pipeline Stage — do not conflate.** Pipeline
stage = where the lead is in the sales process. Qualification score = how
strong/qualified the lead is, computed deterministically from real fields
(no AI/external calls, no fabricated inputs). Different concepts, different
owners on the page — never merge into one number or card.

**Next Action**: surface the next operational action prominently when one
genuinely exists (call, schedule site visit, send quotation, follow up,
negotiate, close). Don't invent a fake task to fill the slot.

**Calling scope**: "Call" today means a plain `tel:` link — nothing more.
Don't claim or imply access to call audio/transcripts/duration/keywords
unless a call is actually routed through a supported telephony provider
(it isn't). A future telephony pipeline is plausible scope but needs
explicit approval before any of it is built.

---

## Current Database Reality

Live tables: `leads`, `profiles`, `conversations`, `messages`,
`follow_ups`, `audit_logs`, plus the automation track's `services`,
`service_keywords`, `automations`, `automation_runs`, `automation_sessions`,
`automation_media` (see Completed Work Log), plus the approved push-notification
tables `push_subscriptions` and `notifications` (owner-only RLS; history/state
only, not a queue).

There is currently **no** `deals`, `quotations`, `site_visits`, `reports`,
or `admin_settings`/`whatsapp_numbers` table.

Lead fields include `status`, `job_value`, `quotation_amount`,
`site_visit_date`, `lost_reason`, plus Meta Ads attribution fields
(`campaign_name`, `adset_name`, `ad_name`, `ad_id`).

**Do not create new tables without explicit approval.** Build UI-level
views over existing fields first; only promote to real schema once the
UI-level version has hit a real limit. Deals, Site Visits, and Quotations
are all currently UI-level views over `leads` columns, not real entities —
keep them that way unless explicitly told to add schema.

---

## Auth / RLS / Security

Baseline pattern (verified, do not weaken):
```
leads SELECT: private.is_admin() OR assigned_to_id = auth.uid()
leads INSERT: admin or self
leads UPDATE: admin or owner
```
Staff see only their own assigned leads. Admin sees all. Every other table
in this project follows the same admin-or-owner shape. **Never replace
database security with UI-only hiding**, and never weaken or bypass RLS to
make a UI problem easier to solve.

Key learned RLS behavior (Postgres, confirmed via live testing, applies
project-wide): an `UPDATE`/`DELETE` policy alone is not sufficient — the
target row must also be visible via *some* applicable `SELECT`-type policy
for the calling role, independent of the `UPDATE` policy's own `USING`
clause. Always pair a narrow `UPDATE` policy with a matching `SELECT`
policy when adding new write access.

RLS performance: wrap `auth.uid()`/`private.is_admin()` calls in RLS
policies as `(select auth.uid())` etc. (InitPlan optimization) — this was
retrofitted across all 16 existing policies on 2026-09-03; keep doing this
for any new policy.

**Permission specifics**: Staff must never be able to — reassign leads,
bulk-export leads, manage users/roles, change security settings, or view
audit logs, including via direct API/URL access, not just hidden UI.
Admin-only: manage staff, manage system settings, manage WhatsApp
configuration, bulk export (not built yet; when built, must be admin-only
and server-enforced).

Treat as sensitive (never in logs, error messages, or diagnostics): phone
numbers, emails, customer names, addresses, lead notes, conversation
contents, WhatsApp identifiers, call info. Never log passwords, API keys,
access tokens, webhook secrets, service-role keys, or full auth
cookies/headers.

User/profile/role management is still handled directly through Supabase —
no admin UI for that exists yet.

---

## Admin vs Staff

- Admin sees everything; Staff sees only their assigned leads/
  conversations/follow-ups/automation_sessions, enforced by RLS (not UI
  hiding).
- Automation, Audit Log, Settings: admin-only, desktop-oriented, never in
  mobile primary nav, never visible to staff at all (server-side 404 for
  direct URL access too, not just hidden nav).
- Audit Log event taxonomy — implemented today: `lead_updated`,
  `message_sent`, `conversation_viewed`, `lead_viewed`
  (`lib/audit-logs.ts`, `lib/actions/leads.ts`, `lib/conversations.ts`).
  Target/aspirational (not yet wired, features don't exist yet): login/
  failed-login/logout, lead created/assigned/reassigned/deleted, phone
  number viewed, follow-up created/completed, export attempted/completed,
  user created, role/permission changed. Never log message contents.

---

## Integration Rules — WhatsApp / Meta

**Production architecture (current, not a proposal):**
```
Meta Ads → Central WhatsApp API number → AFIT CRM inbox →
Auto/manual assignment → Staff → CRM live chat →
Same central API number → Customer
```
One shared WhatsApp Business number, owned by the business, is the only
channel customers message and the only channel staff reply through.
`conversations.phone_number_id` and the outbound sender are already keyed
per-conversation (not a single hardcoded value) — this is the foundation
for future multi-number support, even though only one number's credentials
exist today.

**Future Coexistence** (staff's personal WhatsApp Business App number
linked alongside the central number) — **do not implement now.** No
Coexistence API calls, no speculative per-staff-number schema. Just don't
write new conversation code that collapses "assigned staff" and "the
number in use" into the same variable, so this stays possible later.
Keep these concepts distinguishable: WhatsApp Business account / WhatsApp
number (`phone_number_id`) / Conversation / Customer-contact (no separate
`customers` table exists — identity lives on `conversations.wa_id` +
webhook-supplied name, cross-referenced to `leads` by phone) / Lead /
Assigned staff / Channel (implicitly always WhatsApp today, no `channel`
column exists).

**Message flow**: customer messages the WhatsApp number → Meta POSTs to
this project's webhook (HMAC-verified) → webhook writes to
`conversations`/`messages` (find-or-create by phone) → Supabase Realtime
pushes to any open UI → staff reply calls Meta's Cloud API to send, then
logs the outbound message too.

**Conversion attribution (`ctwa_clid`)**: a Click-to-WhatsApp ad's first
webhook message includes a `referral` object (ad ID, headline, `ctwa_clid`)
— already captured into `leads.ad_id` at conversation-creation time. Don't
re-derive this at the conversation level without checking first.

**Policy constraint**: Meta only allows free-form replies within 24 hours
of the customer's last message. Outside that window, only pre-approved
message templates can be sent — plan any "re-engage a cold lead" feature
around this explicitly.

**Outbound send is code-complete but never live-tested against the real
Meta API** — only structurally verified via `MockOutboundSender`
substitution. Recipient authorization for a real test send remains
unresolved (which number, if either, is actually allowed on the test WABA
— this needs settling explicitly before any live send attempt, never guess
or invent a recipient).

**WABIS**: `WEBHOOK_DISCOVERY_MODE` in
`app/api/webhooks/whatsapp/route.ts` is a temporary, separate integration.
Do not design the core CRM conversation model around it, do not assume its
webhook functionality exists beyond what's already there, do not invent or
guess its payload format. The CRM must keep working after WABIS is
eventually removed.

**Live conversation-update UX contract** (governs any future Realtime
work): reuse existing WhatsApp-style bubbles/tokens, one shared Realtime
mechanism for both `/conversations` and `/chat`; conversation list re-sorts
on new message with a transient (non-persisted) accent-dot cue; thread
auto-scrolls only when already near bottom; connection state
(connected/reconnecting/disconnected) shown near the list header, silent
when connected; `aria-live="polite"` on message regions, never steal
focus, respect `prefers-reduced-motion`; never assume/display a single
`phone_number_id`; de-duplicate by stable id only (`messages.id` /
`wa_message_id`), never by content/timestamp heuristics; subscriptions
must be RLS-safe (a staff client must never receive an event for a
conversation it can't access).

---

## Testing Rules

Required viewports: 375×812, 390×844 (mobile), 1440×900 (desktop).

Every UI change gets checked for: no horizontal overflow, readable
typography, proper spacing, usable touch targets (≥44×44), no clipped
content, no desktop-only modules leaking into mobile nav, stage UI staying
understandable, forms staying usable.

Use Playwright for actual live-browser verification whenever possible —
don't claim a UI works from source inspection alone when live verification
is available. Test both Admin and Staff roles at all three viewports.
Staff checks specifically: no Admin section, no Automation, no Audit Log,
correct assigned-lead-only access, no accidental admin functionality
(including direct-URL access to admin routes — confirm server-side 404,
not just hidden nav).

The `afit-verify` skill (`.claude/skills/afit-verify/SKILL.md`) codifies
this procedure — invoke it explicitly after implementing a phase, before
reporting done. Test what changed, not the whole app; skip static checks
only once something is already conclusively verified; don't re-run
unrelated historical regression suites.

---

## Deployment Rules

```
npm run lint
npx tsc --noEmit
npm run build
```
Then Playwright verification per Testing Rules. **Do not deploy
automatically. Do not commit automatically. Do not push automatically**
unless explicitly instructed each time — a prior approval does not carry
forward to the next session or the next commit.

A `git-and-schema-safety` PreToolUse hook (`.claude/hooks/`) asks-not-denies
on `git commit`/`push`/`reset --hard`/`clean -f` and on risky Supabase MCP
calls (`apply_migration`, `pause_project`, `delete_branch`, `reset_branch`,
or `execute_sql` containing CREATE/ALTER/DROP/TRUNCATE) — this is a
mechanical safeguard, not a replacement for asking first.

Zero-cost hosting constraint: GitHub/Supabase/Cloudflare Free tier only,
no paid Vercel — see memory `hosting_zero_cost_constraint`. Cloudflare
migration is currently blocked (Next.js 16 `proxy.ts` vs. OpenNext
Cloudflare, workers-sdk#13755) — don't migrate or weaken auth to work
around it; see memory `cloudflare_migration_blocked`.

Every CRM change needs live Chrome verification (desktop+mobile+flow)
before it's reported done — report PASS/FAIL/UNVERIFIED explicitly, never
claim success without it. See memory `feedback_live_chrome_review`.

---

## Development Workflow

```
ONE PHASE → UI/UX DESIGN FIRST → IMPLEMENT → FULL TEST → REPORT → /clear → NEXT PHASE
```
- Never start the next phase in the same session after finishing one.
- After implementation: run Deployment Rules' quality gates, run the full
  relevant Playwright verification for that phase, report exact results,
  then **stop** and wait — don't continue automatically, don't ask whether
  to continue.
- This applies even when the next phase seems obvious or small.
- The `/phase <scope>` command orchestrates this loop (points at this
  file, `afit-verify`, and the git-safety hook rather than restating them).

**General rule before changing code:**
1. Inspect the current implementation.
2. Inspect the live database if the decision depends on schema.
3. Understand existing RLS/auth.
4. Preserve working business logic.
5. Change only what's necessary.
6. Avoid duplicate fields/actions (one section = one owner).
7. Avoid creating new schema without explicit approval.
8. Verify with Playwright.
9. Run lint/typecheck/build.
10. Report exactly what changed and what was verified — update the
    Completed Work Log below.

**Priority tiebreaker** when requirements conflict: security > data
integrity > correctness > reliability > maintainability > performance > UI
convenience. Never sacrifice security or data integrity for a faster or
prettier implementation.

---

## Token / Context Efficiency

Sessions on this project have repeatedly hit usage limits from verbose
session logs and redundant re-verification. Every session should:
- Inspect existing work before rewriting it; reuse correct existing
  implementation instead of re-deriving it.
- Avoid repeated full-file reads and unnecessary test re-runs — targeted
  verification is fine once something is already conclusively verified.
- Not refactor unrelated code, not touch unrelated backlog, not implement
  future phases early, not build speculative functionality.
- Make the smallest safe change the current phase actually requires.
- Still satisfy the full-test rule for whatever *is* completed — efficiency
  is about scope, not about skipping verification of what was built.
- **Keep new Completed Work Log entries short** (a few lines: what changed,
  key gotcha if any, verified/not, committed/not) — do not write
  multi-paragraph verification narratives into this file. Full detail
  belongs in commit messages / conversation, not here. This is the rule
  that was violated repeatedly before the 2026-09-05 cleanup that produced
  this version of the file.

---

## Claude Code Scope Enforcement

- The user's syllabus/implementation plan is the source of truth for
  what phase we're in and what's in scope — not a roadmap item, a TODO,
  or Claude's own architectural preference.
- Claude must work only on the current phase's exact requirement plus
  its directly necessary dependencies and verification. Claude must not
  invent phases, invent features, expand scope, redesign unrelated
  areas, or start future roadmap work early — expanding beyond that
  needs explicit user approval first.
- Urgent work gets priority, never uncontrolled scope: inspect only the
  relevant system, make the minimum required change, still run full
  testing and quality gates.
- UI/UX first, backend second — don't build backend/schema before the UI
  actually requires it.
- One phase → implement → test → report → `/clear` → next phase. Never
  continue automatically.
- No commit, push, or deploy without explicit instruction, every time.
- Full detail (scope/urgency/syllabus discipline, Meta/WABIS urgency
  handling) lives in `.claude/rules/scope-and-urgency.md` — this section
  is the compact pointer, not a restatement.

---

## Claude Code Tooling

Detailed specialist instructions live under `.claude/`, not here — this
file stays the compact project constitution. Where a specialist file and
this file conflict, this file wins unless the specialist file is
explicitly scoped to override it:
- `.claude/agents/` — specialist subagents (code-reviewer, debugger,
  test-writer, refactorer, doc-writer, security-auditor).
- `.claude/commands/` — repeatable workflows (`/phase`, `/fix-issue`,
  `/deploy`, `/pr-review`).
- `.claude/rules/` — short, focused expansions of the sections above.
- `.claude/skills/` — reusable domain knowledge (`ui-ux`, `playwright`,
  `supabase`, `deployment`, `crm-workflow`, plus the pre-existing
  `afit-verify` and `ui-ux-pro-max`).
- `.claude/hooks/` — see `.claude/hooks/README.md` for the actual
  mechanism (hooks are registered in `.claude/settings.json`, not by
  files in this directory alone).

---

## Reference Assets

`whatsapp-conversations-view.jsx` — the approved visual design for
Conversations (already adapted into `components/conversations/
ConversationsView.tsx`, real data wired). Don't redesign the visual
language from scratch if touching this again — swap data/behavior, not
layout.

---

## Current Phase

All of the original 10 build phases (design tokens → AppShell → Dashboard
→ Leads list → stage-aware Lead Detail → Follow-ups → Site Visits/
Quotations → Deals → Reports → Admin/Settings/Automation/Audit Log
foundation) are complete. WhatsApp live integration (webhook, outbound
sender, Realtime, Conversations UI) is built. The keyword-triggered
automation track is extensively built (see Completed Work Log) but mostly
**uncommitted** and has a real live-Meta-send gap (recipient authorization
unresolved).

**Do not start the WABIS/Meta live-webhook phase without explicit
instruction.** Before picking a next phase, ask, or pick from the still-open
items in the Completed Work Log's automation-track and WhatsApp-integration
entries (all explicitly flagged there as not-yet-done), rather than
inventing new scope.

---

## Completed Work Log

*(Compact by design — see git log / commit messages for full detail on
any entry. New entries should stay this compact; see Token/Context
Efficiency above.)*

**Core CRM build (Phases 0a–7)** — 2026-08-29 to 2026-08-30, committed
(`c6834a9`): design tokens, role-aware AppShell (desktop sidebar / mobile
bottom nav), Dashboard, Leads list, stage-aware Lead Detail retrofit
(`STAGE_SECTIONS`), Follow-ups workspace, Site Visits & Quotations
UI-level views, Deals workspace, Reports v1. Mobile nav restructured
2026-08-30 to 4 core tabs + role-aware More menu (closed a real gap where
Deals/Quotations had zero mobile path before).

**WhatsApp live integration** — inbound webhook (HMAC verify, CTWA
referral capture), outbound text sender, 3-column Conversations UI,
on-demand Meta media download to Storage (commits `54a8c11`/`3c0f004`,
verified against a real Meta test WABA) — built pre-dating the 2026-08-30
documentation reconciliation. Supabase Realtime added 2026-08-30
(publication + RLS-safe hooks + live UI wiring; fixed a real bug where the
Realtime join lacked `access_token` so RLS silently dropped every event
until `supabase.realtime.setAuth()` was added before subscribing). Outbound
send against the real Meta API remains **structurally verified only** —
never live-tested; recipient authorization unresolved. WhatsApp Numbers
Settings UI (`/settings/whatsapp-numbers`) is a **local-state-only
prototype** — not persisted, not wired to Meta.

**Keyword-triggered automation track** — 2026-08-30 to 2026-09-01, all
**uncommitted**. Built incrementally: schema (`automations`,
`service_keywords`, `automation_runs`, `automation_sessions`,
`automation_media`, all admin-only RLS), a visual flow builder
(`@xyflow/react`, versioned graph schema, `/automation/services/
[serviceId]/builder`), real sequential graph execution (single-outgoing-
edge walk), conversational nodes (`capture_lead_field`, `send_text`/
`ask_question`, `send_image`/`send_video` with a lazy-upload/cache Meta
media pipeline), human handoff on staff manual reply (new
admin-or-owner RLS write policy pair on `automation_sessions`), an admin
Run History view, and a cycle-safety guard (visited-node-set +
`MAX_GRAPH_STEPS=30` fallback). Concurrency hardened across several
sessions: every session-state write is conditioned on both
`current_node_id` **and** `status`; a CAS retry loop fixes note-append
lost-updates; `captureLeadField()` returns the DB-confirmed value (not the
raw reply) so a losing race can't corrupt `collected_data`. All
outbound-send verification used a temporary `MockOutboundSender`, fully
reverted each time — **zero live Meta calls** anywhere in this track.
`RealOutboundSender` (real Meta text/media delivery) is code-complete but
never exercised against the live Meta API.

**Infrastructure (Skills/Agents/MCP/Hooks/Commands/Settings)** — one hook
(`git-and-schema-safety`), one command (`/phase`), one custom skill
(`afit-verify`); `ui-ux-pro-max` narrowed to design-exploration only. No
project-local Agents/MCP config beyond built-ins; Supabase MCP used
read-only, case-by-case. `AGENTS.md` kept for tooling compatibility but
this file is authoritative wherever they'd conflict.

**RLS performance hardening** — 2026-09-03: wrapped bare `auth.uid()`/
`private.is_admin()` calls in `(select ...)` across 16 policies on 7
tables + dropped one redundant policy on `automation_sessions`. Verified
via `get_advisors` (0 warnings after) and 18 live PostgREST RLS boundary
checks. Database-only, not committed.

**Today lead cards** — 2026-09-20, committed `3996242`, Vercel auto-deployed
and verified in production. UI/card refinement only
(`components/today/TodayItemRow.tsx`) — **not** completion of the broader
Today Command Center / P0 scope. Pastel accent derived from lead ID, initials
avatar, soft stage badge, blue Call / green WhatsApp icon buttons (44px mobile
/ 36px desktop), whole-card Lead Detail navigation, mobile customer-name
wrapping. Verified: 189/189 tests, tsc, lint, build; production checked at
1440×900 and 390×844, no overflow or console errors. DB/schema/data unchanged.

**Today lead card redesign** — 2026-09-20, committed `f81f2258fbac7238a00e4bed6c1e875dbda4d0df`,
Vercel production `dpl_9yrQB21G9nDpJ7Wnj5J3GhRKNnWK` (Ready, active Production,
source SHA matches). UI-only (`components/today/TodayItemRow.tsx`; `lib/today.ts`
passes the existing `leads.service_required` through, no query/logic change).
White 16px elevated cards, stage-based left accent (New blue, Quotation purple,
Lost red, ...), initials avatar, stage pill, activity/phone/service rows
(salesperson admin-only), blue Call + green WhatsApp icon buttons (independent
of the whole-card Lead Detail link), chevron. Verified in LIVE production at
390×844 and 1440×900: no overflow, no console/page errors, Today still 6
sections, bottom nav unchanged. The service worker caches nothing, so it did not
cause stale UI. Tests 257/257, typecheck/lint/build clean at implementation.

**Push notifications, Phase A (PWA + subscription foundation)** — 2026-09-20,
commits `4ec76ef` (PWA installability) and `a6bbc7a`, completed and
production-verified. Manifest/icons/root-scope service worker (caches nothing),
`push_subscriptions` + `notifications` tables with owner-only RLS (approved
migration `push_subscriptions_and_notifications`), /notifications opt-in UI
(enable/disable per device, no automatic permission prompt), service-worker push
+ notificationclick handlers, VAPID variables configured in Vercel Production.
Enable/disable flow verified end to end.

**Push notifications, Phase B (server delivery)** — 2026-09-20, commits `bfb190a`
and `a9e8b66`. IMPLEMENTATION COMPLETE; REAL DELIVERY NOT YET VERIFIED. Built:
server-only `web-push` sender with VAPID validation and symbolic diagnostic
codes (never values), minimal payload validation (internal routes only),
per-device fan-out, 404/410 revoke, transient failures keep the subscription,
history/dedupe via `notifications` (`sent_at` = accepted by push service;
`delivered_at` is never written), and a self-only "Send test notification"
action (rate-limited, no public endpoint). 256/256 tests at the diagnostic stage
(257/257 after the card redesign). Production diagnostic deployed and verified,
but repeated production test sends stopped at the config check with
`VAPID_SUBJECT_PLACEHOLDER`, so **no real production push has been sent**.
Push-service delivery, notification appearance, notification-click navigation,
background and locked-screen delivery are all UNVERIFIED. Do not describe
Phase B delivery as complete until one real test succeeds. No business
triggers, cron or scheduled reminders exist (that is Phase C, not started).

**Current push blocker** — the Production `VAPID_SUBJECT` was still resolving
to the placeholder/example value during the latest diagnostic attempts, so the
server rejects sends. Fix is a Vercel Production config change followed by a
redeploy and one explicit test send. Never record VAPID keys, the subject
value, subscription endpoints or tokens in this file.

**2026-09-05** — This file restructured from 215k+ to under the 100k
limit per explicit instruction: verbose per-session narratives compacted
into the summary above, permanent rules deduplicated and reorganized under
topic headings. No application code touched.
