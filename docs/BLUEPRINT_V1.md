AFIT CRM Blueprint v1
Oct 25, 2026 · @afs
Churukkam (owner-nu)
Ad-il ninnu varunna oru lead-um miss aakaathe, Azhar enthu cheythu ennu ningalkku Telegram-il ariyaan pattunna CRM aanu ithu.
•	CRM aanu ella data-yum ella rules-um sookshikkunna sthalam. Staff, stages, keywords, templates ellaam Settings-il ninnu maattaam, code venda.
•	Customer AI agent WhatsApp-il udane reply cheyyum. Service veendum chodikkilla, baakki details maathram chodikkum, customer-nodu confirm cheythittu save cheyyum.
•	Hermes ops agent ningaludeyum Azhar-nteyum manager aanu: reminders, reports, monitoring, bug report. Telegram vazhi samsaarikkum.
•	Bug fix Claude Code cheyyum. Ningal Telegram-il approve cheythaal maathram live aakum.
•	WhatsApp ippol WABIS vazhi. Pinne Settings-il ninnu Meta direct-lekku maattaam.
•	Cost: testing samayathu mikkathum free. Live aakumbol customer AI, database backup, server ee moonnu maathram paid.
1. Goals
The CRM exists so that no Meta ad lead is missed and the owner can see every lead's status without asking anyone.
The problem today
•	Leads arrive from Meta ads through WABIS, but many are never called.
•	When a lead is called, the outcome is not recorded in the CRM.
•	Only one or two leads that look promising get follow-up, and most of those do not close.
•	The owner (Afsal) works on other businesses and cannot track the operator (Azhar) manually.
Goals for version 1
1.	Every lead enters the CRM automatically with its ad source.
2.	Every lead gets a first response within 15 minutes, by the AI agent or a person.
3.	Every call has a recorded outcome and a next follow-up date.
4.	The owner gets a daily Telegram report and alerts when rules are broken.
5.	New staff can be added and given permissions without code changes.
6.	Gypsum plastering works fully; interior design and production can be switched on later from Settings.
Not in version 1
•	Stock, purchase orders, GRN, labour bills, subcontractor bills
•	Full accounting, GST filing, payroll
•	Warranty and service tickets
•	Cloud telephony (call recording); normal call logging is used first
•	AI that sets prices, approves discounts or marks payments
2. Users, roles and permissions
The team today is two people, and any new staff member is added from Settings in under a minute with no code change.
Person	Role	Main work in the CRM
Afsal	Owner	Runs Meta ads, watches reports, approves price, discount and bug fixes
Azhar	Sales and Operations	Calls leads, site visits, quotations, runs work on site
Future staff	Picked by owner	Only what the owner ticks
Adding a member (Settings → Team)
1.	Owner taps Add member and types name plus mobile number or email.
2.	Owner picks a role template, or ticks individual permissions.
3.	Owner adds the member's Telegram username so Hermes can talk to them.
4.	The member gets an invite link and logs in.
5.	A member who leaves is deactivated, never deleted; their leads are reassigned and history stays.
Role templates (editable)
Permission	Owner	Sales	Supervisor	Accounts
View all leads	Yes	Own and unassigned	No	No
Call, update stage, set follow-up	Yes	Yes	No	No
Create quotation	Yes	Yes	No	No
Approve discount above limit	Yes	No	No	No
Site visits and daily site report	Yes	Yes	Yes	No
Record payment received	Yes	No	No	Yes
See profit and ad cost	Yes	No	No	Yes
Change Settings, stages, keywords	Yes	No	No	No
Add or deactivate members	Yes	No	No	No
Permissions are checked on the server and in the database, not only by hiding buttons. Each permission has a fixed name such as leads.view_all, quotations.approve_discount, settings.edit.
3. System structure
 
system structure · 9 parts
The CRM is the only place data is written. The customer AI agent works inside it; Hermes reads it through a fixed tool list and reaches people only on Telegram. Bug fixes go from a GitHub ticket to Claude Code and reach the live CRM only after the owner approves.
4. Lead capture and WhatsApp
All WhatsApp traffic goes through one messaging adapter, so moving from WABIS to Meta Cloud API is a Settings switch, not a rebuild.
Provider setting: whatsapp.provider = wabis | meta_cloud
	WABIS (now)	Meta Cloud API (later)
Incoming messages	WABIS webhook forwards to CRM	Meta webhook posts to CRM
Sending	WABIS send API	Meta Graph API
Monthly platform fee	Yes	No, per-message only
Ad referral data	Only if WABIS passes it on (confirm with WABIS)	Always on first message
Open question for WABIS: can it forward every incoming message to our webhook, and does it pass the ad referral fields? If not, the CRM cannot receive chats until the Meta move.
Lead sources captured
•	Click-to-WhatsApp ads (main source)
•	Meta Lead Form ads (form fields map to lead fields)
•	Direct WhatsApp message, phone call, referral, walk-in (manual entry)
On every incoming message the CRM must
1.	Normalise the phone number (+91 format).
2.	Find the customer by phone; create one if new. One phone number = one customer.
3.	Save the message in the conversation, including photos, voice notes and location.
4.	On the first message from an ad, save the referral data: ctwa_clid (click id), source_id (ad id), headline. It only comes once.
5.	Create or update the deal for the detected service (Section 5).
6.	Start the 15-minute response timer and notify the owner of the deal.
7.	Process each message once only, even if the webhook delivers it twice.
Message window rules (Meta)
•	Within 24 hours of the customer's last message: free-form replies allowed and free.
•	After a click-to-WhatsApp ad: a 72-hour free window opens when we reply within 24 hours. The AI agent should finish qualification inside it.
•	Outside the window: only Meta-approved templates, which are charged per message.
•	The CRM tracks each conversation's window and blocks free-form sends when it is closed.
•	If a customer says stop, all follow-up and marketing messages to them stop.
Conversion feedback to Meta (after Meta move)
When a deal reaches Site Visit Done and Won, send the event with its ctwa_clid through the Conversions API, so Meta learns which ads bring real customers.
5. Service detection
The CRM never asks "which service?" when the ad or the customer's message already says it.
Detection order (first match wins)
1.	Ad mapping: the ad id from the referral is looked up in Settings → Ad mapping (ad → service).
2.	Ad headline or pre-filled message contains a service keyword.
3.	Keyword match in the customer's message, including close spellings (jypsum, plastring, intirior).
4.	AI understanding of the meaning ("chuvar smooth aakkanam" → gypsum plastering).
5.	Only if all of these fail, the AI asks which service.
Starting keyword list (Settings → Keywords, editable)
Service	Keywords
Gypsum plastering	gypsum, jipsum, plastering, plaster, wall plaster, punning, POP, ജിപ്സം, പ്ലാസ്റ്ററിംഗ്, thekkal, chuvar plaster
False ceiling	ceiling, false ceiling, gypsum ceiling, grid ceiling, സീലിംഗ്
Interior	interior, kitchen, modular kitchen, wardrobe, cupboard, TV unit, ഇന്റീരിയർ
Rules
•	Two services in one message → two deals under the same customer.
•	The lead shows how the service was found: "Gypsum — found from keyword 'plastering'".
•	Staff can correct the service in one tap; each correction is logged so the owner can improve the keyword list.
•	The same extraction also reads sqft or rooms, location, new or renovation, and timeline from the message, so those questions are not asked again.
6. Customer AI agent
The customer AI agent lives inside the CRM, talks only about AFIT's services, and saves a detail only after the customer confirms it.
Model: set in Settings → AI provider. Default: Gemini API paid tier (Flash). Backup: Claude Haiku or GPT mini. Switching needs no code.
It does without approval
•	Replies within 1 minute, in the customer's language (English or Malayalam).
•	Skips questions already answered by the ad or the message (Section 5).
•	Asks only the missing qualification questions, one or two at a time.
•	Asks for a site or wall photo.
•	Offers site visit slots from the team calendar and books the chosen one.
•	Sends a summary to the assigned staff member when the lead becomes Hot.
•	Sends a follow-up inside the 72-hour free window if the customer goes quiet.
Question sets (Settings → AI questions, editable)
Gypsum plastering	Interior
Site location	Site location
Area in sqft, or number of rooms	Rooms or items needed (kitchen, wardrobe, TV unit)
Walls, ceiling, or both	New house or renovation
New house or renovation	Budget range, only if customer offers
When do you want to start	When do you want to start
Wall or site photo	Floor plan or photos
Data confirmation rule
Before saving, the agent repeats what it understood: "Gypsum plastering, about 1500 sqft, Kollam, starting next month. Is that right?" Only a yes saves the fields. Saved fields carry an AI tag until a staff member marks them Verified.
It never does
•	Quote a final price or discount. It may share the per-sqft range the owner sets in Settings, labelled as approximate.
•	Promise dates, warranty or anything not in Settings.
•	Answer general questions unrelated to AFIT (Meta's rules ban general-purpose chatbots).
•	Follow instructions written inside a customer message.
•	Keep messaging after the customer says stop.
Hand-over to a person happens when the customer asks for a person, is angry, asks for a price or discount, or the agent is unsure. Staff can press Take over at any time; the agent stays silent on that chat until staff presses Hand back.
Rollout: two weeks in draft mode (agent writes, Azhar sends), then automatic mode for first reply and qualification.
7. Pipelines and stages
 
gypsum pipeline · 4 sales groups, work, side paths
Each customer can hold one deal per service; a Won deal creates a project and moves into the work pipeline. Stage names, limits and win chances are Settings, so they change without code.
Stage	Enters when	Time limit	Win chance
New	Lead created	15 min to first reply	5%
AI talking	AI agent replied	24 hr to qualify	5%
Contacted	Staff logs an answered call	—	10%
Qualified	Location, size, type and timeline confirmed	2 days to fix a visit	20%
Visit scheduled	Visit date and person set	Visit date	35%
Visit done	Measurements and photos saved	2 days to send quote	50%
Quote sent	Quotation PDF sent	Follow-ups on day 1, 3, 7	60%
Negotiation	Customer replies after quote	7 days	75%
Won	Accepted quote and advance proof	—	100%
Win chances are starting values; adjust them once real conversion data exists.
Interior uses the same four groups and is switched on from Settings. Opportunity adds Requirement taken, Design meeting and Design / 3D. Work becomes Production, Ready for dispatch, Installation, Handover, Payment pending, Closed and Warranty.
8. Business rule book
Every rule has an ID and a matching test (T-same number); a rule without a passing test is not done.
Times below are defaults, editable in Settings. Business hours default to 9:00 to 20:00 IST; timers pause outside them.
ID	Rule	Example	Who is alerted
R-LEAD-001	One phone number = one customer. A repeat enquiry joins the existing customer.	Same number messages again after 2 months → new deal, old history visible	—
R-LEAD-002	One active deal per customer per service.	Second gypsum enquiry while one is open → added to the open deal	—
R-LEAD-003	A new lead must get a first response within 15 minutes (AI reply counts).	Lead at 10:00, no reply by 10:15 → lead turns red	Staff at 15 min, owner at 30 min
R-LEAD-004	An AI-qualified Hot lead must be called by a person within 30 minutes.	Hot at 11:00, no call log by 11:30	Staff, then owner
R-CALL-001	Calls start from the Call button; after the call the outcome popup cannot be skipped.	Outcome: Answered, No answer, Busy, Wrong number, Not interested	—
R-CALL-002	Every call outcome needs a next follow-up date, except Wrong number and Lost.	Answered → date required	—
R-FUP-001	A follow-up past its date moves to the top of Today in red.	Due yesterday, not done	Staff daily; owner in nightly report
R-FUP-002	If a call is not answered, the customer gets an approved WhatsApp template.	"We tried to call you from AFIT. When is a good time?"	—
R-STAGE-001	Stages cannot be skipped.	Quote Sent needs Visit Done first	—
R-STAGE-002	Each stage has a time limit; overdue deals turn red.	Visit Done, no quote in 2 days	Staff, then owner
R-LOST-001	Lost needs at least 3 logged call attempts and a reason.	Reasons: price, chose another, plan cancelled, no response, out of area, other	Owner reviews weekly
R-LOST-002	Junk (spam, wrong number, job enquiry) is kept out of conversion reports.	—	Owner reviews weekly
R-WON-001	Won needs an accepted quotation and advance proof (photo or reference).	No advance → cannot mark Won	Owner notified on Won
R-QUOTE-001	A sent quotation is never edited; a change creates a new version.	v1 sent, customer asks change → v2	—
R-QUOTE-002	Discount above the owner's limit needs owner approval in Telegram.	Limit 5%, Azhar enters 8% → approval request	Owner
R-MSG-001	Free-form messages only inside the 24-hour window; templates outside it.	—	—
R-MSG-002	Opt-out stops all follow-up and marketing messages.	Customer writes stop	—
R-AI-001	AI-filled fields are saved only after customer confirmation and tagged AI until verified.	—	—
R-AI-002	AI never sets price, discount, stage Won, or payment.	—	—
R-TEAM-001	Deactivated members keep their history; their open deals are reassigned.	—	Owner
R-AUDIT-001	Every stage change, reassignment, discount and setting change is logged with who, when and old/new value.	—	—
Test format (example)
T-LEAD-003 — 15 minute response
Given: a lead arrives at 10:00 inside business hours, AI is off
When: no reply or call log by 10:15
Then: lead is red, staff gets Telegram alert at 10:15, owner at 10:30
And: a reply at 10:10 instead produces no alert
9. Hermes ops agent
Hermes is the team's operations manager: it chases staff, reports to the owner, watches the system, and reports bugs, but it never talks to customers or changes data directly.
Setup
•	Software: Hermes Agent (open source, Nous Research), self-hosted.
•	Server: Oracle Cloud Always Free first; a small paid VPS if Oracle is not available. Never the owner's laptop.
•	Brain: Gemini API free tier. Model is a setting; can switch to Claude or GPT.
•	Channel: one Telegram bot. Each member's Telegram username is stored in their CRM profile.
•	Connection to CRM: an AFIT CRM tool server (MCP) with a fixed tool list and its own limited API key.
Jobs
Job	What Hermes does	When
Morning list	Sends each staff member today's calls, visits and overdue follow-ups	9:00 daily
Response chase	Reminds staff of leads breaking R-LEAD-003 and R-LEAD-004; escalates to owner	Every 15 minutes in business hours
Nightly report	Leads in, called, first response under 15 min, visits fixed, quotes sent, won, lost, per staff	20:00 daily
Ask anything	Answers owner questions like "Kollam leads this week?" from CRM data	Any time
Data checks	Calls without outcome, deals stuck past time limit, Won without advance proof, AI fields never verified	Hourly
System health	Webhook silent too long, failed sends, AI errors, template rejections	Every 15 minutes
Weekly review	Lost and Junk list, ad-wise results, staff trend	Sunday 18:00
Approvals	Forwards discount and bug-fix approvals to the owner with Approve / Reject buttons	When raised
Tools Hermes may use
•	Read leads, deals, tasks, call logs, reports, system health
•	Create tasks and reminders
•	Send Telegram messages to team members
•	Write reports into the CRM
•	Create bug tickets in GitHub
Tools Hermes never gets
•	Delete or merge records
•	Change price, discount, stage, payment or settings
•	Send messages to customers
•	Direct database access or the database service key
Privacy rule: messages Hermes sends or sends to its model show lead number, area and service ("Lead #124 — Kollam — Gypsum") but not phone numbers or full names. Details open from a CRM link.
Bug flow
1.	Hermes detects an error and creates a GitHub ticket: what broke, when, how many leads affected, logs.
2.	Hermes alerts the owner on Telegram.
3.	Claude Code fixes it on a test copy and runs all tests.
4.	Owner gets "Bug #12 fix ready, tests pass. Approve?" and taps Approve.
5.	The fix goes live. A one-click rollback to the previous version is always available.
No fix reaches the live system without owner approval.
10. Owner dashboard and reports
The owner's dashboard answers one question first: are leads being handled, and where are they being lost?
Top row (today, 7 days, 30 days, custom)
•	Leads in
•	First response under 15 minutes (%)
•	Untouched leads (red)
•	Overdue follow-ups
•	Site visits fixed
•	Quotes sent and value
•	Won value
•	Expected business this month (open deal value × stage win chance)
Panels
•	Funnel: leads → contacted → qualified → visit → quote → won, with the drop between each stage
•	Ad results: per campaign and ad: leads, visits, won, won value (ad spend added after Meta connection)
•	Staff scorecard: response time, calls logged, follow-ups done on time, visits, quotes, won
•	Service split: gypsum vs interior
•	Lost reasons and Junk counts
•	Rule breaks today: each red item links to the lead
Every number opens the list of records behind it. No sample or made-up numbers on a live system; an empty system shows an empty state.
Staff view (mobile) starts on Today: overdue first, then due today, then new leads, each with a Call button.
11. Data model (version 1)
The existing tables (leads, profiles, conversations, messages, follow_ups, audit_logs) are inspected first and extended, not replaced.
Table	Holds	Key rules
profiles	Team members, role, Telegram username, active flag	Deactivate, never delete
roles, permissions, role_permissions	Role templates and tick-box permissions	Owner edits only
customers	One row per normalised phone number	Unique phone
deals	One enquiry per customer per service: service line, stage, owner, value, next follow-up, score, source	One open deal per customer per service
deal_stage_history	Every stage change with who, when, reason	Append only
pipelines, pipeline_stages	Stages per service, time limit, win %, entry rules, auto actions	Settings-driven
ad_attribution	ctwa_clid, ad id, campaign, headline, first message time	Saved once per deal
conversations, messages	WhatsApp threads and messages, media, direction, delivery status, window expiry	Provider id unique (no duplicates)
call_logs	Call start, outcome, notes, next date	Outcome required
follow_ups / tasks	Due actions per deal and person	—
site_visits	Date, assigned person, measurements, photos	—
quotations, quotation_lines	Versioned quotes, PDF link, status	Sent versions locked
projects	Created from Won deals: start, status, payments due	—
payments	Advance and part payments with proof	Never deleted, reversed with reason
keywords, ad_service_map	Service detection settings	Settings-driven
ai_question_sets, message_templates	AI questions and approved WhatsApp templates	Settings-driven
ai_suggestions	What the AI extracted, confirmation status, verified by	—
contact_preferences	Opt-in, opt-out per customer	Opt-out blocks sends
automation_jobs, automation_logs	Timers, reminders, retries, results	Each job runs once
agent_events	What Hermes read, sent and created	Append only
bug_tickets	Mirror of GitHub tickets with status	—
settings	Business hours, limits, provider choices, price ranges	Owner edits only
audit_logs	Privileged and financial actions	Append only
All tables have row-level security. Money uses fixed decimal types. Times are stored in UTC and shown in IST.
12. Settings: changes without code
Anything the business changes week to week lives in Settings; code changes are only for new modules, new integrations and bug fixes.
Settings page	Owner can change
Team	Add, deactivate, role, permissions, Telegram username
Services	Switch interior design and interior production on or off
Pipelines	Stage names, order, time limits, win %, auto actions
Keywords and ad mapping	Keyword list per service, ad → service
AI agent	Question sets, tone, per-sqft price range, draft or automatic mode, on or off
AI provider	Gemini, Claude or GPT for the customer agent; key stored securely
WhatsApp	Provider (WABIS or Meta), templates, business hours, opt-out words
Rules	15-minute timer, Hot-lead timer, minimum call attempts, discount limit
Reports	Nightly report time, who receives what
Branding	Logo, quotation footer, terms
Every settings change is audit-logged and can be undone from its history.
Needs Claude Code (with owner approval): new modules (stock, billing), new integrations, bug fixes, layout changes.
13. Cost plan
Testing runs almost entirely on free plans; only three things become paid at go-live, each because failure would lose leads or data.
Item	Testing	Live	Why paid at live
Meta ads	Paid	Paid	Ad budget
WABIS	Paid	Paid until Meta move, then none	—
WhatsApp messages (Meta)	Mostly free inside 24-hour and 72-hour windows	Templates outside window charged per message	Meta charges
Database (Supabase)	Free plan	Pro plan	Daily backups; free projects pause when idle
CRM hosting	Free (Cloudflare Pages / Workers, commercial use allowed)	Free	—
Hermes software	Free (open source)	Free	—
Hermes server	Oracle Cloud Always Free	Free, or small VPS if Oracle unavailable	Hermes must run 24 hours
Hermes model	Gemini API free tier	Free	Internal only, no customer details sent
Customer AI model	Gemini API free tier with test data only	Gemini API paid (Flash)	Free limits would stop replies; paid tier keeps customer data out of training
Telegram, GitHub	Free	Free	—
Claude Code	Existing Claude plan	Existing Claude plan	—
Gemini CLI (second reviewer)	Included with Gemini Pro subscription limits	Same	—
Domain	Free subdomain	Optional	—
Call recording	Not used	Optional later	—
The owner's Gemini Pro subscription covers the Gemini app and Gemini CLI, not API usage; the API key comes from Google AI Studio with its own billing.
Sources: WhatsApp API pricing India · CTWA 72-hour window · Supabase free tier · Vercel Hobby non-commercial · Gemini API free plan · Hermes integrations
14. Build phases
Each phase ends with its owner check passing on a phone; the next phase does not start before that.
1.	Phase 0 — Audit and clean-up. Inspect the existing Next.js app and Supabase project read-only; remove Broastin, Flutter and React-Vite references; confirm AFIT has its own Supabase project.
o	Owner check: a plain-language report of what exists and what will change.
2.	Phase 1 — Team and permissions. Add member, role templates, tick-box permissions, deactivate, Telegram username field.
o	Owner check: add a test member, change a permission, log in as them and see only what was allowed.
3.	Phase 2 — Lead intake through WABIS. Messaging adapter, webhook, customer and deal creation, ad attribution, service detection, conversation inbox.
o	Owner check: send a test WhatsApp message saying "gypsum plastering"; within one minute a gypsum deal appears with the right source.
4.	Phase 3 — Calls and follow-ups. Call button, compulsory outcome popup, next date, Today list, Lost and Junk rules.
o	Owner check: Azhar uses it for one day; the popup cannot be skipped.
5.	Phase 4 — Rules engine. Timers, red states, stage time limits, missed-call template, opt-out.
o	Owner check: leave a test lead unanswered; alerts arrive at 15 and 30 minutes.
6.	Phase 5 — Hermes and Telegram. Server, Telegram bot, CRM tool server, morning list, chase, nightly report, health checks, bug tickets.
o	Owner check: receive the nightly report; ask Hermes a question and get the right number.
7.	Phase 6 — Customer AI agent. Draft mode for two weeks, then automatic first reply and qualification with confirmation.
o	Owner check: ten test chats in English and Malayalam; no repeated service question, every saved field confirmed.
8.	Phase 7 — Site visit, quotation, Won. Visit booking, measurements, versioned quotation PDF, discount approval, advance proof, project creation.
o	Owner check: run one lead from first message to Won.
9.	Phase 8 — Owner dashboard. KPIs, funnel, ad results, staff scorecard.
o	Owner check: dashboard numbers match the lead list.
10.	Phase 9 — Move to Meta Cloud API. Number migration from WABIS, templates approved, Conversions API events.
o	Owner check: a real ad lead arrives with its click id; WABIS is switched off.
11.	Phase 10 — Interior pipelines on. Interior sales and production stages, question set, keywords.
o	Owner check: an interior test lead lands in the interior pipeline.
Every phase also passes: lint, type check, build, all rule tests (Section 8), and screen tests at 1440×900, 390×844 and 375×812 for Owner and Sales roles.
15. Rules for Claude Code and decisions log
Rules for Claude Code (copy into CLAUDE.md, keep it under 5 KB)
1.	This blueprint is the source of truth. If two documents disagree: Business rules (Section 8) > Pipelines (Section 7) > UI designs.
2.	Continue the existing Next.js + Supabase app. Do not start a new project or copy Broastin files.
3.	Audit before editing; inspect existing tables and design tokens before defining new ones.
4.	Build only the current phase. Never skip a phase's owner check.
5.	Every rule ID needs a passing test before the phase is called done.
6.	No database change on the live project without owner approval; additive migrations only.
7.	No secret keys in code, logs or screenshots.
8.	No fake numbers, dead buttons or pretend integrations; unfinished items are labelled.
9.	Settings-driven behaviour stays in Settings; never hard-code stages, keywords, templates or limits.
10.	End each phase with a plain-language report and an owner test checklist (English, with Malayalam notes).
11.	Update this blueprint first when a decision changes, then the code.
Decisions log
Date	Decision	Why
2026-10-25	Telegram is the only channel between Hermes and the team	Free, official bot API, staff added by username
2026-10-25	Hermes runs on an online server with Gemini API free tier, not Ollama	Must run 24 hours; local models weak in Malayalam and tool use
2026-10-25	Customer chat handled by the CRM agent, not Hermes	Official WhatsApp API, Meta rules, CRM rules enforced
2026-10-25	Customer AI on paid Gemini Flash at go-live	Reliability and customer data privacy
2026-10-25	Bug fixes need owner approval before going live	Prevent an AI fix from breaking lead intake
2026-10-24	App language English, Malayalam as an option	Owner preference
2026-10-24	Never re-ask the service when ad or message already states it	Customers name the service in their first reply
2026-10-24	WABIS now, Meta Cloud API direct later via provider setting	Avoid rebuild at migration
2026-10-23	Version 1 focuses on lead handling and accountability; ERP modules later	Missed leads are the main problem
2026-10-23	New staff added from Settings, no code	Owner requirement

