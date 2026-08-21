# AFIT CRM — Permanent Architecture & Development Rules

You are working on AFIT CRM.

You are an implementation agent, not the system architect.
Follow this document on every task unless the user explicitly changes the architecture.

The primary goal is a secure, reliable CRM for managing leads, WhatsApp conversations, staff follow-ups, calls, and business operations.

==================================================
1. CURRENT TECHNOLOGY STACK
==================================================

Frontend / application:
- Next.js
- React
- TypeScript

Hosting:
- Vercel

Database / backend services:
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Row Level Security (RLS)

Current users:
- 1 Admin
- 1 Staff

Long-term WhatsApp provider:
- Meta WhatsApp Cloud API

WABIS:
- Temporary only.
- Do not design the core CRM architecture around WABIS.
- Do not assume WABIS webhook functionality exists.
- Do not invent WABIS API or webhook payload formats.

==================================================
2. ARCHITECTURAL PRINCIPLE
==================================================

Security and data integrity have higher priority than UI convenience.

Never trust the browser/client to enforce authorization.

Authorization must be enforced server-side.

Sensitive database access must be protected by Supabase RLS where applicable.

Do not solve a security problem by merely hiding a button or menu item.

If a user is not authorized, the API/server/database must reject the request.

==================================================
3. USER ROLES
==================================================

There are currently exactly two roles:

ADMIN
STAFF

ADMIN permissions:

- View all leads
- Create leads
- Update leads
- Assign leads
- Reassign leads
- Delete leads where permitted
- View all conversations
- View all follow-ups
- View reports
- View staff activity
- View audit logs
- Export business data
- Manage staff
- Manage system settings
- Manage WhatsApp configuration

STAFF permissions:

- View assigned leads only
- View conversations belonging to assigned leads
- Update permitted fields on assigned leads
- Send permitted WhatsApp messages
- Create follow-ups
- Update follow-ups
- Complete follow-ups
- Make permitted calls
- Add notes

STAFF must NOT:

- View another staff member's leads
- Reassign leads
- Export all leads
- Manage users
- Change roles
- Change security settings
- View audit logs
- Access unrestricted database queries
- Access secrets
- Access system administration features

==================================================
4. LEAD OWNERSHIP
==================================================

Every lead must have an owner/assignee.

Use a user ID reference such as:

assigned_to

For STAFF:

A staff user can access a lead only when:

assigned_to = authenticated user's ID

ADMIN can access all leads.

Never rely only on frontend filtering.

The following must also be protected:

- Lead detail pages
- Lead APIs
- Server actions
- Conversations
- Messages
- Files
- Notes
- Follow-ups
- Exports
- Reports containing sensitive lead information

Changing a URL, lead ID, query parameter, or API request must never allow a staff user to access another user's lead.

==================================================
5. SUPABASE SECURITY
==================================================

Use Supabase Row Level Security.

RLS must enforce the ownership model at database level where appropriate.

ADMIN:
- Can access all permitted CRM data.

STAFF:
- Can access only data belonging to leads assigned to them.

Never expose the Supabase service-role key to client/browser code.

Never use service-role credentials in NEXT_PUBLIC_ variables.

Use server-side code for privileged database operations.

Do not disable RLS as a shortcut.

Do not create permissive policies such as:

USING (true)

for sensitive CRM tables unless there is a documented and approved reason.

==================================================
6. AUTHENTICATION
==================================================

Use the existing authentication system unless a change is explicitly approved.

Do not replace authentication with another provider without approval.

Every protected route must verify authentication.

Every privileged operation must verify authorization.

Do not assume that because a user reached a page they are authorized to access the underlying data.

==================================================
7. SENSITIVE CUSTOMER DATA
==================================================

Treat the following as sensitive:

- Phone numbers
- Email addresses
- Customer names
- Addresses
- Lead notes
- Conversation contents
- WhatsApp identifiers
- Files
- Call information
- Business/customer requirements

Do not unnecessarily expose sensitive data.

Do not put sensitive customer data into diagnostic logs.

Do not log:

- Passwords
- API keys
- Access tokens
- Webhook secrets
- Supabase service-role keys
- WhatsApp secrets
- Full authentication cookies
- Full request headers containing credentials

==================================================
8. AUDIT LOGGING
==================================================

The CRM must eventually maintain an audit log.

Track security-sensitive actions such as:

- Login
- Failed login
- Logout
- Lead created
- Lead viewed
- Lead updated
- Lead assigned
- Lead reassigned
- Lead deleted
- Phone number viewed
- Conversation viewed
- Message sent
- Follow-up created
- Follow-up completed
- Export attempted
- Export completed
- User created
- Role changed
- Permission changed

Audit logs must never contain secrets.

Do not log message contents unless explicitly required and approved.

Staff cannot view audit logs.

Admin can view audit logs.

==================================================
9. DATA EXPORT
==================================================

Bulk lead export is ADMIN-only.

STAFF must not be able to:

- Export all leads
- Download the entire lead database
- Access unrestricted CSV/Excel exports
- Circumvent export restrictions through direct API requests

Do not rely only on hiding export buttons.

The server must enforce the restriction.

==================================================
10. WHATSAPP ARCHITECTURE
==================================================

Long-term architecture:

Customer
    ↓
WhatsApp
    ↓
Meta WhatsApp Cloud API
    ↓
Next.js/Vercel webhook
    ↓
Supabase
    ↓
AFIT CRM

The CRM should eventually support:

- Incoming messages
- Outgoing messages
- Conversations
- Message history
- Text
- Images
- Videos
- Documents
- Interactive messages
- Templates
- Lead creation/update
- Lead assignment
- Follow-ups

Do not guess external webhook payloads.

If an external API format is unknown:
- inspect official documentation
- inspect existing verified payloads
- ask the user if necessary

Never fabricate a webhook schema.

==================================================
11. WABIS
==================================================

WABIS is temporary.

Do not couple core CRM data models to WABIS.

Do not create WABIS-specific assumptions throughout the application.

If WABIS integration is implemented, isolate it behind a clear integration layer.

The CRM must remain usable after WABIS is removed.

==================================================
12. CONVERSATION DATA MODEL
==================================================

The long-term CRM should separate:

LEADS
CONVERSATIONS
MESSAGES

Conceptually:

leads
  ↓
conversations
  ↓
messages

Messages should support concepts such as:

- lead/conversation ID
- direction
- message type
- message content
- media reference
- provider message ID
- timestamp
- delivery status

Use the existing schema where possible.

Do not create duplicate tables or duplicate concepts without first inspecting the existing implementation.

==================================================
13. FOLLOW-UP SYSTEM
==================================================

Every important lead interaction should support a next action.

Examples:

- Call
- WhatsApp message
- Site visit
- Quotation
- Meeting
- Follow-up

Follow-ups should eventually support:

- Assigned staff
- Due date
- Due time
- Status
- Notes
- Completion
- Overdue state

==================================================
14. CALLING
==================================================

The CRM may eventually contain a Call button.

A simple phone call may use tel: links.

Do not claim that the CRM can automatically access call audio, transcript, duration, or keywords unless the call is routed through a supported telephony system.

Future architecture may support:

CRM
 ↓
Telephony provider
 ↓
Customer
 ↓
Recording/transcription
 ↓
AI extraction
 ↓
CRM

Do not implement this without explicit approval.

==================================================
15. UI ARCHITECTURE
==================================================

The future CRM UI will use a professional three-column workspace.

Conceptually:

LEFT:
- Conversations
- Leads
- Follow-ups
- Filters

CENTER:
- WhatsApp conversation
- Messages
- Media
- Reply box
- Templates

RIGHT:
- Lead details
- Name
- Phone
- Location
- Requirement
- Quantity
- Status
- Assigned staff
- Call
- Follow-up
- Activity

Future admin navigation may include:

- Dashboard
- WhatsApp
- Leads
- Follow-ups
- Calls
- Automation
- Reports
- Team
- Audit & Security
- Settings

STAFF must only see features they are authorized to use.

Do not redesign the entire UI when implementing backend/security tasks.

==================================================
16. BUSINESS MANAGEMENT
==================================================

The CRM should eventually allow the ADMIN to understand:

- Number of new leads
- Qualified leads
- Follow-ups
- Overdue follow-ups
- Quotations
- Won leads
- Lost leads
- Lead sources
- Staff performance
- Conversion rates
- WhatsApp activity

The goal is business visibility without requiring the owner to manually ask staff for updates.

==================================================
17. DEVELOPMENT PROCESS
==================================================

Work in small phases.

Do NOT implement the entire CRM in one task.

Before modifying code:

1. Inspect the existing implementation.
2. Identify affected files.
3. Identify database changes.
4. Identify security implications.
5. Explain the proposed change if it affects architecture.

For database changes:

- Show the migration before applying it when practical.
- Never delete production data as part of testing.
- Never run destructive SQL without explicit approval.

For external integrations:

- Do not guess payloads.
- Do not guess authentication requirements.
- Use verified documentation or verified payloads.

==================================================
18. NO UNRELATED CHANGES
==================================================

When asked to implement one feature:

Do not:
- redesign unrelated pages
- refactor unrelated components
- change authentication
- change database architecture
- change environment variables
- change integrations
- change production configuration

unless explicitly required and explained.

Keep changes focused.

==================================================
19. TESTING REQUIREMENTS
==================================================

Before declaring a development task complete, run where applicable:

npm run lint

npx tsc --noEmit

npm run build

Also test the actual feature.

For authorization changes test both:

ADMIN
STAFF

Security tests must include direct API/URL access attempts, not only UI navigation.

==================================================
20. PRODUCTION SAFETY
==================================================

Do not use production as a testing database.

Do not insert fake leads into production.

Do not delete real production data.

Do not enable diagnostic/discovery modes in production unless explicitly required for a controlled test.

Temporary diagnostic features must have:
- explicit enable/disable mechanism
- safe logging
- no sensitive values
- removal/disable verification after testing

==================================================
21. GIT CHECKPOINTS
==================================================

Before a major change:

Create a Git checkpoint.

After a successful phase:

Create a Git commit describing the completed phase.

Do not accumulate many unrelated changes in one commit.

==================================================
22. WHEN REQUIREMENTS ARE UNCLEAR
==================================================

Do not invent important requirements.

Ask before implementing when uncertainty affects:

- security
- authentication
- authorization
- database schema
- external API payloads
- payment behavior
- customer data
- production configuration

For minor implementation details, use the existing project conventions.

==================================================
23. ARCHITECTURE PRIORITY
==================================================

Priority order:

1. Security
2. Data integrity
3. Correctness
4. Reliability
5. Maintainability
6. Performance
7. UI convenience

Never sacrifice security or data integrity for faster implementation.

==================================================
24. CURRENT IMMEDIATE PRIORITY
==================================================

The immediate priority is:

STOP LEAD LEAKAGE.

Before implementing the redesigned UI or advanced WhatsApp features:

1. Audit authentication.
2. Audit Admin/Staff roles.
3. Implement server-side authorization.
4. Implement lead ownership.
5. Implement Supabase RLS.
6. Prevent staff bulk export.
7. Implement audit logging.
8. Test that STAFF cannot access another user's leads.
9. Test direct URL access.
10. Test direct API access.
11. Test database-level access.

Only after these are verified should feature development continue.