# Graph Report - afit-lead-crm  (2026-08-25)

## Corpus Check
- 98 files · ~227,373 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 521 nodes · 1148 edges · 22 communities (18 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.84)
- Token cost: 0 input · 75,449 output

## Community Hubs (Navigation)
- Automation Builder UI
- Conversations & Lead Detail
- Dashboard & Lead Forms
- Audit Log & Login
- WhatsApp Webhook & Media
- AGENTS.md Architecture Rules
- Follow-ups & Live Stage
- NPM Dependencies
- TypeScript Config
- App Shell & Sidebar Nav
- WhatsApp Reply Sending
- Supabase Session Proxy
- Root Layout & Fonts
- ESLint Config
- Next.js Config
- PostCSS Config

## God Nodes (most connected - your core abstractions)
1. `getCurrentProfile()` - 53 edges
2. `createClient()` - 46 edges
3. `recordAuditEvent()` - 27 edges
4. `compilerOptions` - 16 edges
5. `formatDate()` - 11 edges
6. `revalidateLead()` - 10 edges
7. `checkLeadAccess()` - 10 edges
8. `setLeadQualification()` - 10 edges
9. `getBlockDefinition()` - 10 edges
10. `SubmitButton()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Next.js` --semantically_similar_to--> `Next.js`  [INFERRED] [semantically similar]
  README.md → AGENTS.md
- `Vercel` --semantically_similar_to--> `Vercel`  [INFERRED] [semantically similar]
  README.md → AGENTS.md
- `NeedsAttention()` --indirect_call--> `isFollowUpOverdue()`  [INFERRED]
  components/NeedsAttention.tsx → lib/follow-up-status.ts
- `SiteVisitForm()` --indirect_call--> `setSiteVisitDate()`  [INFERRED]
  components/lead-actions/SiteVisitForm.tsx → lib/actions/leads.ts
- `AuditLogPage()` --calls--> `getCurrentProfile()`  [EXTRACTED]
  app/(app)/audit-log/page.tsx → lib/auth.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Lead Leakage Prevention Model** — agents_lead_ownership, agents_supabase_rls, agents_staff_role, agents_admin_role, agents_stop_lead_leakage [INFERRED 0.85]
- **WhatsApp Integration Pipeline** — agents_meta_whatsapp_cloud_api, agents_whatsapp_architecture, agents_conversation_data_model, agents_wabis [EXTRACTED 0.90]
- **WhatsApp Media Phase B3 Verification** — agents_whatsapp_b3_phase, agents_whatsapp_media_bucket, agents_test_waba, agents_meta_whatsapp_cloud_api [EXTRACTED 0.90]

## Communities (22 total, 4 thin omitted)

### Community 0 - "Automation Builder UI"
Cohesion: 0.05
Nodes (56): AutomationPage(), AutomationBuilder(), AutomationList(), StatusFilter, triggerLabel(), AutomationWorkspace(), handleNew(), blankAutomation() (+48 more)

### Community 1 - "Conversations & Lead Detail"
Cohesion: 0.07
Nodes (44): AuditLogTableRow(), ConversationDetailPage(), ConversationListData(), ConversationsPage(), LeadDetailPage(), ConversationListPanel(), STATUS_DOT, LeadDetailsContent() (+36 more)

### Community 2 - "Dashboard & Lead Forms"
Cohesion: 0.10
Nodes (44): DashboardPage(), EditLeadPage(), LeadsPage(), JobValueForm(), QualificationForm(), QuotationForm(), MarkLostForm(), MarkWonForm() (+36 more)

### Community 3 - "Audit Log & Login"
Cohesion: 0.06
Nodes (38): AuditLogPage(), TARGET_LINK_PREFIX, LoginPage(), AuditLogFilterBar(), LoginForm(), ActorOption, AUDIT_ACTIONS, AuditLogFilters (+30 more)

### Community 4 - "WhatsApp Webhook & Media"
Cohesion: 0.08
Nodes (35): GET(), runtime, applyReferralToLead(), findLeadByExactPhone(), findOrCreateConversation(), ingestMessage(), POST(), runtime (+27 more)

### Community 5 - "AGENTS.md Architecture Rules"
Cohesion: 0.06
Nodes (40): ADMIN Role, AFIT CRM, Architecture Priority Order, Audit Logging, Authentication Requirements, Business Management & Reporting, Calling Feature, Conversation Data Model (+32 more)

### Community 6 - "Follow-ups & Live Stage"
Cohesion: 0.09
Nodes (28): DashboardFollowUps(), formatDueTime(), CompleteFollowUpButton(), CreateFollowUpForm(), FollowUpsCard(), formatDueTime(), StatusSelect(), LeadsFilterBar() (+20 more)

### Community 7 - "NPM Dependencies"
Cohesion: 0.05
Nodes (40): eslint, eslint-config-next, next, dependencies, next, react, react-dom, server-only (+32 more)

### Community 8 - "TypeScript Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 9 - "App Shell & Sidebar Nav"
Cohesion: 0.18
Nodes (9): MobileBottomNav(), NAV_ITEMS, NAV_ITEMS, Sidebar(), SidebarAdminNav(), ROLE_LABELS, SidebarProfileFooter(), SignOutButton() (+1 more)

### Community 10 - "WhatsApp Reply Sending"
Cohesion: 0.22
Nodes (9): ReplyComposer(), sendMessage(), SendMessageState, SEND_ERROR_PUBLIC_MESSAGE, SEND_ERROR_STATUS, SendMessageError, SendMessageErrorCode, sendTextMessage() (+1 more)

### Community 11 - "Supabase Session Proxy"
Cohesion: 0.60
Nodes (3): updateSession(), config, proxy()

## Ambiguous Edges - Review These
- `Stop Lead Leakage Priority` → `Production Safety Rules`  [AMBIGUOUS]
  AGENTS.md · relation: conceptually_related_to

## Knowledge Gaps
- **126 isolated node(s):** `TARGET_LINK_PREFIX`, `runtime`, `runtime`, `geistSans`, `metadata` (+121 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Stop Lead Leakage Priority` and `Production Safety Rules`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `getCurrentProfile()` connect `Dashboard & Lead Forms` to `Automation Builder UI`, `Conversations & Lead Detail`, `Audit Log & Login`, `WhatsApp Webhook & Media`, `Follow-ups & Live Stage`, `App Shell & Sidebar Nav`, `WhatsApp Reply Sending`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Dashboard & Lead Forms` to `Automation Builder UI`, `Conversations & Lead Detail`, `Audit Log & Login`, `Follow-ups & Live Stage`, `App Shell & Sidebar Nav`, `WhatsApp Reply Sending`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `TARGET_LINK_PREFIX`, `runtime`, `runtime` to the rest of the system?**
  _126 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Automation Builder UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05387861084063616 - nodes in this community are weakly interconnected._
- **Should `Conversations & Lead Detail` be split into smaller, more focused modules?**
  _Cohesion score 0.06821787414066631 - nodes in this community are weakly interconnected._
- **Should `Dashboard & Lead Forms` be split into smaller, more focused modules?**
  _Cohesion score 0.10112994350282486 - nodes in this community are weakly interconnected._