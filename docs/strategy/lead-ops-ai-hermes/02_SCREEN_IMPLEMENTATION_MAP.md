# Screen Implementation Map — design/ exports → real CRM

Status: STRATEGY / SPECIFICATION ONLY. Companion to
`01_SCOPE_AND_PLAN.md`. Source: the four design exports the owner placed
in `design/` — `Owner dashboard.pdf`, `Pipeline board.pdf`,
`Team & permissions.pdf`, `Lead detail@2x.png` — studied against the real
components below. CLAUDE.md/AGENTS.md still win on any conflict; this
file only maps pixels to the real app, it does not re-architect anything.

For each screen: what already exists (restyle only, Phase 0b tokens from
`app/globals.css`), what's genuinely new (needs its own build step and,
where noted, its own go-ahead), and what in the design is illustrative
only (not to be built literally).

## 1. Owner dashboard

**Maps almost 1:1 to already-built real components** —
`components/dashboard/AdminHome.tsx` composing
`dashboard/admin/AdminKpiTiles.tsx`, `LeadStatusFunnel.tsx`,
`TeamPerformanceTable.tsx`, `LeadSourceDonut.tsx`, `RevenueOverviewChart.tsx`,
`TodaysScheduleList.tsx`, `UnassignedSummaryCard.tsx`,
`UpcomingSiteVisitsList.tsx`, `ActiveDealsList.tsx`.

- **Restyle only** (apply `--chrome-900`/`--brand-*`/`--glass-fill`/`--gold`
  tokens to these existing components) — KPI cards, funnel, team
  performance table, lead source breakdown all already exist with real
  data wiring. Do not rebuild their data logic.
- **Genuinely new in the design**: an "AI agent panel" showing live
  AI-agent activity. This has no backing data today — it depends on
  Phase B (WhatsApp AI agent) existing first. Build the panel's shell now
  if useful, but it shows empty/placeholder state honestly until Phase B
  ships; never a fake number.

## 2. Pipeline board

**Does not exist today** — the real app has a list view
(`app/(app)/leads/page.tsx` + `LeadCard.tsx`/`LeadRow.tsx`/
`LeadsFilterBar.tsx`), not a Kanban/column board. This is genuinely new
UI work, not a restyle.

- Build as a new view alongside the existing leads list (e.g. a toggle on
  `app/(app)/leads`), reusing `getLeads()` and the real `PIPELINE_STATUSES`
  (8 stages) from `lib/constants.ts` for the columns — never re-derive the
  stage list.
- [BUSINESS DECISION REQUIRED]: drag-and-drop stage changes from the board
  itself, or tap-to-open-then-change-stage only? Drag-and-drop touches the
  same `setLeadStatus`/`markLeadWon`/`markLeadLost` guards either way — no
  new transition logic, just a new entry point into the existing one.
- The design's "Lost / Nurture / Junk" side tiles: "Lost" already exists
  (a real status). "Nurture" and "Junk" are **not** real statuses and must
  not be added as new `leads.status` values (that would break
  `WON_REACHABLE_FROM` and every stage-based query). If wanted, these are
  presentation-only groupings over existing data (e.g. Lost leads filtered
  by `lost_reason`), never a schema change — confirm the exact grouping
  rule before building.

## 3. Team & permissions

**Does not exist today at all** — `components/settings/` only has
`WhatsAppNumbersWorkspace.tsx`/`NumberFormModal.tsx`. This is the owner's
original, highest-priority no-code requirement ("add name/mobile/email,
checkbox permissions, no code for new staff") and is fully new work.

- Needs: a new Settings sub-page, a team list, an add-member form
  (name/mobile/email), and a permissions model. [BUSINESS DECISION
  REQUIRED]: audit `lib/auth.ts`'s current `profile.role` shape first —
  if roles today are a simple admin/staff enum, checkbox-level granular
  permissions is a real schema addition (a `permissions` table or column)
  and needs explicit approval before migrating, per CLAUDE.md's
  no-production-mutation-without-approval rule.
- This is the one screen in this batch with the most schema risk — treat
  it as its own phase, not bundled silently into a restyle pass.

## 4. Lead detail

**Maps mostly to the already-built real page** —
`app/(app)/leads/[id]/page.tsx` (17.8KB) composing
`components/lead-actions/*` (`QualificationForm`, `QualificationScoreCard`,
`SiteVisitForm`, `QuotationForm`, `StatusSelect`, `WonLostForms`,
`FollowUpsCard`, `NextActionCard`, `AssignmentCard`, `LeadActivity`) and
`components/conversations/LeadDetailsContent.tsx`, already gated by the
real `STAGE_SECTIONS` (`lib/lead-stage-sections.ts`) so only
stage-relevant sections render — exactly the behavior the design implies.

- **Restyle only** for the existing Details card, Call/WhatsApp actions
  (`tel:`/`wa.me` links — already the existing pattern per the project's
  own Follow-Up Brain docs), and the stage-aware section rendering.
- **Genuinely new**: the "WhatsApp — AI agent" preview card showing live
  AI-drafted replies inline on Lead Detail, and the "Service — auto-detected"
  badge. Both depend on Phase B. Until then, this card should not render,
  rather than show a mocked conversation.
- The design's call-outcome affordance ("23 min late" chip + implicit "log
  what happened") is the **Call Outcome** piece from `01_SCOPE_AND_PLAN.md`
  §2 — still `[BUSINESS DECISION REQUIRED]` there, not resolved by this
  screen map.

## What's illustrative only, not literal

Exact colors/spacing in the PDFs are reference, not pixel law — use the
project's real tokens (`--chrome-900` etc.), not whatever the export
renders them as. Any copy text in the mockups ("Rahul K.", "Kazhakkoottam")
is sample data for illustration, never to be hardcoded anywhere real.
