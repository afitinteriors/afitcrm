# 04 — UI/UX Specification

A live visual mockup of these screens was published separately as a Design canvas artifact (8 artboards: owner dashboard, pipeline board, team & permissions, Azhar's Today list, lead detail, the compulsory call-outcome sheet, the WhatsApp+AI inbox, and the Telegram manager agent). Treat that canvas as the visual reference; this document is the functional spec behind each screen. Build against this document — the canvas is for look and feel, not the authority on data or logic (that's `docs/09` and `docs/06`).

## Desktop (Owner) — information architecture

Sidebar: Dashboard · Pipeline · Leads · WhatsApp Inbox · Follow-ups · Site Visits · Quotations · Projects · Reports · Team · Settings.

### Dashboard
- Header: greeting, date range selector (Today/7d/30d/custom), service filter (Gypsum/Interior/All).
- **Untouched-leads banner** (red, dismiss-on-resolve only, not dismiss-on-click): count + "View leads" action. Must reflect real overdue count, never a static number.
- KPI cards: New leads, Called (x/y), Avg first-call time, Site visits booked, Pipeline value (weighted by stage win %).
- **Funnel widget**: New → Contacted → Qualified → Site Visit → Quote Sent → Won, horizontal bars with counts; flags the single biggest drop-off stage.
- **Staff scorecard** (per team member): calls today, % within response-time target, follow-ups completion rate, overdue count. Links to that day's Telegram nudges sent.
- **Ad campaign table**: campaign name, leads, called, visits, won, cost/lead — sourced from `ctwa_clid`/`source_id` attribution (`docs/10`).
- **AI agent panel**: chats replied, service auto-detected count, details collected, handed to staff, avg reply time.
- Every KPI/number is clickable through to its filtered underlying list — never a dead-end number (`R-REP-01`).

### Pipeline board
- Kanban columns = sales pipeline stages for the selected service (Gypsum default, Interior toggle).
- Each card: customer name, locality, key fact (sqft/budget), time-in-stage indicator, color-coded left border by stage group (Lead=gray, Opportunity=blue, Proposal=amber, Won=green).
- Below the board: Lost / Nurture / Junk summary tiles with counts and top reason.
- Drag-and-drop between adjacent stages only where the state machine (`docs/09`) allows it; an invalid drop is rejected with a toast explaining why (e.g. "Visit must be marked Done before Quote can be sent").

### Team & Permissions
- Member list: avatar, name, role label, status chip.
- Per-member detail: role preset dropdown + full permission checkbox grid (see `docs/03`).
- "Add member" panel: name + mobile/email fields + Invite button. No password field.

## Mobile (Azhar/staff) — bottom navigation

Today · Inbox · Pipeline · Add (+) · More.

### Today screen
- Top stat strip: Overdue / Due today / Done (today).
- List grouped "Overdue — call now" (red) then "Follow-ups today" (neutral), each card: name, service+locality, time-overdue or scheduled time, lead source line.
- Tapping a card opens Lead Detail.

### Lead Detail
- Header: name, service+locality, overdue/urgency chip.
- Details card: service (with "auto-detected" tag if applicable), area, location, type, source (ad name).
- WhatsApp conversation preview (read-only here; full thread in Inbox).
- Primary action: **Call now** (large, green) → opens Call Outcome sheet on call end. Secondary: open WhatsApp thread.

### Call Outcome sheet (bottom sheet, compulsory — see `docs/09` for the enforcement rule)
- Outcome buttons: Answered / No answer / Busy / Wrong number.
- Required next-follow-up chips: Tomorrow / In 3 days / Site visit (date picker).
- Optional note field.
- Save & close — disabled until outcome + next-follow-up are both set. No swipe-to-dismiss.

### WhatsApp Inbox (per conversation)
- Header: customer name, "AI agent is replying" status, detected-service chip.
- Chat thread: customer messages left, AI replies right (visually distinct from staff's own manual replies if staff takes over).
- System markers: window status ("72hr free window active"), service-detection explanation, no-reply escalation note.
- Actions: **Take over from AI** (hands control to staff, pauses AI for this thread), **Call instead**, manual message composer.

### Telegram manager agent (reference screen — actual surface is Telegram, not the CRM app; see `docs/13`)
- Shows the agent's message style: morning summary, real-time watch alerts, answering the owner's free-text questions with sourced figures, the nightly scheduled report.

## Shared UI rules (desktop + mobile)

- Every list: search (debounced), relevant filters, sort, pagination, visible result count, loading skeleton, empty state with a useful create action, error state with retry, permission-aware create/edit controls, confirm on destructive actions, no silent data loss on navigation.
- Status chips use a consistent color language across the whole app: gray = neutral/new, blue = in progress, amber = waiting on customer, red = overdue/urgent, green = won/success.
- Mobile forms: grouped sections, sensible defaults, sticky primary action at the bottom where helpful, no accidental double-submit.
- Never show an optimistic "sent/approved/paid" state before server confirmation (`R-WA` sends, payment records, approvals).

## Out of scope for this document

- Visual tokens (colors, type scale, spacing) — `docs/DESIGN_SYSTEM` reference used in the canvas mockup; replicate its dark-green/glass aesthetic unless the owner says otherwise.
- PWA-specific behavior (install, offline, service worker) — `docs/14_PWA_SPECIFICATION.md`.
