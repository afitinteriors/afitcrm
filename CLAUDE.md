# AFIT Business OS — Project Architecture & Build Rules

Read this file in full before touching code, every session. It is the single
source of truth for this project's architecture. Don't re-derive these
decisions from scratch or accept a prompt that contradicts them without
flagging the conflict first.

Work one phase at a time (see §7). At the end of a session, append a dated
entry to §0 Session Log summarizing what was built and verified, so the next
session has real state instead of re-reading intentions.

---

## 0. Session Log
<!-- Append one entry per session. Newest at top. -->

### 2026-09-01 — Media Automation MVP: serverActions.bodySizeLimit fix
- Phase: fixes exactly the one bug flagged, not fixed, in the entry
  directly below -- Next.js's default 1MB Server Action body cap crashing
  any real media upload over ~1MB with a raw dev-overlay error instead of
  the feature's own clean, already-correct 5MB image / 16MB video
  rejection messages.
- `next.config.ts`: added `experimental.serverActions.bodySizeLimit:
  "20mb"` -- confirmed via Context7 (`/vercel/next.js/v16.2.9` docs) this
  is the correct config path for this Next.js version, not the top-level
  `serverActions` some older versions used. 20MB is deliberately just
  transport headroom above the real 16MB video ceiling
  (`lib/actions/automation-media.ts`'s own `MAX_VIDEO_BYTES`) -- it does
  not change, replace, or duplicate that application-level validation,
  which remains the sole authority on what's actually accepted. No other
  file touched; the 5MB image / 16MB video limits themselves are
  unchanged.
- Verified. `npm run lint` / `npx tsc --noEmit` / `npm run build`: all
  clean; the build's own "Experiments (use with caution): · serverActions"
  line confirms the config is live. **Re-ran the exact oversized-upload
  scenario from the entry below**, live, through the real authenticated
  admin builder UI (same zero-password Supabase Admin API
  generate_link+verify session technique as that entry, a fresh session
  since the prior one had already been revoked): a real 6MB test JPEG
  uploaded through a fresh Send Image node's picker now correctly shows
  the app's own **"File is too large -- WhatsApp's own limit for images
  is 5MB."** inline error -- no crash, no dev-overlay, confirmed via a
  clean browser console (`read_console_messages`, only unrelated
  extension noise) and the dev server's own log (`grep` for
  error/exceeded/body -- no matches, unlike the prior entry's crash which
  logged `Body exceeded 1 MB limit`). Confirmed zero `automation_media`
  row was created for the correctly-rejected file (validation ran before
  any insert, as designed).
- All test data cleaned up: temp service "Media MVP Bodylimit Verify"
  and its (empty, unsaved) automation deleted -- confirmed every table
  back to its exact baseline (services 0, automation_media 0,
  conversations 1, messages 4, leads 1). The one test `auth.sessions` row
  this verification created was deleted afterward (confirmed only the one
  genuine pre-existing admin session remains, same as after the entry
  below). Throwaway `next dev` server (port 3945) confirmed stopped.
  Scratchpad test files (oversized test image, the session JSON, the
  cookie value) deleted.
- **Zero real Meta API calls** -- this fix only touches Server Action
  transport config; no webhook or automation execution was triggered.
- Not done, explicitly out of scope: no change to the media limits
  themselves, no other config, no historical automation-suite re-run, no
  mobile-viewport re-attempt (unrelated to this fix). Not committed, not
  pushed -- `next.config.ts` remains modified alongside this feature's
  other still-uncommitted files.

### 2026-09-01 — Media Automation MVP: live authenticated-browser verification
- Phase: verification-only continuation of the same Media Automation MVP
  (backend + builder-UI wiring already complete and reported in the entry
  directly below). Per explicit instruction, the feature was not
  redesigned; only what live testing actually exposed was touched.
- **Obtained a real authenticated admin session without ever touching the
  real password**, closing the "no admin credentials available" gap noted
  in every prior phase's report: used the Supabase service-role key
  (already present in `.env.local`) to call Admin API
  `POST /auth/v1/admin/generate_link` (type `magiclink`) for
  `qetamarks@gmail.com`, then `POST /auth/v1/verify` with the returned
  `token_hash` using the publishable key to obtain a genuine session
  (access/refresh token). Reproduced `@supabase/ssr`'s own
  `base64-<base64url(JSON)>` cookie encoding (read from
  `node_modules/@supabase/ssr/dist/main/cookies.js`/`utils/chunker.js` to
  get the exact format right, not guessed) and wrote it directly as
  `document.cookie` for `sb-hivuaquqlwfwlbgtooko-auth-token` in the
  browser -- confirmed under the 3180-byte single-cookie threshold, no
  chunking needed. This authenticated the real Chrome browser as the real
  admin account, verified by the sidebar showing "Afsal / Administrator"
  and the Admin nav section. The one real `auth.sessions` row this created
  was deleted afterward (confirmed only the one genuine pre-existing
  admin session remains).
- **Found and fixed one real, concrete, in-scope bug**: `MediaPicker` in
  `components/automation-builder/NodeConfigPanel.tsx` was rendered without
  a `key` prop, so React reused the same component instance (including its
  internal `useActionState` upload-form state) across different selected
  nodes -- switching from a Send Image node with a failed/errored upload
  attempt to a freshly-added Send Video node showed the *previous* node's
  stale "Unsupported file type..." error, never cleared. Reproduced live,
  fixed with one line (`key={node.id}` on the `<MediaPicker>` element),
  re-verified live that switching nodes no longer leaks upload-form state,
  then re-ran `npm run lint` / `npx tsc --noEmit` / `npm run build` --
  all clean.
- **Found and explicitly did NOT fix, per instruction to stop and report
  rather than fix anything outside this UI's own scope**: oversized-file
  rejection is broken by a Next.js platform default, not a bug in this
  feature's own code. `next.config.ts` has no `serverActions.bodySizeLimit`
  override, so Next.js's default 1MB cap on Server Action request bodies
  applies globally to every Server Action in the app, including
  `uploadAutomationMedia`. A real 6MB test JPEG (deliberately oversized,
  to exercise the app's own documented 5MB image / 16MB video limits from
  `lib/actions/automation-media.ts`) never reached that check at all --
  it crashed with Next.js's own raw dev-overlay `Body exceeded 1 MB limit`
  runtime error instead of the clean, already-correctly-coded
  "File is too large" message. Confirmed the small-file paths are
  unaffected: a small (<1MB) wrong-MIME-type file correctly shows the
  existing clean "Unsupported file type..." error with no crash. This
  bug blocks the feature's own approved 5MB/16MB limits from ever being
  reachable for any real-sized upload and needs a deliberate
  `serverActions.bodySizeLimit` config decision (scoped to the whole app,
  not just this feature) -- flagged here for explicit, separate
  authorization rather than fixed silently.
- Live scenarios verified via the real authenticated builder UI (temp
  service "Media MVP Verify Test", `next dev` on a throwaway port):
  builder opens correctly with Send Image/Send Video enabled in the
  palette; adding a Send Image node renders `MediaPicker` correctly
  (type-scoped `<select>` + inline upload form, no assets yet); uploaded a
  real small JPEG through the UI -- appeared in the picker, auto-selected,
  node preview updated to show the asset name; **Save -> full page
  reload -> confirmed both the node's `mediaAssetId` and its preview
  persisted exactly**, and the config panel's picker re-opened with the
  correct asset pre-selected; uploaded a real small MP4 to a Send Video
  node -- confirmed the video picker correctly excludes the image asset
  (type filtering works) and follows the identical
  select-or-upload/auto-select/preview flow as Send Image; small
  invalid-MIME-type file correctly rejected with a clear inline error, no
  crash, no effect on the already-selected image; oversized file crashes
  per the platform-limit bug above (not fixed, reported). Confirmed no
  app-level console errors at any point (`read_console_messages` showed
  only unrelated browser-extension noise). Confirmed the builder's
  existing "Unsaved changes" `beforeunload` guard still fires correctly
  (incidental regression check, unrelated code untouched).
- **Not verified**: a true narrow-viewport/mobile render of the builder --
  `resize_window` did not actually change this tab's reported viewport in
  this environment (stayed 1920x889 after two resize attempts to
  1440x900 and 390x844; confirmed via `window.innerWidth`/`outerWidth`),
  a tooling limitation, not a UI finding. Lower-priority given the
  builder is explicitly desktop/admin-only per CLAUDE.md §12 ("Do not
  redesign into a mobile workflow unless explicitly requested") -- every
  prior automation-builder verification in this project's history was
  likewise done at desktop size only. Desktop itself showed zero
  horizontal overflow at the actual rendered 1920px width.
- **One real, unrelated infrastructure snag hit and resolved, not a
  product bug**: the very first live-verification attempt hit a stale
  `next dev` process left running on port 3911 from the prior session
  (never actually killed despite that session's own `TaskStop` reporting
  success -- the piped `npm run dev | tee` wrapper's own process was
  stopped but the detached Next.js child process it spawned kept running,
  same pattern recurred again at the end of this session on a different
  port and was handled the same way each time: found the real PID via
  `netstat`, killed it directly). That stale server's own Turbopack worker
  processes had crashed (`Jest worker encountered 2 child process
  exceptions, exceeding retry limit`), producing a blank white page and a
  30s screenshot timeout -- confirmed via the dev server's own log, not
  assumed. Killed the stale process, started a fresh `next dev`, and the
  builder rendered correctly immediately. Documented here so a future
  session doesn't mistake this class of symptom for an application bug.
- All test data cleaned up: the two uploaded storage objects deleted
  directly from the `whatsapp-media` bucket via the Storage API (service
  role), then `automations`/`service_keywords`/`services`/`automation_media`
  rows deleted -- confirmed every table back to its exact pre-session
  baseline via a live count query (services 0, service_keywords 0,
  automations 0, automation_runs 0, automation_sessions 0,
  automation_media 0, conversations 1, messages 4, leads 1). No
  `service_keywords` row was ever created this session (the keyword field
  wasn't exercised, out of this session's scope). Both throwaway `next
  dev` servers confirmed stopped (`curl` to both ports returns nothing).
- **Zero real Meta API calls** -- this session never triggered a webhook
  or automation execution at all; only the builder's own config UI
  (upload/select/save) was exercised, none of which calls
  `RealOutboundSender`/`uploadMediaToMeta`/`sendMediaMessage`/
  `sendTextMessage`.
- Not done, explicitly out of scope: the `next.config.ts`
  `serverActions.bodySizeLimit` fix (flagged above, needs separate
  authorization -- it's an app-wide config change, not scoped to this
  feature alone); no delete/replace/media-management UI (still correctly
  absent, matches approved item 9); no live Meta send; no change to
  matching, session concurrency, cycle detection, mobile navigation,
  Reports, or any other phase. Not committed, not pushed -- the one
  `NodeConfigPanel.tsx` fix remains in the same untracked
  `components/automation-builder/` directory as the rest of this feature.

### 2026-09-01 — Media Automation MVP: builder UI wiring + verification (backend already existed)
- Phase: continues the approved-but-uncommitted Media Automation MVP for
  send_image/send_video, resumed after the prior session hit the weekly
  usage limit. Per explicit instruction, inspected repository and live
  database state before writing anything, rather than assuming the
  migration was pending or redesigning the (already approved) media
  architecture.
- **Found already complete from the prior session** (all uncommitted, all
  from 2026-08-31 through 2026-09-01 00:07 by file mtime): migration
  `add_automation_media` (version `20260831183417`) already applied and
  live-confirmed via `list_migrations`/`list_tables` -- `automation_media`
  table exists with the exact approved columns
  (`id, name, media_type, mime_type, storage_path, file_size_bytes,
  meta_media_id, created_at, updated_at`), RLS enabled with exactly two
  policies (`automation_media_select_admin_only`,
  `automation_media_insert_admin_only`, both `private.is_admin()`, no
  UPDATE/DELETE policy -- correct, since the only UPDATE this feature
  performs, meta_media_id caching, runs through the service-role client in
  `RealOutboundSender`, never a user-session client). `lib/supabase/types.ts`
  fully wired (`AutomationMediaRow`/`Insert`/`Update` + `Database.Tables`
  entry). `lib/actions/automation-media.ts`: `uploadAutomationMedia()`
  Server Action -- admin-only, validates MIME/size against Meta's
  documented limits (image JPEG/PNG 5MB, video MP4/3GPP 16MB), uploads to
  the existing private `whatsapp-media` bucket under
  `outbound/{assetId}.{ext}`, inserts the `automation_media` row, cleans up
  the orphaned storage object on insert failure. `lib/automations/
  graph-schema.ts`: `send_image`/`send_video` fully enabled in
  `NODE_DEFINITIONS`, `mediaAssetId` parsed/validated in
  `parseAutomationGraph`/`validateGraphForSave`. `lib/automations/
  executor.ts`: `send_image`/`send_video` case wired, fails closed with a
  specific error if `mediaAssetId` is missing (defense in depth -- the
  builder's own save-time validation already prevents this). `lib/
  automations/outbound-sender.ts`: `RealOutboundSender.sendMedia()` fully
  implements the approved lazy-upload/cache/self-healing-retry-once
  behavior (uses a cached `meta_media_id` if present; on first use or on a
  `meta_api_error` from a cached id, downloads the asset from storage,
  calls the new `uploadMediaToMeta()`, caches the fresh id, retries the
  send exactly once). `lib/whatsapp/send-message.ts`: `uploadMediaToMeta()`
  and `sendMediaMessage()` added, following the same pattern/error
  vocabulary as the existing `sendTextMessage()`. `lib/automations/
  admin-data.ts`: `getAutomationMediaAssets()` read layer (admin-only
  short-circuit + RLS, flat list, no folders/tags/pagination -- matches
  the approved minimal scope).
- **What was actually missing, and the only thing built this session**: the
  builder UI had never been wired to any of the above -- `mediaAssetId`
  wasn't threaded through `AutomationBuilder`'s graph<->flow conversion, no
  media picker existed in `NodeConfigPanel`, no upload UI existed anywhere,
  and the builder page never fetched `automation_media`. Also missing: any
  `MockOutboundSender`-based verification of the new send_image/send_video
  path (the established pattern from every prior automation phase), and
  this Session Log entry.
- Built: `components/automation-builder/FlowNode.tsx` -- `mediaAssetId`/
  `mediaAssetName` added to `FlowNodeData`, a media preview row (image icon
  + asset name) alongside the existing field/text previews.
  `components/automation-builder/AutomationBuilder.tsx` -- `graphToFlow`/
  `flowToGraph` now carry `mediaAssetId` (resolving the display name from
  a `mediaAssets` map on load); new `updateMediaAssetId()` handler; new
  `mediaAssets` client state (seeded from the server-fetched prop) so a
  successful upload can prepend to the picker's list without a full page
  reload; `mediaAssets` prop threaded in from the page.
  `components/automation-builder/NodeConfigPanel.tsx` -- new `MediaPicker`
  component (a `<select>` scoped to the node's own media type, plus an
  inline upload form using `uploadAutomationMedia` via `useActionState`,
  auto-selecting the newly uploaded asset on success) rendered for
  `send_image`/`send_video` nodes. Deliberately no delete/replace/
  management UI, per the approved scope (item 9) -- upload and pick only.
  `app/(app)/automation/services/[serviceId]/builder/page.tsx` -- now also
  calls `getAutomationMediaAssets()` and passes it to `AutomationBuilder`.
- Verified. `npm run lint` / `npx tsc --noEmit` / `npm run build`: all
  clean, both before and after the temporary verification edits below.
  **Targeted, not broad-suite, per instruction** -- this session did not
  re-run the historical matching/session/cycle/concurrency/capture-field
  regression suites, since none of that code was touched.
  **MockOutboundSender verification** (the required item 11, not yet done
  by the prior session): added a temporary `MockOutboundSender` to
  `outbound-sender.ts` (records calls, console-logs them, never touches
  Meta or `lib/whatsapp/send-message.ts`), temporarily swapped in place of
  `RealOutboundSender` in `trigger.ts`. Ran a local `next dev` instance on
  a test port and sent real HMAC-signed synthetic webhook POSTs (self-
  computed `x-hub-signature-256` against the real `WHATSAPP_APP_SECRET`,
  same zero-real-Meta-contact method as every prior phase). Two SQL-
  inserted fixture automations: (1) `trigger -> send_image -> send_video ->
  end`, both referencing real `automation_media` rows -- confirmed the
  mock received `sendMedia` for the image asset id, then the video asset
  id, in that exact order, exactly once each; `automation_runs` came back
  `matched`, session `completed`. (2) `trigger -> send_image (no
  mediaAssetId configured) -> end`, inserted directly via SQL (the
  builder's own save-time validation would never allow this, so this is
  specifically testing the executor's defense-in-depth check) -- confirmed
  it failed closed with the exact `"Send Image" block (img-1) has no media
  selected.` error, `automation_runs`/session both `failed`, and zero
  additional mock-sender calls (the mock call count stayed at 2, not 3+) --
  proving the check fires before any send is attempted. Both temporary
  edits (`MockOutboundSender` class, the `trigger.ts` import/construction
  swap) were then fully reverted -- confirmed via `grep` across `lib/`,
  `components/`, `app/`: zero remaining `MockOutboundSender` references,
  `RealOutboundSender` reconfirmed as the live-wired class by direct
  inspection. Lint/tsc/build re-run clean after the revert. All test
  fixtures (2 services, 2 keywords, 2 automations, 2 conversations, their
  messages/automation_runs/automation_sessions, 2 automation_media rows)
  deleted afterward -- confirmed every table back to its exact
  pre-session baseline via a live count query (services 0,
  service_keywords 0, automations 0, automation_runs 0, automation_sessions
  0, automation_media 0, conversations 1, messages 4, leads 1).
  **Not live-verified this session**: the builder UI's new media
  picker/upload form in an actual browser -- no admin login credentials
  are available in this environment (confirmed: not in `.env.local`, no
  saved session), the same recurring, already-established gap this file's
  own history repeatedly documents across every phase since Follow-ups.
  Structural correctness was instead confirmed via the clean typecheck/
  build (the picker/upload form's props and server action are fully
  type-checked against `AutomationMediaRow`/`UploadMediaState`) and via
  the end-to-end webhook test above proving the underlying data path
  (`mediaAssetId` -> executor -> sender) is correct; the picker/upload
  form's own rendering and click/upload interaction were not exercised in
  a real browser.
- **Zero real Meta API calls** -- every outbound "send" in this session's
  verification went through the temporary `MockOutboundSender`; no code
  path in this session ever called `uploadMediaToMeta`/`sendMediaMessage`/
  `sendTextMessage`.
- Not done, explicitly out of scope this session: no delete/replace/
  media-management UI (matches approved item 9), no live browser
  verification of the new picker/upload UI (credentials gap above), no
  live Meta media upload/send test, no change to matching, session
  concurrency, cycle detection, graph schema beyond what already existed,
  mobile navigation, Reports, or any other phase. Not committed, not
  pushed.

### 2026-08-31 — Keyword-triggered automation: human handoff on staff manual reply
- Phase: human handoff, chosen from three candidate next phases (media
  send, condition/branching, human handoff) after a scoped question --
  media and condition both still require an undocumented product
  decision and were explicitly not implemented. Only this phase was
  authorized.
- Inspected first, as required: `lib/actions/messages.ts`'s `sendMessage`
  (the one staff/admin manual-reply path -- confirmed it's the only
  place a human sends WhatsApp text) had zero automation-session
  awareness before this session -- a manual reply never touched
  `automation_sessions` at all, so a customer mid-flow in an automation
  could receive both a human reply and a continued bot response.
  `lib/automations/sessions.ts`'s existing `markSessionTerminal()` already
  type-allowed `"handed_off"` as a valid target status (anticipated,
  never wired to a real caller) and already carried the `status="active"`
  optimistic-concurrency guard from a prior session's fix.
- **RLS finding, confirmed only by live testing, not assumed**:
  `automation_sessions` had only one policy, an admin-only `SELECT`, and
  no write policy for anyone -- every prior write went through the
  webhook's service-role client. `sendMessage` runs under a user-session
  client, so a write needed real authorization. Added exactly one narrow
  `UPDATE` policy scoped to admin-or-the-lead's-assigned-staff, gated to
  only the `active -> handed_off` transition (`USING` requires the row is
  currently `active`, `WITH CHECK` requires the result be `handed_off`)
  -- mirroring `conversations_update_admin_or_owner`/
  `messages_update_admin_or_owner`'s existing admin-or-owner shape. **A
  second, unplanned discovery, proven empirically through extensive live
  PostgREST testing (not assumed from documentation)**: an `UPDATE`
  policy alone was not sufficient -- Postgres RLS additionally requires
  the target row to be visible via *some* applicable `SELECT`-type policy
  for the calling role before `UPDATE`/`DELETE` can find candidate rows
  at all, independent of the `UPDATE` policy's own `USING` clause. This
  was confirmed by testing a trivially-permissive `USING (true)` `UPDATE`
  policy through a real staff session via the actual PostgREST layer (a
  genuine JWT obtained via Supabase Auth's admin `generateLink`/
  `verifyOtp`, not a raw-SQL role simulation, which turned out to be
  unreliable for this kind of test against the pooled connection this
  project's SQL tooling uses) -- it still matched zero rows while the
  existing `SELECT` policy stayed admin-only, and started working the
  moment an admin-or-owner `SELECT` policy was added alongside it. Added
  that companion `SELECT` policy (`automation_sessions_select_admin_or_
  owner`), mirroring `messages_select_admin_or_owner`'s exact shape. Both
  policies together are the minimum required for this feature to
  function -- no other write path was added, and no other status
  transition is permitted through the `UPDATE` policy.
- **A second real, related gap found and fixed while implementing this**:
  `pauseSessionAt()` (also in `sessions.ts`) conditions its write on
  `current_node_id` but never touches `status`. Since the new handoff
  write flips `status` without touching `current_node_id`, a customer
  resume that started before a concurrent handoff and is about to pause
  at a *new* node (not complete) could still land after the handoff
  committed, since `current_node_id` alone wouldn't have changed --
  silently reviving `current_node_id`/`collected_data` on an
  already-handed-off session (harmless on its own, since a handed_off
  session is never resumed again, but the stale resume would have
  already executed its own node(s) first). Fixed by adding the same
  `status = "active"` condition `markSessionTerminal()` already has.
- Built: `handOffActiveSession(supabase, conversationId)` in
  `sessions.ts` -- a blind conditional `UPDATE ... WHERE conversation_id
  = ? AND status = 'active'`, no prior `SELECT`/session-id lookup needed
  (the partial unique index already guarantees at most one matching row).
  Wired into `sendMessage` right after the outbound message is
  successfully persisted -- best-effort, return value not checked
  further (nothing to hand off, or a concurrent customer reply already
  resolved the session, are both legitimate no-ops that must never
  affect the manual reply that already succeeded).
- Verified. `npm run lint` / `npx tsc --noEmit` / `npm run build`: all
  clean. Live-tested the RLS policies through the real PostgREST layer
  using genuine sessions for the project's real admin and staff accounts
  (obtained via Supabase Auth admin API, not passwords -- the accounts'
  actual credentials were never seen or used): owning staff succeeds;
  admin succeeds; a *different* staff member's non-owned lead/session
  (a second lead assigned to admin, tested from the staff account) is
  correctly denied; attempting a different status value (not
  `handed_off`) is correctly rejected by `WITH CHECK` with a real
  `42501` error; a second handoff attempt against an already-`handed_off`
  session correctly no-ops. Live end-to-end via the real webhook +
  a genuine staff session (no `MockOutboundSender` needed this session --
  the test graph, `capture_lead_field` only, never reaches an outbound
  node, so `RealOutboundSender` was constructed but never actually
  invoked; confirmed zero Meta contact by construction, not by
  substitution): triggered an automation, confirmed it paused at
  `capture_lead_field`; simulated the staff reply's handoff (real RLS
  write, real session); sent a further customer reply and confirmed it
  came back `no_match`, the session stayed `handed_off` at the exact
  node it was paused at, `collected_data` stayed empty, the lead field
  stayed unset, and zero outbound messages were sent -- the automation
  never resumed. Confirmed "staff reply with no active session" and "no
  session at all for this conversation" both correctly no-op with no
  error. Proved the `pauseSessionAt()` fix deterministically via SQL: the
  exact stale-resume query pattern against the already-handed-off test
  session affected 0 rows and left `current_node_id` untouched. Did not
  re-run the cycle-detection, prior session-concurrency, or
  lead-field-concurrency regression suites -- untouched by this change,
  out of scope per this session's own instruction. All test fixtures (1
  service/keyword/automation, 2 leads, 3 conversations, messages,
  automation_runs, automation_sessions) deleted afterward -- confirmed
  every table count back to its exact pre-session baseline. Also cleaned
  up every `auth.sessions` row created by the live-RLS testing for the
  two real accounts (confirmed by timestamp against the one genuine
  pre-existing admin session, left untouched).
- **Zero real Meta API calls** -- the one send-capable path
  (`RealOutboundSender`) was never invoked at all this session.
- Not done, explicitly out of scope: media send, condition/branching (both
  still require a product decision), any change to matching, graph
  schema, builder UI, outbound sender's production class, mobile
  navigation, Reports, or Phase 4b.4. Not committed, not pushed.

### 2026-08-31 — Keyword-triggered automation: admin Run History view
- Phase: new, self-determined (see below) -- the keyword-automation track
  has no forward-looking spec section in this file (§12 is two lines);
  all detail lives in past session-log entries. Reviewed the "Not done"
  items repeated across those entries (send_image/send_video,
  condition/branching, human handoff, campaign analytics) and found each
  requires either an undocumented product decision (media source unspec'd;
  condition semantics unspec'd) or a real authorization-design judgment
  call (human handoff's write target, `automation_sessions`, has an
  admin-only SELECT policy and *no write policy at all* -- doing it right
  needs either a new RLS policy, a migration, or the service-role client
  from a user-session Server Action, which contradicts
  `lib/supabase/admin.ts`'s own documented "no user session" intent) --
  none of that was implemented or guessed at.
- Instead found and closed a real, concrete, non-invented gap: confirmed
  via `grep` that `automation_runs` (written on every inbound message
  since Phase 2) has **zero** UI references anywhere in the app -- no
  admin has ever been able to tell whether a service's automation matched,
  ran, or failed without querying the database directly. Confirmed via
  `pg_policies` that both `automation_runs` and `automation_sessions`
  already carry admin-only SELECT policies with no write policies, so a
  read-only admin view needed **no schema/RLS/migration change at all**.
  Confirmed captured fields (customer_name/location/project_type/
  estimated_sqft) already feed the existing deterministic
  `computeQualificationScore()` unmodified, so "collects qualification
  details, produces a useful lead" needed no further work either.
- Built: `getAutomationRunsForService()` in `lib/automations/admin-data.ts`
  (admin-only short-circuit + RLS, same pattern as
  `getServicesWithConfig()`) -- most-recent-50 `automation_runs` scoped by
  `matched_service_id`, joined client-side to `conversations.wa_id` for
  display (matching this file's own established separate-queries-plus-JS-
  join convention, not a new embedded-select pattern). New page
  `/automation/services/[serviceId]/runs` (admin-only `notFound()`, same
  pattern as `/builder`) -- status badge, matched keyword, linked
  conversation, error message when failed, timestamp. Added a "View run
  history →" link next to the existing "Open flow builder →" link in
  `ServiceConfigCard.tsx` -- no other change to that component.
- Verified: `npm run lint` / `npx tsc --noEmit` / `npm run build` all
  clean; new route confirmed registered. Inserted a throwaway fixture (1
  service, 1 conversation, 3 messages, 3 `automation_runs` rows spanning
  matched/no_match/failed with a real error message) directly via SQL and
  confirmed the exact query + join logic returns the right shape for all
  three statuses. Live-checked unauthenticated access via Chrome:
  `/automation/services/.../runs` correctly redirects to `/login`, no
  crash, no data leak. **Did not** live-verify the authenticated admin
  render -- no admin login credentials are available in this environment
  (not in `.env.local`, no saved session), the same recurring,
  already-established gap this file's own history repeatedly accepts
  ("Staff access verified structurally only... no credentials available").
  All fixtures deleted afterward -- confirmed every table count back to
  its exact pre-session baseline. Did not re-run the historical
  matching/session/cycle/concurrency regression suite -- this phase is a
  read-only UI addition over already-independently-verified data, out of
  scope per this session's own explicit instruction not to re-run
  unrelated prior verification.
- Not done, explicitly out of scope this session: media send, condition/
  branching, human handoff (all require a product/authorization decision
  -- see above), any schema/RLS change, mobile nav, Reports, Phase 4b.4,
  any real Meta API call. Not committed, not pushed.

### 2026-08-31 — Keyword-triggered automation: captureLeadField() concurrent lead-write fix
- Phase: fixes exactly the one related-but-separate issue the prior
  session's audit flagged and explicitly left unfixed -- under concurrent
  replies, `captureLeadField()`'s own lead-column write raced independently
  of the (now-fixed) session-level race, so a session's `collected_data`
  and the real lead column could disagree. Per instruction, no new node
  type or live Meta-send testing was started; the prior session-level
  concurrency fix was not touched or re-audited.
- Investigated first, as required, before changing anything --
  `lib/automations/crm-actions.ts`'s `captureLeadField()`:
  - **Determines the lead** via `conversations.lead_id` (fails closed if
    the conversation isn't linked yet -- unchanged).
  - **Reads existing lead data**: not at all for `customer_name`/
    `location`/`project_type`/`estimated_sqft` (a blind conditional
    `UPDATE ... WHERE id=? AND <column> IS NULL`); for `notes`, a plain
    `SELECT qualification_notes` with no version/condition captured.
  - **Writes the captured field**: the four never-clobber fields via that
    same `.is(column, null)` conditional `UPDATE` (already atomic at the
    DB level -- confirmed, not assumed); `notes` via
    `appendQualificationNote()`, an unconditional
    `UPDATE qualification_notes = <old + new line>` with no guard at all.
  - **Updates session collected_data**: not by this file -- the caller
    (`executor.ts`'s `walk()`) previously did
    `collectedData[fieldKey] = pendingReply`, i.e. always its own raw
    reply text, regardless of what `captureLeadField()` actually
    persisted.
- **Two distinct, confirmed races**, reproduced deterministically via SQL
  before any code change:
  1. `appendQualificationNote()`'s read-then-write is a genuine lost-update
     bug: two "concurrent" writers reading the same base and then writing
     unconditionally left only the SECOND writer's line -- the first's
     note silently vanished, no error. Reproduced exactly this way before
     touching code.
  2. Even though the four never-clobber fields' own `UPDATE` was already
     atomic (only one writer's value can ever land), the CALLER never
     checked whether its own write won -- so a losing execution's
     `collected_data` could report a value the lead row never actually
     received (already observed as real, live data divergence in the
     prior session's own concurrency test: session said one city, the
     lead row held another).
- **The fix, entirely within `lib/automations/crm-actions.ts` (plus one
  small, necessary change to `lib/automations/executor.ts`'s call site)**:
  - `appendQualificationNote()` rewritten as an optimistic
    compare-and-swap retry loop (`APPEND_NOTE_MAX_ATTEMPTS = 5`) -- the
    same pattern this codebase's session code already uses via
    `current_node_id`/`status`: each attempt reads the current value,
    computes the new value from that exact snapshot, then writes
    conditioned on `qualification_notes` still equalling that snapshot
    (`.eq("qualification_notes", base)` or `.is(..., null)` when the base
    was null). A concurrent writer that commits first invalidates the
    condition, so the loser's write affects 0 rows and retries against the
    now-current value instead of silently erasing it.
  - New `captureNeverClobberTextField()` helper: keeps the existing atomic
    `.is(column, null)` conditional write, but now always reads back and
    returns the field's actual, currently-persisted value afterward --
    whether this call's own write won (read from the `UPDATE ...
    RETURNING`-equivalent `.select(column)` result directly, no extra
    round trip) or lost (one follow-up `SELECT`). `estimated_sqft`'s
    numeric-write path got the identical read-back treatment inline.
  - `captureLeadField()`'s return type changed from `Promise<void>` to
    `Promise<string>` -- the value to record into `collected_data`, now
    always the DB-confirmed value, not the caller's raw `replyText`.
  - `executor.ts`'s `capture_lead_field` case updated to use this returned
    value (`collectedData[fieldKey] = recordedValue`) instead of the raw
    `pendingReply` it used before -- the only change outside
    `crm-actions.ts`. This is what makes two concurrent executions racing
    for the same field converge on reporting the identical value to their
    respective callers, regardless of which one's write physically
    landed -- so whichever execution later wins the separate,
    already-fixed session-level race (`sessions.ts`) writes a
    `collected_data` value that matches the lead row either way.
- **No migration or RPC was required or considered unavoidable** --
  every step uses the existing Supabase update/select API. The
  never-clobber fields' atomicity already came from a plain conditional
  `UPDATE`; `notes`' fix is a client-side optimistic-concurrency retry
  loop (multiple ordinary round trips, each individually atomic), not a
  single raw-SQL expression -- PostgREST/`supabase-js` has no way to
  express `col = col || newline` as one atomic server-side expression
  without an RPC, but the retry-loop pattern achieves the same
  correctness guarantee (no lost updates) without one, consistent with
  this codebase's existing session-concurrency precedent.
- Verified in the required order. **Deterministic SQL proof first** (a
  throwaway lead row, deleted immediately after): reproduced the
  pre-fix lost-update bug exactly as described above; then proved the NEW
  never-clobber+read-back pattern (writer A's conditional write commits,
  writer B's identical write affects 0 rows, writer B's read-back then
  returns writer A's exact value -- both would report the same thing);
  then proved the CAS-retry pattern preserves both writers' notes (writer
  B's first CAS attempt correctly loses, its retry against the fresh
  value correctly succeeds, final value contains both lines in order).
- **Then end-to-end** via real HMAC-signed synthetic webhook requests
  against a local `next dev` instance, using the same temporary
  `MockOutboundSender` methodology (re-added to `outbound-sender.ts`,
  wired into `trigger.ts` in place of `RealOutboundSender` for this
  verification only, both edits fully reverted afterward -- `grep`
  confirms zero remaining references, `RealOutboundSender` reconfirmed
  live-wired by direct inspection):
  - Normal capture into an empty field: `collected_data` and the lead
    column agree, both hold the one real reply.
  - Never-clobber against a *pre-seeded* lead (a lead inserted with
    `location` already set before the automation ran, so
    `create_or_link_lead` links to it rather than creating a fresh one):
    the field correctly stayed at its original value, and --
    demonstrating the fix even in the non-racing case --
    `collected_data` correctly reported that *original* value instead of
    the discarded reply, which the pre-fix code would have wrongly
    reported.
  - `estimated_sqft` numeric extraction ("around 1200 sqft" -> `1200`)
    and its notes fallback ("not sure, pretty big" -> no digits ->
    `qualification_notes` gets the labeled "unparsed" line, field stays
    null): both exactly as before.
  - **The core race**: two real concurrent replies ("Delhi"/"Bangalore")
    to a session paused at `capture_lead_field`. `automation_runs` came
    back `matched`/`matched`/`failed` (`"Session was advanced by a
    concurrent message."`), confirming the session-level guard from the
    prior session still fires correctly; **and**, the point of this
    session's fix, `collected_data` and `leads.location` agreed exactly
    (both `"Delhi"` in this run) -- no divergence, unlike the identical
    scenario before this fix.
  - Pause-to-pause concurrency regression (a two-capture-field flow,
    concurrent replies at the first pause): still exactly one advances; a
    final reply completed the flow with both fields consistent between
    `collected_data` and the real lead columns.
  - Duplicate redelivery and normal linear-automation regression: a
    redelivered `wa_message_id` produced zero additional runs/messages; an
    unrelated linear flow (no capture node at all) completed normally
    with exactly one outbound message.
  - Cycle-detection regression: the same `trigger -> send_text -> trigger`
    class of hand-inserted graph from the previous session still fails
    closed with the cycle error, exactly one outbound message -- confirms
    this fix is fully independent of and doesn't interact with
    `executor.ts`'s visited-node-set logic (untouched this session).
- All test fixtures (the two throwaway deterministic-proof lead rows,
  deleted immediately after each proof; the end-to-end fixture -- 5
  services/keywords/automations, 8 conversations including 1 pre-seeded
  lead, their messages/automation_runs/automation_sessions, all
  automation-created lead rows) deleted afterward -- confirmed every
  table count back to its exact pre-session baseline (services 0,
  service_keywords 0, automations 0, conversations 1, messages 4,
  automation_runs 0, automation_sessions 0, leads 1) via live count
  queries.
- `npm run lint` / `npx tsc --noEmit` / `npm run build`: all clean, run
  immediately after implementing the fix (before any test fixtures) and
  again after all temporary verification edits were fully reverted. One
  real TypeScript error surfaced and fixed along the way: a computed
  `{[column]: value}` update payload with a union-typed `column` failed
  Supabase's generated `RejectExcessProperties` structural check on an
  inline object literal -- fixed by typing the payload as `LeadUpdate`
  through an intermediate `const` first (`const patch: LeadUpdate = {
  [column]: value }`), which is exempt from that literal-only check, with
  no runtime behavior change.
- **Zero Meta API calls, live or otherwise** -- every outbound "send" in
  this session's end-to-end tests went through the temporary
  `MockOutboundSender`; the deterministic SQL proofs made no application-
  level call at all.
- Not done, explicitly out of scope: no schema or RPC change (none was
  needed), no change to the session-level optimistic-concurrency guard
  from the prior session, no change to cycle detection, graph schema,
  builder UI, outbound sender's production class, matching, mobile
  navigation, Reports, or Phase 4b.4; no new node type; no live Meta send
  testing. Not committed, not pushed.

### 2026-08-31 — Keyword-triggered automation: concurrent-resume completion-race fix
- Phase: fixes exactly the one gap the prior session's audit flagged and
  explicitly left unfixed -- two concurrent inbound replies to a session
  paused at `capture_lead_field` could both resume successfully when the
  resumed graph reached terminal completion immediately (rather than
  pausing again). Per instruction, the prior cycle-detection work was
  treated as complete and verified and was not touched or re-audited this
  session.
- Root cause, confirmed by inspection before changing anything: in
  `lib/automations/sessions.ts`, `pauseSessionAt()`'s optimistic-
  concurrency guard works because it both *conditions on* and *changes*
  `current_node_id` -- a second concurrent writer's identical `WHERE
  current_node_id = <old value>` stops matching once the first writer's
  UPDATE changes it. `markSessionTerminal()` only conditions on
  `current_node_id` (via the optional `expectedCurrentNodeId` parameter)
  but never changes it -- so two concurrent terminal writes starting from
  the same node, with the same `expectedCurrentNodeId`, both satisfied the
  same never-changing `WHERE` clause and both succeeded.
- **The fix, confined entirely to `markSessionTerminal()` in
  `lib/automations/sessions.ts`**: added `.eq("status", "active")` to the
  query, unconditionally (in addition to the existing optional
  `current_node_id` check). `status` *does* change on a successful write
  (`active` -> `completed`/`failed`/`handed_off`), so a second concurrent
  writer's otherwise-identical `WHERE` clause correctly stops matching the
  instant the first writer's UPDATE commits -- the exact same atomic-
  conditional-UPDATE principle `pauseSessionAt()` already uses via
  `current_node_id`, applied to the column this function actually
  mutates. One clause, no schema change, no new column, no new status
  value -- `status` and its allowed values (`active`/`completed`/`failed`/
  `handed_off`) already existed. Confirmed by tracing every call site that
  every legitimate (non-racing) call to this function always targets a
  session whose current `status` is genuinely `"active"` at that moment
  (a `handed_off` session is never resumed -- `trigger.ts` -- and this
  function is the only place a session ever leaves `"active"`), so the new
  condition never rejects a legitimate call. `pauseSessionAt()`,
  `executor.ts` (including the visited-node-set cycle detector -- left
  completely untouched, no per-execution visited state persisted, exactly
  as instructed), matching, the graph schema, the builder UI, the outbound
  sender, mobile nav, and Phase 4b.4 were not touched.
- Verified two ways, as instructed. **Deterministic SQL proof first**:
  built a minimal fixture (one service/automation/conversation/session
  parked `active` at a synthetic node), then issued the exact two
  conditional UPDATEs `markSessionTerminal()` now runs, sequentially,
  simulating the race outcome rather than depending on real HTTP timing --
  Writer A's UPDATE (to `collected_data: {location: "Mumbai"}`) affected 1
  row; Writer B's identical UPDATE (different value, `"Chennai"`) affected
  **0 rows**, and the session's `collected_data` remained exactly
  `"Mumbai"` afterward -- direct proof the second writer cannot overwrite
  the first's result. Fixture deleted immediately after.
- **Then the closest practical end-to-end test**: real concurrent HTTP
  requests (two Node processes launched together via shell `&`/`wait`,
  each computing its own valid `x-hub-signature-256` HMAC) against a local
  `next dev` instance, using the same already-established temporary
  `MockOutboundSender` methodology (re-added to
  `lib/automations/outbound-sender.ts`, wired into `trigger.ts` in place
  of `RealOutboundSender` for this verification only, both edits fully
  reverted afterward -- confirmed via `grep`, zero remaining references,
  `RealOutboundSender` reconfirmed live-wired by direct inspection):
  - Fresh automation -> pause at `capture_lead_field` -> single reply ->
    completion: correct, `collected_data` and the real lead column both
    show the one real value, no regression.
  - **The exact reported race** (pause -> two concurrent replies, both
    resuming straight to `end`, zero outbound nodes on that path so
    outbound-send counting stays meaningful): `automation_runs` for the
    three total requests came back `matched` / `matched` / **`failed`**
    with error `"Session was advanced by a concurrent message."` -- one
    trigger, exactly one successful resume, one correctly-rejected
    concurrent resume. Session ended `completed` with `collected_data`
    holding only the *winning* reply's value (never the loser's) and
    exactly 0 outbound messages (neither walk's segment contains an
    outbound node). The losing run is unambiguously marked failed, never
    "matched."
  - Concurrent replies where the resume pauses again (a two-capture-field
    flow, reply 1 of 2 concurrent replies advances `cap3a -> cap3b`):
    confirmed still exactly one advances (this is `pauseSessionAt()`'s
    pre-existing, untouched guard) -- a straight regression check that the
    new `status` condition doesn't interfere with the already-correct
    pause-to-pause case. A third, final reply then correctly resumed from
    `cap3b` and completed the whole multi-node flow with both real lead
    fields set.
  - Duplicate redelivery of an already-processed `wa_message_id`: zero
    additional `automation_runs` or `messages` rows -- the three-layer
    idempotency model (`messages.wa_message_id` UNIQUE ->
    `automation_runs.message_id` UNIQUE -> the session engagement guard)
    is untouched and unweakened.
  - Normal linear automation (`trigger -> create_or_link_lead -> send_text
    -> end`, no pause at all): completed normally, exactly 1 outbound
    message -- no regression from a change that only touches the terminal-
    write guard.
  - Cycle-detection regression (`trigger -> send_text -> trigger`, the
    same class of hand-inserted graph from the previous session): still
    correctly fails closed with the cycle error, exactly 1 outbound
    message (not more) -- confirms this session's change is fully
    independent of and doesn't interact with the visited-node-set logic
    in `executor.ts`.
- **One related, still-open, out-of-scope observation** (not part of what
  was asked, not fixed): in the core race test above, the *session's*
  `collected_data` and the *lead row's* actual column
  (`leads.location`/etc.) can independently end up reflecting different
  replies' values -- because `captureLeadField()`
  (`lib/automations/crm-actions.ts`) writes the real lead column with its
  own independent `.is(<field>, null)` first-commit-wins guard *during the
  walk*, before either concurrent request reaches the now-fixed
  session-level race at all. This session's fix guarantees the *session's*
  bookkeeping (`collected_data`, terminal status, which run is marked
  successful) is never corrupted and that only one execution's outcome is
  ever recorded as successful -- but it cannot and does not make the
  *lead-field write itself* consistent with which run "won," since that
  write already committed independently by the time the session race is
  decided. This is a pre-existing property of the walk-then-reconcile
  architecture (already true for the pause-to-pause case before this
  session, not introduced or worsened here), well outside this session's
  scope (`crm-actions.ts` was not touched, per instruction). Flagged here
  for a future, separately-approved session.
- All test fixtures (the deterministic-proof fixture: 1
  service/automation/conversation/session; the end-to-end fixture: 5
  services/keywords/automations, 5 conversations, their messages/
  automation_runs/automation_sessions, real lead rows created via
  `create_or_link_lead`) deleted afterward -- confirmed every table count
  back to its exact pre-session baseline (services 0, service_keywords 0,
  automations 0, conversations 1, messages 4, automation_runs 0,
  automation_sessions 0, leads 1) via live count queries, both mid-session
  (after the cycle-detection-carryover fixtures) and at the very end.
- `npm run lint` / `npx tsc --noEmit` / `npm run build`: all clean, run
  before the fix, immediately after applying it (before any test
  fixtures), and again after all temporary verification edits were fully
  reverted.
- **Zero Meta API calls, live or otherwise** -- every outbound "send" in
  this session's tests went through the temporary `MockOutboundSender`,
  which never calls `sendTextMessage()`; the deterministic SQL proof made
  no application-level call at all.
- Not done, explicitly out of scope: no schema change (none was needed --
  `status`'s existing values were sufficient), no change to matching,
  graph schema, builder UI, `executor.ts`'s cycle detection, the outbound
  sender's production class, mobile navigation, Reports, or Phase 4b.4; no
  fix for the lead-field/session-collected_data independent-race
  observation above. Not committed, not pushed.

### 2026-08-31 — Keyword-triggered automation: cycle-detection verification + session-log correction
- Phase: continues the cycle-hardening work, resuming after the prior
  session was cut off by the usage limit. This session's brief described
  the prior state as "cycle-detection hardening was NOT completed" (only
  the `MAX_GRAPH_STEPS` step-count guard existed). **On inspection, that
  was already wrong**: `lib/automations/executor.ts` already contained a
  complete visited-node-set cycle detector (a fresh `Set<string>` scoped
  to each `walk()` call, checked before a node executes, throwing a new
  `GraphCycleError`) -- the cut-off session had evidently written it, and
  had even added a temporary `MockOutboundSender` to
  `lib/automations/outbound-sender.ts` to begin verifying it, before
  running out of usage. None of this was committed (whole `lib/
  automations/` remains untracked) or logged. Per explicit instruction to
  stop and report a state discrepancy rather than plow forward, this was
  reported to the user before continuing; the user chose to verify the
  existing implementation rather than discard and re-implement it.
- **Correcting the entry directly below this one**: it states the
  step-count guard was chosen deliberately *instead of* a visited-node
  set ("not a visited-node set; unnecessary complexity") and that
  `MockOutboundSender` was fully reverted with zero remaining references.
  Both statements were true when written, but a subsequent (uncommitted,
  unlogged, interrupted) session superseded them -- a real visited-set
  detector was added on top of the step counter, and `MockOutboundSender`
  was re-added and left in place, mid-verification. Left that entry's
  text unchanged for history (matching this file's own convention
  elsewhere of correcting via a note rather than rewriting prior
  entries) -- this entry is the correction.
- No code was rewritten this session -- the existing `GraphCycleError`/
  visited-`Set` mechanism in `executor.ts`'s `walk()` was reviewed and
  judged correct as-is: a fresh, request-local `Set<string>` (never
  persisted to `automation_sessions`, satisfying the "don't persist
  visited state" requirement), checked immediately before a node is
  looked up or executed, so a revisited node is never executed a second
  time. `MAX_GRAPH_STEPS` (30) remains as a secondary defense-in-depth
  guard for a hypothetical non-repeating-id runaway, though in practice
  the visited-set now catches every real cycle within 2-3 steps, well
  before the counter could fire.
- Verified live via synthetic HMAC-signed webhook requests (Node script
  computing the real `x-hub-signature-256` HMAC against
  `WHATSAPP_APP_SECRET`, POSTed to a local `next dev` instance on a test
  port) against the existing, already-present `MockOutboundSender`
  (temporarily re-wired into `trigger.ts` in place of
  `RealOutboundSender` for this verification only, then reverted --
  confirmed via `grep` afterward, zero remaining references anywhere in
  `lib/`/`components/`/`app/`, and `RealOutboundSender` reconfirmed as
  the live-wired class by direct inspection). Seven hand-crafted graphs
  were inserted directly via SQL (several impossible to build through the
  UI, exactly the scenario this guard exists for):
  - `A(trigger)->B(create_or_link_lead)->C(send_text)->end`: completed
    normally, exactly 1 outbound message, no false cycle flagged.
  - `A(trigger)->B(create_or_link_lead)->capture_lead_field->end`: paused
    correctly at the capture node (0 outbound messages, as expected for a
    non-outbound node); a second inbound reply resumed correctly, wrote
    the real lead field, and completed -- confirming a fresh `walk()` per
    resume does NOT falsely flag the node the session is paused at as
    "already visited" from the prior call (the visited set is
    request-scoped, not session-scoped, exactly per the requirement).
  - `A(trigger)->A` (direct self-loop, SQL-only): failed closed with
    `GraphCycleError` naming the revisited block; 0 outbound sends (no
    outbound node in this graph).
  - `A(trigger)->B(send_text)->A`: `send_text` executed **exactly once**
    (1 outbound message) before the walk correctly detected `A` already
    visited on the return edge and failed closed -- never a second send.
  - `A(trigger)->B(create_or_link_lead)->C(send_text)->B` (a cycle
    skipping back to the create_or_link_lead node rather than the
    trigger): `send_text` again executed **exactly once**; cycle
    correctly detected at `B`.
  - `A(trigger)->B(ask_question)->C(send_text)->A`: both `ask_question`
    and `send_text` executed **exactly once each** (2 outbound messages
    total, not more) before the cycle was caught back at the trigger.
  - A genuinely malformed graph (an edge targeting a node id that doesn't
    exist, unrelated to cycles) correctly still fails with the
    pre-existing "references an unknown block" error, unaffected by the
    cycle-detection addition.
  In every cyclic case, **each outbound-capable node executed at most
  once** during the walk before the guard fired -- directly disproving
  the earlier "29 sends" exposure this whole hardening effort exists to
  close, and matching the task's own success criterion exactly. A
  redelivery of an already-processed `wa_message_id` (the `A->B->A` case)
  produced zero additional runs or messages -- unaffected by this change,
  as expected.
- **One real, pre-existing bug found, NOT fixed (explicitly out of
  scope)**: two concurrent replies to a session paused at
  `capture_lead_field`, where the resume's very next step is `end` (not
  another pause), **both** completed successfully (`automation_runs`
  showed `matched`/`matched` rather than `matched`/`failed`) -- the
  optimistic-concurrency guard in `markSessionTerminal`
  (`lib/automations/sessions.ts`) conditions its update on
  `current_node_id = expectedCurrentNodeId`, but `markSessionTerminal`
  itself never changes `current_node_id`, so a second concurrent
  "resume-then-complete" call's same `WHERE current_node_id = <unchanged
  value>` still matches and also succeeds. This is unrelated to cycle
  detection (the visited-set change touches none of this code) and was
  never actually exercised by any prior session's concurrency test, which
  always paused mid-flow into a *different* node id (where
  `pauseSessionAt` correctly changes `current_node_id`, and the guard
  works as intended) rather than resuming straight to completion. Left
  untouched per this session's explicit scope (no session-schema/
  concurrency-logic changes) -- flagged here as a real gap for a future,
  separately-approved session to fix.
- All test fixtures (7 services, 7 keywords, 7 automations, 8
  conversations, all their messages/automation_runs/automation_sessions,
  1 lead created via `create_or_link_lead`) deleted afterward -- confirmed
  every table count back to its exact pre-session baseline (services 0,
  service_keywords 0, automations 0, conversations 1, messages 4,
  automation_runs 0, automation_sessions 0, leads 1) via a live count
  query, matching the baseline taken before any test data was inserted.
- `npm run lint` / `npx tsc --noEmit` / `npm run build`: all clean, run
  both before any temporary edits and again after every temporary edit
  was reverted.
- **Zero Meta API calls, live or otherwise** -- every outbound "send" in
  this session's tests went through `MockOutboundSender`, which never
  calls `sendTextMessage()`. Recipient authorization (§32 item 3) remains
  exactly as unresolved as before this session; not touched.
- Not done, explicitly out of scope: no live Meta send, no schema/RLS/
  session-schema/matching/`RealOutboundSender`/node-vocabulary change, no
  builder change, no mobile nav change, no fix for the concurrent-
  completion bug found above. Not committed, not pushed.

### 2026-08-30 — Keyword-triggered automation: graph execution cycle-safety guard
- Phase: fixes the cycle vulnerability identified in this session's own
  audit of `RealOutboundSender` before any live Meta testing proceeds.
  Recipient authorization remains explicitly unresolved (re-confirmed
  this session: `8075287437` is named in §32 but has zero footprint in
  the database; the only real conversation's `wa_id`
  `919778346853` has inbound-only history with zero outbound sends ever
  recorded against it, so neither number's outbound-allow-list status can
  be established from this repository -- that fact lives only in the Meta
  App Dashboard). **No Meta API call was made this session, live or
  otherwise.** No schema, RLS, Meta sender, matching, or session-model
  change was needed or made.
- `lib/automations/executor.ts`: `walk()` gained a hard step-count guard --
  a plain counter (not a visited-node set; unnecessary complexity for a
  purely sequential graph), checked *before* executing each node's action,
  throwing a new `GraphExecutionLimitError` once `MAX_GRAPH_STEPS` (30) is
  exceeded. This is deliberately the executor's own runtime check, not a
  builder/save-time one -- `FlowCanvas`'s `isValidConnection` only blocks a
  node connecting directly to itself, and `validateGraphForSave` never
  inspects edge topology for longer cycles, so a hand-edited or
  directly-inserted database row bypasses both entirely. The guard fires
  regardless of how the graph got into `automations.actions`. No other
  file needed a change: the thrown error propagates through
  `trigger.ts`'s existing, unmodified try/catch exactly like any other
  node failure (create_or_link_lead's ambiguous-phone error, an
  unconfigured send node, etc.) -- automatically marking both
  `automation_runs` and `automation_sessions` `failed`, never touching the
  already-persisted inbound message, and never affecting the webhook's
  own 2xx response.
- Verified: `npm run lint` / `npx tsc --noEmit` / `npm run build` all
  clean; no new route introduced. Regression covered every case in the
  approved plan, using a **temporary** file-scoped `MockOutboundSender`
  (never wired outside this verification -- reverted and confirmed via
  `grep` afterward, zero remaining references, `RealOutboundSender`
  reconfirmed as the live-wired class by direct inspection) so that
  proving the guard involved zero real Meta contact even for the cyclic
  cases: a normal linear flow with a `capture_lead_field` pause/resume
  completed correctly, confirming the new counter doesn't affect any
  legitimate flow; a direct self-loop graph (`node -> itself`, impossible
  to build through the UI, inserted directly via SQL to prove the guard
  doesn't depend on the builder at all) produced **exactly 29** real
  outbound-message rows before failing closed at step 31 with a specific
  "exceeded 30 steps" error -- a precise, database-counted proof that the
  cycle could not produce more than `MAX_GRAPH_STEPS - 1` sends, never an
  unbounded loop; a longer two-node cycle (`send_text <-> ask_question`,
  also inserted directly via SQL) produced the identical exact bound (29)
  and correctly named the next node it would have visited in its error
  message; redelivering the exact same cycle-triggering `wa_message_id`
  produced zero additional sends (fully deduped, unchanged from before);
  concurrent replies to a legitimate paused session still let only one
  advance (the optimistic-lock guarantee, untouched by this change,
  re-verified live). All test fixtures (3 services, 3 keywords, 3
  automations, 4 conversations, all messages/sessions/runs, 1 lead)
  deleted afterward -- confirmed every table back to its exact
  pre-existing baseline.
- Not done, explicitly out of scope: no live Meta send, no recipient
  chosen, no media/template/branching/human-handoff work, no mobile/
  Reports/parked-prototype changes.

### 2026-08-30 — Keyword-triggered automation: RealOutboundSender (production Meta text delivery, code complete, live send NOT yet performed)
- Phase: replaces `BlockedOutboundSender` with a real Meta-calling
  `RealOutboundSender` for automation-driven `send_text`/`ask_question`
  nodes, per a prior read-only audit this session that traced the exact
  existing outbound path (`lib/whatsapp/send-message.ts`'s
  `sendTextMessage`, already live for staff's manual replies), confirmed
  `messages.status` has no CHECK constraint (already accepts Meta's own
  status vocabulary directly, no schema change needed), and confirmed the
  existing WhatsApp status-callback webhook code is already fully generic
  (matches by `wa_message_id` regardless of who sent it). No migration, no
  schema change, no new route, no media/template/branching work -- exactly
  as scoped. **A real Meta call was explicitly NOT made this session** --
  CLAUDE.md's own unresolved Phase 4b.4 question (which of two candidate
  numbers is actually authorized on the test WABA) remains unresolved, and
  no live send was attempted without that being settled first.
- `lib/automations/outbound-sender.ts`: added `RealOutboundSender`,
  constructed with the caller's own service-role Supabase client (no
  longer a module-level singleton, since unlike `BlockedOutboundSender` it
  needs a real client to do its own lookups/writes). `sendText()`: looks
  up `conversations.wa_id`/`phone_number_id` by `conversationId` (the same
  per-action-lookup idiom already used by `createOrLinkLeadForConversation`/
  `captureLeadField`, not threaded through `ExecutionContext`); calls
  `sendTextMessage()` completely unmodified; on success, inserts the
  outbound `messages` row (`direction:"outbound"`, the real
  `wa_message_id`, `message_type:"text"`, `body`, `status:"sent"`) --
  **fixing a real, confirmed gap**: `executor.ts`'s `send_text`/
  `ask_question` path never persisted anything before this, unlike the
  human `sendMessage` action, meaning an automation-sent message would
  never have appeared in `/conversations`' thread history or been
  reachable by the existing status-callback code. `BlockedOutboundSender`
  is kept, unmodified, for reference/rollback.
- `lib/automations/trigger.ts`: constructs `RealOutboundSender` once per
  `triggerAutomationForMessage` call (passed down into
  `resumeEngagedSession`), replacing the previous module-level
  `BlockedOutboundSender` singleton. No other logic in this file changed --
  matching/idempotency/session lifecycle/failure propagation are
  byte-identical to before.
- Verified: `npm run lint` / `npx tsc --noEmit` / `npm run build` all
  clean; route list unchanged (no new public endpoint introduced). Every
  file reading `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_APP_SECRET` re-confirmed
  to carry `import "server-only"` directly (not assumed). Synthetic
  HMAC-signed webhook regression, with **temporary** sender substitutions
  for anything that would otherwise reach a live Meta call (a
  file-scoped `MockOutboundSender`, identical to `RealOutboundSender`
  except it never calls `sendTextMessage` -- proving the real DB
  lookup/insert/error-propagation code paths without any Meta contact --
  and, for the forced-failure case, the existing `BlockedOutboundSender`
  reused as-is): confirmed a fresh trigger correctly produces two real
  outbound `messages` rows (`send_text` then `ask_question`, correct
  `wa_message_id`/`status:"sent"`/body, correct order) before pausing at
  `capture_lead_field`; the next reply resumes at the exact right node,
  captures correctly, and a `create_or_link_lead` node placed *after* the
  outbound nodes runs correctly; a forced outbound failure (blocked
  sender) fails both the run and session while leaving the inbound message
  intact; an unconfigured `send_text` (no `data.text`) fails closed before
  ever reaching the sender; no active automation produces the unchanged
  `no_match` behavior; a redelivered `wa_message_id` produced zero
  duplicate outbound sends (blocked before automation logic even runs, as
  before); two concurrent replies to one paused session let only one
  advance (unchanged optimistic-lock guarantee, re-verified live). Both
  temporary substitutions were fully removed afterward (confirmed via
  `grep` -- zero remaining references) and `RealOutboundSender` was
  reconfirmed as the actually-wired class by direct inspection, not
  re-executed live (doing so would itself be a real Meta call). All test
  fixtures (2 services, 2 keywords, 2 automations, 5 conversations,
  outbound+inbound messages, sessions, 5 leads) deleted afterward --
  confirmed every table back to its exact pre-existing baseline.
  `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_APP_SECRET`/`WHATSAPP_VERIFY_TOKEN`
  confirmed present and non-empty in `.env.local` (existence/length only,
  no value read or printed).
- Not done, explicitly per instruction: no live Meta send was attempted;
  no recipient number was chosen or guessed. `send_image`/`send_video`,
  any media library, message templates, condition/branching, and
  human-handoff remain entirely untouched and out of scope.

### 2026-08-30 — Keyword-triggered automation: text-only outbound conversational nodes (send_text/ask_question)
- Phase: continues the automation track with the approved text-only
  outbound node phase, following a read-only architecture investigation
  this session that precisely distinguished (a) staff's existing manual
  outbound path (`lib/actions/messages.ts`/`ReplyComposer.tsx`, real,
  live, but requires a user session and has itself never been verified
  against Meta's live API either, per CLAUDE.md's own Phase 4b.4 record)
  from (b) automation-driven outbound, which did not exist at all before
  this phase. No real Meta/WhatsApp send was made or wired -- explicit
  constraint honored throughout. No migration, no new lead columns, no
  send_image/send_video, no condition/branching, no human handoff, no
  mobile/Reports/Realtime/parked-prototype changes.
- New `lib/automations/outbound-sender.ts`: `OutboundSender` interface +
  `BlockedOutboundSender`, the only implementation wired into the
  executor. Every method throws a clear, typed
  `OutboundSendingBlockedError` rather than faking delivery -- a flow
  reaching a send/ask block fails that step honestly, exactly like any
  other execution error.
- `graph-schema.ts`: `send_text` and `ask_question` moved from
  disabled/"Coming soon" to enabled -- both execute identically (send,
  then continue, never pause); `ask_question` is a distinct node purely
  for builder clarity (an intentional "ask a question" block vs. a reused
  generic "send text"), not a different execution path. `send_image`/
  `send_video`/`condition` remain disabled, unchanged. Node `data` gained
  an optional `text` field alongside the existing `fieldKey`;
  `validateGraphForSave` now also requires non-empty text on send/ask
  nodes before a flow can be saved.
- `executor.ts`: the walker's node-type switch gained `send_text`/
  `ask_question` (call `outboundSender.sendText`, then continue via the
  existing single-outgoing-edge rule, unchanged); `startAndAdvance`/
  `resumeAndAdvance` now take the sender as an explicit parameter
  (dependency injection, never a hidden default).
- `trigger.ts`: a **real gap found and fixed** during the investigation --
  `resumeEngagedSession` was passing `params.body ?? ""` into the resume
  walk, meaning an inbound reply with no usable text (a bare image/
  sticker/location with no caption) would have been captured as an empty
  string. Fixed: a reply with null/empty/whitespace-only body is now
  detected before any resume logic runs at all -- the session is left
  completely untouched (still active, still at the same `current_node_id`,
  no session-state write happens), and the run is recorded as `no_match`
  with a clear note. A single module-level `BlockedOutboundSender`
  instance is threaded through both the fresh-match and resume call sites.
- Builder: `NodeConfigPanel` gained a textarea for `data.text` (labeled
  "Question text" for `ask_question`, "Message text" for `send_text`),
  the first free-text config any node has had, mirroring the existing
  `fieldKey` `<select>`'s established pattern; `FlowNode` shows a quoted
  text preview when configured; `AutomationBuilder`'s graph<->flow
  conversion and `updateText` handler carry it through.
- Verified: `npm run lint` / `npx tsc --noEmit` / `npm run build` all
  clean. Live Playwright (Admin, 1440x900): built a real
  trigger->send_text->ask_question->capture_lead_field flow via the
  builder, confirmed both text fields and the field selector persist
  through an exact save/reload round-trip. Synthetic HMAC-signed webhook
  tests (same zero-real-Meta method as every prior phase), including a
  **temporary** mock-sender swap for this verification only (a
  file-logging `MockOutboundSender` briefly substituted for
  `BlockedOutboundSender` in `trigger.ts`, exactly the same
  temporary-then-reverted methodology already used in Phase 2's own
  verification) -- confirmed: a fresh trigger correctly fails closed at
  the first send/ask block under the real `BlockedOutboundSender`; under
  the temporary mock, the same flow correctly walks through send_text and
  ask_question (mock received the exact configured text and conversation
  id for both, in order) and pauses at capture_lead_field; a two-question,
  two-capture flow (trigger->create_or_link_lead->ask->capture->
  ask->capture->end) correctly resumes at exactly the right
  `current_node_id` each time and completes with both real lead fields
  set; an empty/whitespace reply mid-flow left the session untouched and
  a real reply afterward still resumed correctly from the same node; two
  concurrent replies to one paused session correctly let only one advance
  (no corruption, one session, one value); a redelivered `wa_message_id`
  stayed fully deduped; an unconfigured `send_text` node (no `data.text`)
  failed closed with a specific message; `create_or_link_lead` continued
  to work correctly inside these longer flows. The mock swap was then
  fully reverted (confirmed via `grep` across `lib/`, `components/`,
  `app/` -- zero remaining references) and the exact same fresh-trigger
  scenario was re-run to prove the revert was live, not just a file edit
  -- it correctly failed closed under the real blocked sender again.
  Admin-only RLS on all five automation tables re-confirmed unchanged via
  `pg_policies`. Mobile 390x844 re-checked live: nav unchanged, no
  horizontal overflow. Staff access verified structurally only (no
  RLS/authorization code changed this phase; no Staff login credentials
  were available to test live -- same gap as every phase since
  Follow-ups). All test fixtures (3 services, 3 keywords, 3 automations,
  7 conversations, ~13 messages, ~13 automation_runs, several sessions, 7
  leads) deleted afterward -- confirmed every table back to its exact
  pre-existing baseline via a live count query.
- Not done / deferred, exactly as scoped: `send_image`/`send_video` and
  any media library, `condition`/branching, human-handoff trigger, any
  AI/NLP capability, and actually wiring a real Meta-calling
  `OutboundSender` implementation (a separate, later, explicitly-approved
  step).

### 2026-08-30 — Keyword-triggered automation: capture_lead_field (first real conversational node)
- Phase: continues the automation track with the first genuinely
  conversational capability, per the approved proposal from this session's
  own architecture audit. Explicit clarification honored throughout:
  capture_lead_field is a technical wait-and-store step, not a
  customer-facing question -- no outbound message/media/question-text
  behavior was invented. `ask_question` was left completely untouched
  (still disabled, still blocked on Phase 4b.4). No migration. Not
  committed, not pushed.
- `lib/automations/graph-schema.ts`: nodes gained an optional `data` field
  (`{fieldKey?: CapturableLeadField}`) -- the first configurable parameter
  any node has had. `capture_lead_field` moved from disabled to enabled in
  `NODE_DEFINITIONS`. New `CapturableLeadField` type (exactly five values,
  grounded in real `leads` columns -- `customer_name`, `location`,
  `project_type`, `estimated_sqft`, `notes` -- confirmed against
  `lib/supabase/types.ts` before writing; `phone`/`service_required`
  excluded as already handled elsewhere, `expected_start_date` excluded
  since free-text WhatsApp replies aren't safely parseable into a real
  date). New `getOutgoingEdges()` and `validateGraphForSave()` (one
  outgoing edge per node max, capture nodes must have a field selected --
  used only by the save action, never by the executor's own permissive
  read path).
- `lib/automations/crm-actions.ts`: new `captureLeadField()` following the
  exact `createOrLinkLeadForConversation` pattern -- requires
  `conversations.lead_id` already set (fails clearly if not), never
  overwrites an already-populated column (`customer_name`/`location`/
  `project_type`), extracts the first number from the reply for
  `estimated_sqft` (falls back to a labeled `qualification_notes` line if
  no number is found -- the customer's answer is never discarded), and
  `notes` always appends a labeled line rather than overwriting.
- `lib/automations/executor.ts` rewritten: `executeGraph`'s "does the
  graph contain create_or_link_lead anywhere" check is replaced by real
  sequential single-outgoing-edge traversal (`startAndAdvance`/
  `resumeAndAdvance`, sharing one internal `walk()`). This is a
  **deliberate, approved behavior correction**: a `create_or_link_lead`
  node not actually connected to `trigger` no longer executes (previously
  it did, regardless of connectivity) -- verified live to have zero effect
  on any graph built through the UI, since the builder has only ever
  connected them directly. Node types with no defined execution behavior
  (`send_text`/`image`/`video`, `ask_question`, `condition`) fail the walk
  closed with a specific error rather than being silently skipped; none
  are reachable through the builder today, so this is defense-in-depth
  only. Zero outgoing edges = implicit completion; 2+ = a hard failure
  (never a guess).
- `lib/automations/sessions.ts`: `markSessionTerminal` and the new
  `pauseSessionAt` both support an **optimistic-concurrency guard** --
  every session-state write is conditioned on `current_node_id` still
  matching what the caller originally read (`WHERE ... AND current_node_id
  = <expected>`), returning `false` (not throwing) when another
  concurrent delivery already advanced the session first. This is a real
  gap I caught in my own proposal before implementing: the session-level
  partial unique index prevents two *sessions*, not two concurrent
  *resumes* of the *same* session. Both functions also merge new
  `collected_data` onto the session's existing value in the same guarded
  write (fetch-then-merge-then-conditional-write, using the already-loaded
  session row as the merge base -- covered by the same guard, so a lost
  race can't corrupt collected_data either).
- `lib/automations/trigger.ts`: the engaged-session branch is now split --
  `handed_off` remains the exact same no-op it was (never resumed, no
  keyword re-match); `active` now genuinely resumes via
  `resumeEngagedSession()` (fetches the automation + service, inserts a
  `pending` automation_run exactly like a fresh match, calls
  `resumeAndAdvance`, then persists pause/complete through the guarded
  session helpers). Matching/service-resolution/idempotency logic for
  fresh matches is untouched; only the execution call site and its
  pause/complete bookkeeping changed.
- Builder: `capture_lead_field` is now draggable/clickable in
  `NodePalette` (its "Coming soon" badge is gone); `NodeConfigPanel` gained
  its first real input -- a field-key `<select>` -- wired through a new
  `onFieldKeyChange` callback in `AutomationBuilder`; `FlowNode` shows
  "Field: <label>" on a configured capture node instead of its generic
  description; `FlowCanvas`'s `isValidConnection` now rejects a second
  outgoing edge from a node that already has one (the admin deletes the
  existing edge first -- already-supported Backspace/Delete);
  `saveAutomationGraph` calls `validateGraphForSave` before writing and
  returns a specific error rather than silently accepting an
  unconfigured/multi-edge graph.
- Verified: `npm run lint` / `npx tsc --noEmit` / `npm run build` all
  clean (one real `react-hooks/exhaustive-deps` warning caught by lint on
  the first pass and fixed -- `isValidConnection` was missing from
  `handleConnect`'s dependency array). Live Playwright (Admin, 1440x900):
  built a real trigger -> create_or_link_lead -> capture_lead_field(location)
  flow via click-to-add and handle-to-handle dragging, confirmed a second
  outgoing edge from an already-connected node is silently rejected
  (edge count stays at 2, not 3), configured and saved it, reloaded and
  confirmed an exact round-trip including the `data.fieldKey` value.
  Synthetic HMAC-signed webhook tests covered all ten required scenarios:
  fresh flow pauses at the capture node with the lead still unset; the
  next reply resumes at exactly that `current_node_id`, captures into
  `collected_data` and the real lead column, and the session completes;
  the same field is confirmed never overwritten on a second pass; a
  second service configured to capture `estimated_sqft` correctly
  extracts a number from "around 1200 sqft" and correctly falls back to a
  qualification_notes line for "not sure, pretty big"; a `notes` capture
  correctly appends to (not overwrites) existing notes; a
  `create_or_link_lead` node with zero connecting edges correctly never
  executes (zero leads created) while the run still completes cleanly; an
  unmodified `trigger->create_or_link_lead->end` automation behaves
  identically to before; a `handed_off` session correctly never resumes;
  a forced failure (ambiguous phone match) leaves the message persisted
  and correctly fails both the run and the session; a Meta redelivery of
  an already-processed message remains fully deduped (no second message,
  run, or session). The optimistic-lock guard was additionally proven
  deterministically via direct SQL (two conditional updates against the
  same stale `current_node_id`: the first succeeds, the second affects
  zero rows), since a live concurrent-HTTP-request test could not
  conclusively prove the race on fast local loopback. All test fixtures
  (4 services, 4 keywords, 4 automations, 10 conversations, ~14 messages,
  ~14 automation_runs, several sessions, 12 leads) deleted afterward --
  confirmed every table back to its exact pre-existing baseline.
- Not done / deferred, exactly as scoped: `ask_question`'s actual send,
  `send_text`/`image`/`video`, `condition`/branching execution, any
  human-handoff trigger mechanism, Meta outbound work, AI-generated
  replies, psychological automation logic, campaign analytics.

### 2026-08-30 — Keyword-triggered automation: conversational session-state foundation
- Phase: continues the automation track (Phase 1 schema/RLS, Phase 2
  matching/trigger, Phase 3 create_or_link_lead, the visual builder
  foundation) with the session-state foundation approved after a
  read-only architecture audit this session. Deliberately narrow, per
  instruction: no edge-walking, no ask_question/capture_lead_field/
  condition, no Meta outbound, no human-handoff UI, no mobile/builder/
  prototype changes. Not committed, not pushed.
- Migration `add_automation_sessions` applied and fully verified live
  (columns/defaults, all three FKs and their delete behavior, the CHECK
  constraint, the partial unique index, RLS enabled with exactly the one
  specified SELECT-admin-only policy and no write policies,
  `automation_runs.session_id` added, `automation_runs`' own existing
  constraints/RLS/UNIQUE(message_id) re-confirmed byte-for-byte unchanged)
  before any application code was written. New table `automation_sessions`
  (`conversation_id`, `automation_id`, `current_node_id`, `collected_data
  jsonb`, `status: active|completed|failed|handed_off`, `last_message_id`,
  timestamps) -- kept deliberately separate from `automation_runs` (which
  stays exactly what it was: one row per inbound message, keyed by
  `message_id`, for per-message idempotency) since a session is a
  per-conversation concern with its own lifecycle, not a per-message one.
  `automation_sessions_one_engaged_per_conversation`, a partial unique
  index on `conversation_id WHERE status IN ('active','handed_off')`, is
  the real concurrency guard -- tested directly via SQL before writing any
  code: a second `active` insert for the same conversation was rejected
  (23505), a `handed_off` insert while `active` existed was also rejected,
  and a fresh insert succeeded once the first session was marked
  `completed`.
- New `lib/automations/sessions.ts` (`getEngagedSession`,
  `startSession`, `markSessionTerminal`) -- server-only, relies entirely
  on the database constraint for concurrency (a 23505 from `startSession`
  is treated as "another delivery already engaged this conversation,"
  never retried into a second execution). Small addition to
  `graph-schema.ts` (`findTriggerNodeId`) -- no change to graph semantics,
  no `sourceHandle`/branch/ordering/dead-end rules added, exactly as
  scoped.
- `trigger.ts` extended, not rewritten: a `getEngagedSession` check now
  runs before keyword matching; if a conversation is already engaged
  (active or handed_off), matching is skipped entirely and the message's
  `automation_run` records `no_match` with `session_id` pointing at the
  existing session -- no second session is ever created. When no session
  is engaged, the existing matching/service-resolution/active-automation
  lookup is completely unchanged; on a match, a session is started at the
  graph's `trigger` node before the existing (unmodified) `executeGraph`
  runs, and the session is marked `completed`/`failed` alongside the
  existing `automation_runs` terminal update. Documented explicitly, not
  glossed over: today's graph has no node that actually pauses (only
  `trigger`/`create_or_link_lead`/`end` execute; edges remain
  planning-only), so every session started this phase resolves to a
  terminal state within the same webhook request -- `current_node_id`
  stays at the entry node it was created with. `handed_off` exists only
  as a reachable, enforced state; no production code path sets it yet (no
  `human_handoff` node exists).
- Verified: `npm run lint` / `npx tsc --noEmit` / `npm run build` all
  clean. No UI was touched this phase, so no Playwright run (per
  instruction). Synthetic HMAC-signed webhook tests (same zero-real-Meta
  method as every prior phase) covered all seven required scenarios: (A)
  new conversation + matching keyword -> session created at the trigger
  node, `create_or_link_lead` still works, session ends `completed`; (B)
  a second message on a conversation with a manually-engaged `active`
  session -> matching skipped, no second session, run correctly
  references the existing session; (C) redelivering the same
  `wa_message_id` -> fully deduped, no regression; (D) a matching keyword
  with no active automation -> unchanged `no_match`/`matched_service_id`
  behavior, no session created; (E) a new matching message on a
  conversation whose prior session was `completed` -> a fresh session
  correctly starts; (F) the same on a `handed_off` session -> automation
  correctly does not re-engage, no second session; (G) a forced failure
  (ambiguous phone match) -> message stays persisted, run and session both
  record `failed`, no lead corruption. All test fixtures (1 service, 1
  keyword, 1 automation, 3 conversations, 6 messages, 6 automation_runs,
  3 sessions, 4 leads) deleted afterward -- confirmed every table back to
  its exact pre-existing baseline via a live count query.
- Not done / deferred, exactly as scoped: edge-walking, `ask_question`,
  `capture_lead_field`, `condition`/branching execution, any Meta outbound
  work, human-handoff UI or trigger, AI-generated replies, psychological
  automation logic, campaign analytics.

### 2026-08-30 — Keyword-triggered automation: visual flow builder foundation
- Phase: continues the keyword-triggered automation track (Phase 1 schema/
  RLS, Phase 2 webhook trigger/matching, Phase 3 action execution + admin
  UI) with the visual builder foundation approved in this session's own
  architecture discussion. Deliberately narrow scope per instruction: no
  messaging execution, no Meta outbound (still blocked by Phase 4b.4), no
  multi-step conversational session/state machine -- those remain a
  separate, later, explicitly-approved phase. Not committed, not pushed.
  No mobile change (bottom nav re-verified live: still Home/Leads/Chats/
  Tasks + More, unchanged).
- Audited first, as required: `automations.actions` (jsonb) is sufficient
  to represent a node/edge visual graph with no schema/migration needed --
  confirmed and used as-is. The only real change is the internal shape of
  that jsonb (flat Phase-3 steps -> a versioned v2 graph), not the column.
- New `lib/automations/graph-schema.ts`: the versioned graph type
  (`{version:2, nodes:[{id,type,position}], edges:[{id,source,target}]}`)
  and `NODE_DEFINITIONS`, the single source of truth for which of the nine
  conceptual node types (Trigger, Send Text/Image/Video, Ask Question,
  Capture Lead Field, Condition, Create/Update Lead, End) are actually
  backed by real execution today. Only three are enabled: `trigger`
  (structural, documents the Phase 2 keyword match, always exactly one,
  not deletable), `create_or_link_lead` (the one real action, unchanged
  from Phase 3), and `end` (structural, no effect). The other six render
  in the builder's palette visibly disabled ("Coming soon" + the specific
  reason -- outbound-blocked or conversational-engine-not-built) so the
  intended future shape of a flow is legible without letting an admin
  configure something that would silently do nothing when saved.
  `parseAutomationGraph()` throws a specific, distinguishable error for a
  legacy v1 payload vs. any other unrecognized/malformed version --
  deliberately reversing Phase 3's more permissive
  `parseAutomationActions()` (kept, not deleted, in `action-schema.ts`,
  now used only for its v1 shape recognition), since silently executing
  nothing on a whole flow is a worse failure mode than one optional
  checkbox quietly doing nothing was.
- `lib/automations/executor.ts` rewritten (`executeGraph`, replacing
  `executeActions`): this phase's execution model is deliberately NOT a
  graph walk -- edges are visual/planning only and don't yet affect
  execution order (that needs the multi-step session engine from the
  approved-but-not-yet-built architecture). All that matters today is
  whether the graph contains an enabled `create_or_link_lead` node at all,
  exactly Phase 3's behavior, now configured visually. `trigger.ts`'s
  matching/idempotency/failure-isolation logic is completely unchanged --
  only its `executeActions` call site was repointed to `executeGraph`.
- `lib/actions/automation-config.ts`: `saveAutomation` (the old checkbox
  form's action) replaced by `saveAutomationGraph`, which validates the
  submitted graph via `parseAutomationGraph` before writing and returns
  the automation's id on success (a new, wider `SaveAutomationState` type,
  scoped to this one action) so the builder knows to update rather than
  insert on every save after the first. The DB's own
  `automations_one_active_per_service_idx` partial unique index (service_
  id WHERE status='active') is the real enforcement of "one active
  automation per service" -- re-confirmed live via `pg_constraint`/
  `pg_indexes` before writing this, unchanged, untouched.
- New `/automation/services/[serviceId]/builder` route (admin-only,
  `notFound()` for non-admin, same pattern as every other automation
  page) and `components/automation-builder/*`: a left node palette
  (click-to-add, proven reliable for testing, plus drag-and-drop mirroring
  the existing parked prototype's already-proven `@xyflow/react` wiring),
  a canvas (`FlowCanvas.tsx`, same `useNodesState`/`applyNodeChanges`/
  `ReactFlowProvider` pattern already working in
  `components/automation/canvas/AutomationCanvas.tsx` -- confirmed via
  Context7 against React Flow's own docs before use), and a right
  config panel showing each selected block's description + delete (no
  node type has any configurable parameters yet, so the panel is
  intentionally minimal, not padded with fields that wouldn't do
  anything). "Unsaved changes" tracked via a snapshot comparison, warns
  on tab close via `beforeunload` while dirty. No new dependency --
  `@xyflow/react` was already installed from the parked prototype.
  `ServiceConfigCard.tsx`'s old inline checkbox automation form replaced
  with a read-only summary (Active/Draft/Not configured + the existing
  "no executable action" warning, now driven by `parseAutomationGraph`)
  and a link into the builder -- automation content now has exactly one
  editing surface, not two.
- Verified: `npm run lint` / `npx tsc --noEmit` / `npm run build` all
  clean. Live Playwright (Admin, 1440x900): created a real test service,
  added a keyword, opened the builder, added a Create/Update Lead block
  via click-to-add, connected Trigger -> Create/Update Lead by dragging
  between real handle elements, saved as Active, confirmed the exact DB
  row (`{version:2, nodes, edges}`), reloaded and confirmed an exact
  round-trip (same node/edge ids), deleted the block, saved, confirmed the
  "no executable action" warning correctly reappeared on the services
  list. Live end-to-end execution via a synthetic HMAC-signed webhook
  (same zero-real-Meta-contact method as every prior phase): keyword
  match -> `automation_runs.status='matched'` -> lead created with
  `service_required` set, no regression from Phase 2/3. Deliberately
  corrupted the same automation's `actions` to a legacy v1 payload via
  SQL and confirmed both (a) a webhook against it fails cleanly
  (`status='failed'`, the specific legacy-format message, no lead
  created, webhook still 200) and (b) reopening it in the builder shows a
  clear notice and starts a blank flow rather than crashing. Mobile
  390x844 re-checked live: bottom nav unchanged (Home/Leads/Chats/Tasks +
  More), no regression. Staff access verified structurally only (RLS
  admin-only policies on `services`/`automations` unchanged since Phase 1,
  page-level `notFound()` matching the existing pattern) -- no Staff login
  credentials were available, same gap as every phase since Follow-ups.
  All test data (1 service, 1 keyword, 1 automation, 2 conversations, 2
  messages, 2 automation_runs, 2 leads) deleted afterward -- confirmed
  zero residue via a live count query and the dashboard back to its
  original single-lead state.
- Not done / deferred, per explicit instruction: no messaging execution,
  no Meta outbound send/adapter work, no multi-step conversational
  session/state machine (automation_sessions, interrupts, human handoff --
  all from the approved architecture discussion, none built yet), no
  configurable node parameters (none exist for any node type today).

### 2026-08-30 — Keyword-triggered automation, Phase 3: action execution + admin UI
- Phase: new ad hoc track (not in the original §7 list), continuing the
  keyword-triggered service automation architecture from its Phase 1
  (schema/RLS) and Phase 2 (webhook trigger + matching) sessions. This
  phase wires a real, minimal action vocabulary into the executor and
  builds the first admin configuration UI for it. Not committed, not
  pushed. No mobile nav change (`MobileBottomNav`/`MobileMoreMenu`
  untouched -- confirmed via git status and a live check: bottom nav
  still Home/Leads/Chats/Tasks + More, More's Management group still
  shows only the existing "Automation" entry linking to `/automation`,
  nothing new added there). The existing `/automation` `@xyflow/react`
  canvas prototype remains untouched and parked -- only a small link to
  the new `/automation/services` route was added to its page wrapper.
- Action vocabulary: exactly one real, executable action --
  `create_or_link_lead` (`lib/automations/action-schema.ts`,
  `lib/automations/crm-actions.ts`). Versioned contract
  (`{version:1, steps:[{type,params}]}` in `automations.actions` jsonb,
  the same column from Phase 1 -- no migration needed). All other
  candidate actions from the earlier design phase (`assign_lead`,
  `set_stage`, `create_follow_up`, `send_whatsapp_text`) are explicitly
  not implemented; `send_whatsapp_text` stays blocked on Phase 4b.4 and
  was not bypassed or mocked.
- Executor (`lib/automations/executor.ts`) extended, not replaced: now
  takes the Supabase client + an `ExecutionContext` and actually calls
  `createOrLinkLeadForConversation`. `lib/automations/trigger.ts` extended
  to look up service names and pass real context through. The webhook
  (`app/api/webhooks/whatsapp/route.ts`) passes `phone`/`customerName`
  through to the trigger -- its own idempotency/failure-isolation
  wrapping from Phase 2 is unchanged.
- New admin UI at `/automation/services`: list services, add/toggle
  services, add/toggle/delete keywords per service, configure and
  activate/deactivate the one automation per service, with a visible
  warning when an automation has no executable action configured. Built
  from `lib/automations/admin-data.ts` (read layer) and
  `lib/actions/automation-config.ts` (Server Actions: `createService`,
  `toggleServiceActive`, `addKeyword`, `toggleKeywordActive`,
  `deleteKeyword`, `saveAutomation`), each independently admin-gated via
  `getCurrentProfile()` on top of the real admin-only RLS from Phase 1
  (unchanged, re-confirmed this session via `pg_policies`). No new
  schema, no new table, no RLS change.
- One real bug found and fixed, application-code only: `ServiceUpdate`/
  `ServiceKeywordUpdate`/`AutomationUpdate` (`lib/supabase/types.ts`,
  from Phase 1) had wrongly followed `LeadUpdate`'s
  `Omit<Row, "id"|"created_at"|"updated_at">` pattern, excluding
  `updated_at` from the settable type -- but (like `conversations`, the
  one other table whose `updated_at` this codebase sets explicitly from
  app code) this phase's code needs to set it. Fixed by changing all
  three to `Omit<Row, "id"|"created_at">`, matching `ConversationUpdate`'s
  existing convention. This was a type-definition inconsistency, not a
  schema or RLS problem -- no migration involved.
- Verified: `npm run lint` / `npx tsc --noEmit` / `npm run build` all
  clean. Live Playwright (Admin, 1440x900): created a real service, added
  a real keyword, configured+activated its automation, confirmed the
  "no executable action" warning appears/disappears correctly, no console
  errors. Live end-to-end execution via synthetic HMAC-signed webhooks
  (zero real Meta contact, same method as Phase 2): keyword match ->
  `automation_runs.status='matched'` -> new lead created with
  `service_required` set -> `conversations.lead_id` linked; duplicate
  redelivery of the same `wa_message_id` correctly deduped (no second
  message/run/lead); non-matching text correctly recorded `no_match` with
  `matched_service_id` null; a matched-service-but-inactive-automation
  case correctly recorded `no_match` with `matched_service_id` set and no
  lead created; a forced action failure (ambiguous phone match, two
  leads sharing one phone) correctly recorded `status='failed'` with a
  real error message, message still persisted, webhook still returned
  200. Mobile 390x844/375x812 re-checked live: nav unchanged, no
  horizontal overflow. Staff access verified structurally (RLS
  `_admin_only` policies on all four tables re-confirmed live, matching
  the existing `/automation`/`/audit-log` page-level `notFound()`
  pattern) rather than via an actual staff login. All test data (1
  service, 1 keyword, 1 automation, 4 messages, 4 conversations, 4
  automation_runs, 3 leads) deleted afterward -- confirmed zero residue
  via a live count query and a reloaded dashboard matching the original
  single-lead state.
- Not done / deferred: `assign_lead`, `set_stage`, `create_follow_up`,
  `send_whatsapp_text` action types; service/keyword bulk management
  beyond the minimal per-service inline UI built here; live staff-role
  login test (structural RLS check substituted, consistent with this
  project's own precedent for RLS-based verification).

### 2026-08-30 — Phase 6 (§14): Reports workspace, v1 (snapshot-only)
- Phase: Reports only, per the approved Reports Specification Proposal's
  finalized decisions. No schema, migration, RLS, or Supabase config
  change; no audit_logs-as-history substitute; no won_at/lost_at added.
  Nothing touched in `lib/realtime/`, `lib/whatsapp/`, `/conversations`,
  `/chat`, Phase 4b.4, Coexistence, or the mobile bottom-nav bar itself
  (only its existing More menu gained one Work entry). Automation was not
  added back to mobile More, and its existing table-overflow issue was
  left untouched, per instruction. Not committed, not pushed.
- Checked for blockers before writing any code, per instruction: all seven
  approved metrics were confirmed implementable exactly from existing
  columns (`leads.status/job_value/quotation_amount/assigned_to_id/
  qualification_score/service_required/lost_reason`,
  `follow_ups.status/due_date/completed_at/created_at/type` joined to
  `leads.assigned_to_id` for per-staff grouping). No blocker found -- all
  seven shipped, none deferred.
- Built `lib/reports.ts`: one `getReportsData()` doing exactly two RLS-
  scoped fetches (leads, follow_ups -- same admin-unrestricted/staff-
  explicitly-filtered pattern as `getLeads()`, one fetch each rather than
  seven repeated queries), then computing all seven reports from those two
  arrays. `app/(app)/reports/page.tsx`: one workspace, anchor-linked
  stacked sections (no tab widget invented -- none exists elsewhere in
  this app). Pipeline Distribution reuses the existing
  `DashboardStatusBreakdown` component directly, unmodified. KPI tiles
  reuse the existing `StatCard` component. No charting dependency added.
- Conversion's "overall won rate" was deliberately implemented as won ÷
  all non-invalid leads (a top-of-funnel conversion measure), distinct
  from Won/Lost's win rate = won ÷ (won+lost) (a measure of decided leads
  only) -- both terms appear in the approved spec against what read as two
  intentionally different metrics; documented inline in `lib/reports.ts`
  in case this reading needs correcting.
- Staff-performance aggregation safety (explicit requirement): for a
  staff caller, `getReportLeads()`/`getReportFollowUps()` never fetch
  another staff's rows in the first place (RLS plus `getReportLeads()`'s
  own explicit `.eq("assigned_to_id", profile.id)`, mirroring
  `getLeads()`) -- `computeStaffPerformance()` for staff doesn't even
  call the admin-only `getAssignableStaff()` roster, it returns exactly
  one row computed from data that structurally cannot contain anyone
  else's. Admin's per-staff rows are computed by filtering the
  already-admin-unrestricted arrays per real staff id from that roster --
  never a raw `GROUP BY` that could return another staff's count before
  any per-role filter runs.
- Mobile: added exactly one entry, "Reports", to `MobileMoreMenu.tsx`'s
  existing Work group (both roles, unconditional, same as Site Visits/
  Deals/Quotations). Did not touch `MobileBottomNav.tsx`, Management, or
  System. The `/reports` page itself renders a trimmed 3-KPI-card subset
  (Won Deals, Total Won Value, Follow-ups Overdue) on mobile
  (`lg:hidden`) instead of all seven sections, matching Follow-ups'
  precedent of a reduced mobile view over the same fetched data. Also
  added "Reports" to the desktop sidebar (`components/Sidebar.tsx`) --
  not explicitly requested this turn, but necessary for the page to be
  reachable on desktop at all, matching every prior phase's own practice
  of adding its nav entry in the same phase.
- Verified live, not from source inspection, as Admin: at 1440x900, all
  seven sections render with the one real lead's actual data, hand-
  checked against known ground truth (Quotation stage, quotation_amount
  ₹2,35,000, job_value null, 3 follow-ups all completed in
  seconds-to-minutes) -- Pipeline shows Quotation:1, Won/Lost all zero,
  Quotation Performance ₹2,35,000 quoted/avg, Quote→Won 0%, Sales
  Performance zero (lead not won), Conversion 0%, Staff Performance shows
  Azhar Vahab with 1 lead/3 follow-ups done/0 overdue, Follow-up
  Performance 100% completion / 0.0 hrs avg (verified against real
  created_at/completed_at timestamps via SQL, confirmed correct given how
  quickly those specific test follow-ups were completed, not a bug). At
  390x844 and 375x812: confirmed the trimmed 3-card mobile view, confirmed
  Reports appears in More's Work group and navigates correctly, confirmed
  Automation still appears only in Management (unchanged, still absent
  from Work), confirmed no horizontal overflow at either size. No console
  errors at any point. Confirmed desktop sidebar otherwise unchanged in
  order.
- Not verified live: Staff-role visibility -- no Staff login credentials
  were available, same gap as every phase since Follow-ups. Verified
  structurally, more rigorously than usual given this phase's own explicit
  aggregation-safety requirement: traced that a staff caller's fetched
  `leads`/`followUps` arrays cannot contain another staff's rows at the
  fetch layer itself (RLS + explicit filter), before any per-staff
  grouping logic ever runs -- not "hidden in a bigger array," genuinely
  absent from it.
- `npm run lint` / `npx tsc --noEmit` / `npm run build`: all clean.
- Not committed, not pushed. Not proceeding to another phase.

### 2026-08-30 — Mobile Navigation IA restructure (§1, Option B)
- Phase: mobile navigation only, per the approved audit's Option B. No
  schema, Supabase, Realtime, WhatsApp, API, or data-layer change; no
  desktop navigation change; no product/data behavior touched outside
  mobile nav. Not committed, not pushed.
- Problem this fixes, not just reshuffles: before this phase, Deals and
  Quotations had **zero** mobile navigation path for either role -- not a
  crowding risk, an existing gap. The old "More" was admin-only end to
  end (`MobileAdminMore` returned `null` for staff), so it could never
  have been the fix for that gap even before it started getting crowded.
- Built: bottom bar cut from 5 tabs to 4 -- Home, Leads, Chats (`/
  conversations`), Tasks (`/follow-ups`) -- Site Visits removed
  (`components/MobileBottomNav.tsx`). New `components/MobileMoreMenu.tsx`
  (full rewrite, same outside-click/Escape-to-close logic preserved) is
  now **one role-aware architecture for both roles**, not an admin-only
  gate: a `Work` group (Site Visits, Deals, Quotations) always renders;
  `Management` (Automation, Audit Log) and `System` (Settings) render only
  when `isAdmin` is true. `components/MobileAdminMore.tsx` (admin-only
  gate, entire component returned `null` for staff) removed and replaced
  by `components/MobileMoreEntry.tsx` (always renders, fetches the
  profile, passes `isAdmin` down) -- `app/(app)/layout.tsx` rewired to the
  new component accordingly. Did not add Reports or Team links -- neither
  destination is built or approved (§24), and a dead link is worse than an
  absent one. Kept the existing "Chats"/"Tasks" mobile-label abbreviation
  convention rather than expanding to "Conversations"/"Follow-ups" to
  avoid re-introducing label-wrapping risk on already-verified tab widths.
- CLAUDE.md §1 amended: the mobile paragraph now explicitly tiers Home/
  Leads/Conversations/Follow-ups-Tasks as primary (bottom bar) versus
  Site Visits/Deals/Quotations as secondary (mobile-reachable via More's
  Work section, not the bar) -- replacing the flat, untiered list that
  produced the crowding trajectory this phase exists to stop. Also
  corrected an adjacent, already-stale claim in the same paragraph
  ("Automation and Audit Log ... never in mobile nav") that predated and
  contradicted the admin-only mobile More menu built back in Phase 0b --
  found while editing this exact paragraph, not a separate unrelated
  cleanup.
- Verified live, not from source inspection, as Admin at 390x844 and
  375x812: bottom bar shows exactly Home/Leads/Chats/Tasks/More, Site
  Visits confirmed absent from it; opening More shows all three groups
  (Work/Management/System) with the correct items in each; navigating to
  Site Visits via the menu works and the menu correctly re-shows both the
  More tab and the specific Site Visits item as `aria-current="page"` when
  reopened on that route; outside-click correctly closes the menu
  (confirmed via a real dispatched `mousedown`, not a synthetic `.click()`,
  after an initial false negative from checking the DOM before React's
  state update had flushed); no horizontal overflow
  (`scrollWidth === clientWidth`) at either size, menu included, with the
  open menu's bounding box confirmed fully on-screen at 375px. Confirmed
  desktop sidebar completely unchanged (same 7 items + admin section, same
  order) at 1440x900. No console errors at any point.
- Not verified live: Staff-role visibility (Work shown, Management/System
  absent) -- no Staff login credentials were available, same gap as every
  phase since Follow-ups. Verified structurally instead: `isAdmin` is a
  plain boolean prop gating a ternary between a 1-group and a 3-group
  array, and `MobileMoreEntry`'s role check
  (`profile?.role === "admin"`) is the exact same pattern already
  live-verified for this exact "Automation/Audit Log hidden from staff on
  mobile" behavior back in Phase 0b (`git log`/session log: "exactly 3
  nav items + admin 'More' ... for Admin, ... no 'More' for Staff on
  mobile") -- not new, unverified authorization logic.
- `npm run lint` / `npx tsc --noEmit` / `npm run build`: all clean.
- Not committed, not pushed. Not proceeding to the next product phase.

### 2026-08-30 — Phase 7 (§8): Deals workspace
- Phase: Deals only, per the approved next-phase plan. UI-level only -- no
  schema, migration, RLS, or Supabase config change; no new query
  function; no mobile nav entry (§1 lists "quotations"/deal-adjacent work
  only under Desktop's full CRM operations, not Mobile's daily-work
  priorities, same reasoning already applied to Quotations last phase).
  Nothing touched in `lib/realtime/`, `lib/whatsapp/`, `/conversations`,
  `/chat`, Follow-ups, Site Visits, Quotations, Reports, or Settings. Not
  committed, not pushed.
- Built `/deals` (`app/(app)/deals/page.tsx`), calling the existing
  `getLeads({})` unmodified and filtering in-memory to
  `status === "quotation" || status === "negotiation"` -- a live pipeline
  snapshot, deliberately different from `/quotations` (a ledger filtered
  by `quotation_amount` presence, which keeps showing Won/Lost leads that
  still carry an old quote). New `DealRow`/`DealCard`
  (`components/deals/`) mirror the established Lead/Site-Visit/Quotation
  row-card pattern but show `quotation_amount` and `job_value` as two
  distinct fields rather than one merged value, since a lead mid-deal is
  exactly the case where those numbers differ and both matter. Added
  "Deals" to the desktop sidebar only, positioned right after Leads
  (matching §8's confirmed Leads-then-Deals nav ordering) without
  reordering any of the other existing nav items.
- Verified live, not from source inspection: at 1440x900, confirmed the
  one real lead (status Quotation, quotation_amount ₹2,35,000, job_value
  ₹2,50,000) renders correctly in Deals with both commercial fields shown
  separately. Used the real Lead Detail pipeline-stage selector to move
  that lead to Site Visit and confirmed it correctly disappeared from
  Deals (exclude-path); moved it to Negotiation and confirmed it correctly
  reappeared (second include-path, Quotation being the first); confirmed
  quotation_amount was untouched by the stage changes throughout. Restored
  the lead to its exact original stage (Quotation) afterward -- confirmed
  via SQL that status/quotation_amount/job_value are all back to their
  original values. At 390x844 and 375x812: confirmed no Deals tab was
  added to the bottom nav (still the same 5 tabs + admin More from the
  prior phase), confirmed `/deals` still renders its mobile card view
  correctly and responsively when reached by direct URL, confirmed no
  horizontal overflow at either mobile size. No console errors at any
  point.
- Not verified live: Staff-role behavior -- no Staff login credentials
  were available (same gap as the three prior phases). Verified
  structurally instead: `/deals` calls `getLeads({})` completely
  unmodified, the same already-verified admin-sees-all /
  staff-sees-own-assigned function every other lead-derived view in this
  app now uses -- no new authorization code was written.
- `npm run lint` / `npx tsc --noEmit` / `npm run build`: all clean.
- Not committed, not pushed. Not proceeding to the next phase.

### 2026-08-30 — Phase 5 (§7/§9/§10): Site Visits & Quotations as UI-level views
- Phase: Site Visits & Quotations only, per the approved next-phase plan.
  UI-level only -- no schema, migration, RLS, or Supabase config change; no
  new query/data-access function beyond what's below. Nothing touched in
  `lib/realtime/`, `lib/whatsapp/`, `/conversations`, `/chat`, Follow-ups,
  Deals, Reports, or Settings. Not committed, not pushed.
- Inspected first: no `/site-visits` or `/quotations` route existed
  anywhere; the only related files were the existing per-lead
  `SiteVisitForm`/`QuotationForm` (Lead Detail edit forms, both untouched
  this phase) and `getLeads()` in `lib/leads.ts`, which already applies
  admin-sees-all / staff-sees-own-assigned scoping (RLS plus an explicit
  app-level `assigned_to_id` filter for staff) -- confirmed unmodified and
  reused as-is, not extended, for both new pages.
- Built two read-only UI-level views, both calling the existing
  `getLeads({})` directly and narrowing the result in-memory -- no new
  `lib/site-visits.ts` or `lib/quotations.ts` module, since a one-line
  filter over an already-fetched, already-scoped list didn't justify one:
  - `/site-visits` (`app/(app)/site-visits/page.tsx`): leads with a
    non-null `site_visit_date`, grouped Today/Upcoming/Past (a page-local
    grouping helper, not exported -- only this one page needs it, unlike
    Follow-ups' `groupFollowUpsByDueDate`, which is shared across that
    page's own desktop+mobile JSX in the same file). "Past" rather than
    "Overdue" -- a completed visit isn't a failure the way a missed
    follow-up is.
  - `/quotations` (`app/(app)/quotations/page.tsx`): leads with a non-null
    `quotation_amount`, sorted by most-recently-updated first, no
    grouping (the field has no date axis the way `site_visit_date` does).
  - New presentational components mirroring `LeadRow`/`LeadCard`'s exact
    established shape (`components/site-visits/{SiteVisitRow,
    SiteVisitCard}.tsx`, `components/quotations/{QuotationRow,
    QuotationCard}.tsx`) rather than reusing `LeadRow`/`LeadCard` directly
    -- those show `job_value ?? quotation_amount`, which would blur
    exactly the field each new view exists to surface (a Won lead's
    `quotation_amount` differs from its closed `job_value`). Both surfaces
    still link back to Lead Detail for actual editing; no new write
    action was added.
- Nav: added "Site Visits" and "Quotations" to the desktop sidebar (both
  confirmed real nav items per §8's nav list, neither admin-gated, same as
  Leads/Follow-ups). Added a "Visits" tab to the mobile bottom nav (now 5
  real tabs + admin "More") -- §1 explicitly lists "site visits" as a
  mobile priority. Quotations deliberately has **no** mobile nav entry --
  §1 lists "quotations" only under Desktop's full CRM operations, not
  among Mobile's daily-work priorities; the page still renders responsively
  if reached by direct URL, it's just not a bottom-nav destination.
- Verified live, not from source inspection: at 1440x900, confirmed both
  real desktop nav links, and that the one real lead's actual
  `quotation_amount` (₹2,35,000) and `site_visit_date` render correctly.
  Used the existing `SiteVisitForm` to move that lead's site visit date
  through Past -> Today -> Upcoming and confirmed all three groupings
  render correctly with real data at each step, then restored the field to
  its exact original value (`2026-08-23 01:19:00+00`) -- confirmed via
  SQL. At 390x844 and 375x812: confirmed the 5-tab (+More) bottom nav,
  each tab a 62-65px touch target well above the 44x44 minimum; confirmed
  Site Visits' mobile card view; confirmed Quotations still renders
  correctly and responsively despite having no nav entry; confirmed no
  horizontal overflow (`scrollWidth === clientWidth`) on any of the four
  page/viewport combinations checked. No console errors at any point.
- Not verified live: Staff-role behavior -- no Staff login credentials
  were available (same gap as the two prior phases). Verified structurally
  instead, and more directly than in prior phases: both new pages call
  `getLeads({})` completely unmodified -- the exact same function already
  verified for the Leads page across earlier sessions -- so staff scoping
  here is provably identical to already-verified behavior, not new
  authorization code that itself needs separate verification.
- `npm run lint` / `npx tsc --noEmit` / `npm run build`: all clean.
- Not committed, not pushed. Not proceeding to Deals or any other phase.

### 2026-08-30 — Phase 4 (§7/§11): Follow-ups workspace
- Phase: Follow-ups only, per the approved next-phase plan. No schema/RLS
  change, no new table, nothing touched in `lib/realtime/`, `lib/whatsapp/`,
  `lib/actions/messages.ts`, `/conversations`, or `/chat`. No Meta API
  activity, no Coexistence, no multi-number work, no `/chat` consolidation,
  no `/conversations` styling migration. Not committed, not pushed.
- Inspected first: the only existing follow-up UI was a per-lead card
  (`FollowUpsCard`/`CreateFollowUpForm`/`CompleteFollowUpButton`) and the
  dashboard's narrow "next 7 days, pending only, limit 20" widget
  (`DashboardFollowUps`/`getUpcomingFollowUps`) -- no `/follow-ups` route
  existed. `follow_ups` already had every column needed
  (`assigned_to_id`, `due_date`, `due_time`, `type`, `status`,
  `completed_at`); confirmed live via `pg_policies` that
  `follow_ups_select_admin_or_owner`/`_insert_.../_update_...` all scope by
  **lead ownership** (`leads.assigned_to_id = auth.uid()`), not
  `follow_ups.assigned_to_id` (which just records who created/actioned the
  follow-up) -- unchanged by this phase, verified not assumed.
- Built one shared data-layer addition, `getFollowUps()` in the existing
  `lib/follow-ups.ts` (alongside, not replacing,
  `getFollowUpsForLead`/`getUpcomingFollowUps`), plus
  `groupFollowUpsByDueDate()` added to the existing client-safe
  `lib/follow-up-status.ts`. One route, `app/(app)/follow-ups/page.tsx`,
  renders both UI layers from that single fetch: desktop (`hidden lg:block`)
  gets the full workspace -- status/type/assignee filter bar
  (`FollowUpsFilterBar`, assignee select only rendered when
  `getAssignableStaff()` returns staff, i.e. admin-only, already-existing
  admin gate reused as-is) and Overdue/Today/Upcoming sections plus a
  collapsed Completed `<details>`; mobile (`lg:hidden`) gets Today's tasks
  only -- Overdue + Today, no filter chrome, "All caught up for today."
  empty state, matching §1's mobile-priority scope. Both render through the
  same `FollowUpsSection`/`FollowUpListItem` components and the existing
  `CompleteFollowUpButton` -- no new complete/create logic was written.
  Added "Follow-ups" to the desktop sidebar and a real "Tasks" tab to the
  mobile bottom nav (now 4 tabs, not folded into the admin-only "More"
  overflow, since §1 lists follow-ups/tasks as a mobile priority for every
  role and `MobileMoreMenu` is admin-gated end to end).
- Verified live, not from source inspection: at 1440×900, created three
  real follow-ups through the actual `CreateFollowUpForm` UI (due
  2026-08-25/08-30/09-05, relative to today 2026-08-30) and confirmed they
  landed correctly in Overdue(1)/Today(1)/Upcoming(1); completed two via
  the workspace's own Complete button and confirmed they moved out of the
  pending default view without a manual refresh; switched the status filter
  to All and confirmed a real "Completed (3)" `<details>` expanded to show
  the correct lead links, dates, and assignee name; confirmed the dashboard
  widget and per-lead card (both sharing the edited `lib/follow-ups.ts`)
  still render with no console errors. At 390×844 and 375×812: confirmed
  the 4-tab bottom nav, Today's-tasks-only view, and the "All caught up for
  today." empty state after completing every test item; confirmed no
  horizontal overflow at either mobile size. All 3 test follow-ups deleted
  afterward -- confirmed via SQL the table is back to its original 3
  pre-existing (unrelated, already-completed) rows.
- Not verified live: Staff-role behavior -- no Staff login credentials were
  available (same gap as the Phase 4b.4 session), and resetting a real
  user's password was judged out of scope for the same reason as before.
  Verified structurally instead: the RLS policies above are completely
  unchanged, are lead-ownership-scoped exactly like every other table in
  this app, and an `assignedTo` filter value a staff caller might pass can
  only ever narrow their own already-RLS-scoped rows, never widen access --
  the same fail-closed pattern already documented in `getLeads()`.
- `npm run lint` / `npx tsc --noEmit` / `npm run build`: all clean.
- Not committed, not pushed.

### 2026-08-30 — Phase 4b.4: Outbound send verification — blocked, no send made
- Phase: 4b.4 only (§32 item 3). No code changed, nothing committed, no
  Realtime/UI behavior touched, no Meta API call made.
- Inspected the existing outbound path before touching anything:
  `lib/actions/messages.ts` (`sendMessage` Server Action) resolves its
  recipient by loading an existing `conversations` row by id and sending
  to that row's `wa_id`/`phone_number_id` — it does not accept an
  arbitrary recipient. `lib/whatsapp/send-message.ts` (`sendTextMessage`)
  confirmed unchanged since Phase 4a/B5: reads `WHATSAPP_ACCESS_TOKEN`,
  POSTs to `graph.facebook.com/v21.0/<phone_number_id>/messages`, only
  persists a `messages` row after Meta accepts the send.
- Queried the live database: exactly one `conversations` row exists
  (`e1062a10-617b-4c2d-931e-67440e7281a7`, `wa_id: 919778346853`,
  `phone_number_id: 1259504780587760` — the confirmed Meta **test** WABA
  phone number ID from the Phase B3 record).
- **Found a real conflict, not a missing value**: this file's own §32
  documents a *different* controlled test recipient
  (`8075287437`) than the one on the only existing conversation
  (`919778346853`), and no conversation row exists for `8075287437` to
  send through via the existing production path. Neither number's status
  as an actually-registered allowed recipient on the Meta test WABA could
  be confirmed from this codebase or database — that's Meta App Dashboard
  configuration, outside what's visible here.
- Per explicit instruction not to guess a recipient or invent/bypass a
  missing authorization, stopped and asked rather than picking one.
  **User's decision: do not send anything this session** — hold Phase
  4b.4 without a live Meta send.
- Outbound send against the real Meta API therefore remains verified by
  code review only (unchanged from the §32 status before this session):
  the pipeline (auth token check → Cloud API POST → 24-hour-window error
  handling → persist-only-after-Meta-accepts → audit log without message
  body → dual revalidatePath for `/conversations` and `/chat`) reads as
  correct, but has never been exercised against Meta's live API on this
  project.
- No code changed — lint/tsc/build not re-run (nothing to verify).
  `git status` unchanged by this session (CLAUDE.md Session Log only).
  Not committed, not pushed.
- Not resolved: which controlled number (if either) is authorized for a
  future live outbound test, and whether it's actually registered as an
  allowed recipient on the test WABA. Needs to be settled explicitly
  before a future attempt at this same phase.

### 2026-08-30 — Phase 4b.3: Live UI integration
- Phase: 4b.3 only (§34). Wired the shared Realtime mechanism from 4b.2 into
  both `/conversations` and `/chat` per the §34 UX contract. No schema
  change, no RLS change, no replacement of the shared mechanism, no
  Coexistence, no outbound Meta API activity. Not committed, not pushed.
- Built: `ConnectionIndicator` (silent when connected, visible
  reconnecting/disconnected states, sr-only accessible label, semantic
  `warning`/`danger` tokens, never color alone); `useLiveConversationList`/
  `useLiveMessages` (in `lib/realtime/conversations.ts`) driving list
  re-sort + transient in-memory-only cue dot and thread live-append with
  id-based dedupe; conditional auto-scroll (`MessageThread`,
  `LiveMessageList`) — near-bottom-only for incoming, always for the
  render right after this client's own data refresh, respecting
  `prefers-reduced-motion`; `aria-live="polite" aria-relevant="additions"`
  on both thread containers, no focus-steal. `ConversationThreadClient`/
  `ChatThreadClient` each call the shared hooks once and feed both
  render slots, so neither page double-subscribes. Existing 3-column
  desktop / full-screen mobile layouts and the two surfaces' distinct
  visual designs (flat list vs. day-separated thread) were left exactly
  as they were — no consolidation, no styling/token migration.
- **Real bug found and fixed, not just wired**: live events were not
  reaching the browser at all. Root-caused via a WebSocket-level trace
  (not guessed): the `phx_join` payload for our `postgres_changes`
  channels carried no `access_token` field, only the anon/publishable
  `apikey` in the socket URL — confirmed against `realtime-js` source
  (`RealtimeChannel.subscribe()` only adds `access_token` to the join
  payload if `socket.accessTokenValue` is already populated synchronously
  when `.subscribe()` runs; it never awaits pending auth). Because every
  relevant RLS policy is scoped `TO authenticated`, every event was
  evaluated as `anon` and silently dropped — connection showed
  "connected", nothing ever arrived. Fix: both realtime hooks now
  `await supabase.auth.getSession()` and
  `await supabase.realtime.setAuth(session.access_token)` before calling
  `.channel().subscribe()`. This is a fix to the existing shared
  mechanism's wiring, not an RLS change, a new table, or an architecture
  replacement — the same `TO authenticated` policies from 4b.2 are
  untouched and now correctly recognized.
- Verified live (not from source inspection): re-traced the WebSocket
  join after the fix and confirmed `access_token` now carries a valid
  `role: authenticated` JWT. Sent six synthetic, HMAC-signed inbound
  webhook events (safe test mechanism per Phase 4a, zero real Meta
  contact) into the existing unlinked test conversation
  (`e1062a10-617b-4c2d-931e-67440e7281a7`) and confirmed, without any
  manual refresh: list reorder + cue dot on `/conversations` and `/chat`
  (Admin, 1440×900, 390×844, 375×812); cue clears immediately on opening
  the conversation; thread live-append with no duplicates on both
  surfaces (`/conversations` flat list, `/chat` day-separated); forced a
  raw WebSocket close mid-session and confirmed the indicator visibly
  transitions connected → "Reconnecting…" (with correct sr-only label) →
  connected once realtime-js auto-reconnects; `aria-live="polite"` present
  on both thread containers; no horizontal overflow at any viewport; no
  console errors at any point. All synthetic test messages deleted and
  `conversations.updated_at` restored to its exact original value
  (`2026-08-22 12:10:14.706643+00`) after each round — confirmed via SQL.
- Not verified live: Staff-role behavior for this phase's live-update
  checks — no Staff login credentials were available, and resetting a
  real user's password to obtain them was judged out of scope (user/role
  management is admin/Supabase-side per §15, not something to route
  around for a test). Verified the authorization boundary structurally
  instead: RLS policies are completely unchanged by this fix, and the one
  live-tested conversation has `lead_id: null`, so `assigned_to_id` never
  matches a staff `auth.uid()` regardless of Realtime — a staff session
  gets nothing from this conversation whether or not Realtime is
  involved. True own-send double-delivery dedupe was verified by code
  reading only (id-based dedupe in `useLiveMessages`), not a live outbound
  send, per this phase's explicit constraint against outbound Meta API
  activity.
- `npm run lint` / `npx tsc --noEmit` / `npm run build`: all clean.
- Not committed, not pushed. Phase 4b.4 not started — awaiting explicit
  approval.

### 2026-08-30 — Phase 4b.2: Supabase Realtime backend/subscription foundation
- Phase: 4b.2 only (§32/§34). No UI wiring, no visual live-update behavior,
  no outbound-send verification, no `/chat`/`/conversations` consolidation,
  no styling migration, no Coexistence. Not committed, not pushed.
- Before writing any code, verified (not assumed) how Supabase Realtime's
  Postgres Changes interacts with this project's RLS: confirmed via
  current Supabase docs ("database records are sent only to clients who
  are allowed to read them based on your RLS policies" — a different,
  older mechanism than the newer Broadcast/Presence "Realtime
  Authorization" feature, which is not needed here) and by reading the
  actual live policy definitions for `conversations`/`messages`
  (`conversations_select_admin_or_owner`, `messages_select_admin_or_owner`
  — both `private.is_admin() OR EXISTS (... assigned_to_id = auth.uid())`,
  correctly admin-only for unlinked/`lead_id IS NULL` conversations).
  Conclusion: no new RLS policy or schema is required — the existing
  policies already give Postgres Changes exactly the right per-client
  scoping. Also confirmed the correct project (`hivuaquqlwfwlbgtooko`,
  "afitcrm") against `NEXT_PUBLIC_SUPABASE_URL` before touching anything —
  a second, similarly-named but unrelated project also exists on the same
  account.
- Database change (via `apply_migration`, the git-and-schema-safety hook
  stayed active throughout): `alter publication supabase_realtime add
  table public.conversations, public.messages;` — the only schema-adjacent
  change made. Verified live afterward via `pg_publication_tables`.
  `get_advisors` (security) shows only one pre-existing, unrelated finding
  (leaked-password-protection disabled) — nothing introduced by this
  change.
- Code: one new file, `lib/realtime/conversations.ts` —
  `useConversationListRealtime()` (list-level, no client-side filter,
  relies entirely on RLS for scoping) and `useMessageRealtime(
  conversationId, onMessage)` (thread-level, filtered by
  `conversation_id` for traffic only, not for authorization). Both return
  a `connecting | connected | reconnecting | disconnected` state. This is
  the one shared mechanism §34 requires for both `/conversations` and
  `/chat` — neither page consumes it yet (that's 4b.3).
- A real lint bug was caught and fixed during this phase: mutating a ref's
  `.current` during render (the "keep latest callback" pattern) is now
  flagged by this project's ESLint config — fixed by moving the ref
  update into its own `useEffect`.
- Verified: lint/tsc/build all clean. `git status` confirms only
  `lib/realtime/` (new) plus this Session Log entry changed — no
  component, no `/conversations` or `/chat` file touched. `afit-verify`
  was not invoked — there is no browser-observable behavior yet to check
  (nothing renders from this file), consistent with its own scope.
- Known limitation, not a blocker: Realtime's per-client access-policy
  cache is refreshed on (re)connect or a new JWT, not instantly on every
  RLS-relevant change elsewhere (e.g., a lead reassigned away from a
  staff member mid-session) — self-heals on reconnect/token refresh, not
  a security hole, but worth remembering if it's ever reported as a bug.
  Also per Supabase's own docs, a complex joined RLS policy adds latency
  to Realtime at scale — a non-issue at this project's current size (1
  admin, 1 staff).
- Not done: Phase 4b.3 (wiring this into `/conversations` and `/chat`,
  visual live-update behavior) — explicitly not started.

### 2026-08-30 — Phase 4b.1 UI/UX decisions persisted
- Phase: 4b.1 (design only) — documentation persistence step. No product
  code, schema, Supabase config, Skills, Agents, MCP, Hooks, Commands, or
  Settings touched; nothing committed.
- Finalized the Phase 4b.1 live-conversation-update UX decisions in
  conversation across several turns, then persisted the DECIDED
  implementation contracts (not the full design report) as new §34 —
  visual language reuse, conversation-list re-sort + transient non-
  persisted cue, thread auto-scroll rules, connection-state treatment,
  accessibility requirements, multi-number/channel-agnostic UI
  constraints, and the shared-mechanism/RLS-safe/dedupe-by-id contract
  4b.2/4b.3 must follow — plus what's explicitly deferred (persisted
  unread, number/channel UI, `/chat` consolidation, styling migration,
  Coexistence).
- Verified: re-read only §34 after writing it; no contradiction with
  §17/§30/§31/§32 (§34 explicitly defers to them rather than restating).
  `git status` confirms only CLAUDE.md changed.
- Not done: Phase 4b.2 (Realtime) — explicitly not started, waiting for
  separate explicit approval.

### 2026-08-30 — Settings (Claude Code infrastructure, section 7 of 7) — approved conclusion: no change
- Phase: none — Claude Code infrastructure only. No product code, schema,
  package files, Skills, Agents, Commands, Hooks, or MCP config touched;
  nothing committed.
- Freshly re-inspected (not assumed from prior sessions): `.claude/
  settings.json` contains only the `hooks` key registering `git-and-
  schema-safety` under two PreToolUse matchers (from the Hooks section);
  no `permissions`, `env`, or other keys exist. No `.claude/settings.local
  .json`. No project sets a permission mode of its own — actual
  prompting behavior this whole conversation has come from the user's
  own global/session-level configuration, outside this project's scope.
- Considered and explicitly rejected three candidate additions: (1)
  `permissions.deny` mirroring the hook's git/schema patterns — would
  contradict the hook's deliberate "ask, not hard-block" design from the
  Hooks section, since deny is unconditional and would make an
  explicitly-approved commit permanently impossible; (2) `permissions.ask`
  duplicating the hook's match list as a "backup" — rejected as a second
  mechanism that could drift out of sync with the hook over time for no
  demonstrated benefit, since the hook already fires reliably (re-
  confirmed live this session); (3) `permissions.deny` for the MCP
  connectors flagged as irrelevant/risky in the MCP audit (Meta_Ads,
  Notion, Google Drive/Calendar/Gmail, Cloudflare) — genuinely would
  operationalize an already-approved conclusion, but explicitly out of
  scope for this session ("do not modify MCP"); noted as a real FUTURE
  candidate if that boundary is ever deliberately reopened, not smuggled
  in here.
- **Conclusion: the existing `.claude/settings.json` (hooks registration
  only) is already the complete, correct, minimal settings configuration
  this project needs.** Nothing added, changed, or removed.
- Verified: re-ran the hook's pipe-test (`git commit` → ask,
  `npm run lint` → silent allow) to confirm the registration still works
  after this session's inspection; validated `settings.json`'s JSON with
  Node. Confirmed `.claude/commands/`, `.claude/skills/`, `.claude/hooks/`
  file listings unchanged; no `.claude/agents/`; no `.mcp.json`. `git
  status` shows only this Session Log entry changed. Did not run the
  application test suite — configuration/documentation only.
- **This completes the planned Claude Code infrastructure sequence**
  (CLAUDE.md → Skills → Agents → MCP → Hooks → Commands → Settings, §27).
  Next up, per the user's own stated remaining workflow: Phase Plan → UI
  Design → Implementation → Full Test → Report — i.e., resume real
  product work, starting with the reconciled Phase 4b scope in §32.

### 2026-08-30 — Commands (Claude Code infrastructure, section 6 of 7) — one command added
- Phase: none — Claude Code infrastructure only. No product code, schema,
  package.json, Skills, Agents, Hooks, or MCP config touched; nothing
  committed.
- Added exactly one custom command, `/phase` (`.claude/commands/
  phase.md`). It is pure orchestration — a pointer to the four things
  that already own the substance (CLAUDE.md for the rules, `ui-ux-pro-max`
  for design exploration, `afit-verify` for testing, `git-and-schema-
  safety` for destructive-action safety) — not a restatement of any of
  them. Its job is replacing the phase-discipline ceremony text that's
  been manually retyped, with variation, in nearly every message across
  this multi-session infrastructure work, with one deterministic
  `/phase <scope>` invocation.
- Considered and explicitly rejected separate commands for UI design,
  implementation, verification, and reporting — each already belongs to
  an existing skill, or varies too much by phase to templatize, or (for
  "stop"/`/clear`) is already a built-in.
- Verified: `.claude/commands/phase.md` exists with valid YAML
  frontmatter (`description`, `argument-hint`) and a concise body; no
  other command file was created; `.claude/skills/`, `.claude/hooks/`
  contents confirmed byte-identical to before this session (compared
  file listings); no `.claude/agents/` exists (unchanged, none created).
  `git status` confirms only `.claude/` (new) and this Session Log entry
  changed. Did not run the application test suite — configuration/
  documentation only.
- One honest caveat, same category as the Skills-section finding: I
  can't directly introspect Claude Code's live slash-command registry
  from inside a session the way I could pipe-test the Hooks script —
  confirming `/phase` is actually recognized needs the user to try typing
  it (or check `/help`).
- Not done: Settings — next, not started, per the one-section-at-a-time
  rule.

### 2026-08-30 — Hooks (Claude Code infrastructure, section 5 of 7) — one hook added
- Phase: none — Claude Code infrastructure only. No product code, schema,
  Skills, Agents, or MCP config touched; nothing committed.
- Added exactly one PreToolUse hook, `git-and-schema-safety`
  (`.claude/hooks/git-and-schema-safety.sh`, wired via `.claude/
  settings.json`). It protects: `git commit`/`git push` (incl. `--force`/
  `--force-with-lease`)/`git reset --hard`/`git clean -f` via the `Bash`
  matcher, and `mcp__claude_ai_Supabase__{apply_migration,pause_project,
  delete_branch,reset_branch}` unconditionally plus `execute_sql` only
  when its `query` input contains CREATE/ALTER/DROP/TRUNCATE, via a second
  matcher on those five exact MCP tool names (confirmed from the actual
  tool list available in this project — none invented).
- On a match it returns `permissionDecision: "ask"` — never a silent
  allow, never a hard deny — so a genuinely user-approved commit/push/
  migration can still proceed through Claude Code's normal permission
  flow. `jq` isn't installed on this machine (discovered by pipe-testing
  the raw command before wiring it in, per the update-config skill's own
  verification workflow) — rewrote the script to use `node` (already a
  project dependency) for JSON parsing instead.
- This hook is a purely mechanical safeguard for irreversible actions —
  it does not and cannot enforce phase boundaries, UI-before-backend
  ordering, or scope discipline; those remain behavioral, per §21/§27/
  §28/§29 and the Agents section's conclusion.
- Verified: pipe-tested the script directly against synthetic stdin for
  every required case (ordinary Bash, `git status`, `git commit`,
  chained `git add && git commit`, `git push --force`, `git reset
  --hard`, `git clean -f`, `execute_sql` SELECT vs. ALTER/DROP,
  `apply_migration`, `pause_project`, an unlisted Supabase tool, and an
  unrelated `Read` call) — all matched the expected allow/ask outcome.
  Then proved the hook actually fires through Claude Code's own harness
  (not just the manual test) by temporarily prefixing the Bash matcher's
  command with a sentinel write, triggering a real Bash call, confirming
  the sentinel file was written, then reverting the prefix and deleting
  the sentinel file. Validated `.claude/settings.json`'s JSON structure
  with Node (no `jq`). `git status` confirms only `.claude/` (new,
  untracked) plus this Session Log entry changed.
- Not done: Commands, Settings — next, not started, per the
  one-section-at-a-time rule.

### 2026-08-30 — MCP (Claude Code infrastructure, section 4 of 7) — approved conclusion: none
- Phase: none — Claude Code infrastructure only. No product code, schema,
  Skills, Agents, or config touched; nothing committed.
- Confirmed no project-local `.mcp.json` or MCP references anywhere in
  the repo other than this infrastructure work's own session-log entries.
  Audited the globally-available connectors against this project's actual
  history: `playwright` is the one genuinely load-bearing tool (every
  phase's live verification has run through it); `Supabase` was loaded
  once (Phase 4a verification) but not trusted/used, and exposes real
  destructive capability (`execute_sql`, `apply_migration`,
  `pause_project`, branch resets) against a project with an explicit
  no-schema-changes-without-approval rule; `Meta_Ads` is a different Meta
  product surface (Marketing API) than the WhatsApp Cloud API this
  project actually integrates with, and carries real external-side-effect
  risk if ever misused; `claude-in-chrome`, `Notion`, `Google_Drive`,
  `Google_Calendar`, `Gmail`, and `Cloudflare_Developer_Platform` have
  zero relevance to this project.
- **Approved conclusion:**
  - No project-level MCP configuration (`.mcp.json`) is required.
  - `playwright` (global, already sufficient) remains the sole
    browser-automation tool — no second Playwright framework, no
    duplicate browser tooling.
  - `Supabase` MCP may be used opportunistically, read-only, case-by-case
    once its link to the actual project is verified — never a default,
    never its write/lifecycle operations without explicit per-instance
    approval.
  - `Meta_Ads`, `claude-in-chrome`, `Notion`, `Google_Drive`,
    `Google_Calendar`, `Gmail`, `Cloudflare_Developer_Platform` should not
    be reached for on this project.
- Not done: Hooks, Commands, Settings — next, not started, per the
  one-section-at-a-time rule.

### 2026-08-30 — Agents (Claude Code infrastructure, section 3 of 7) — approved conclusion: none
- Phase: none — Claude Code infrastructure only. No product code, schema,
  Skills, or config touched; nothing committed.
- Audited agent infrastructure: confirmed no project-local `.claude/agents/`
  exists. Reviewed the built-in agent types available regardless
  (`claude`, `claude-code-guide`, `Explore`, `general-purpose`, `Plan`,
  `statusline-setup`) against this project's actual history and found no
  task that was (a) repeated, (b) mechanical/bounded, (c) genuinely
  benefited from context isolation, and (d) didn't need the user in the
  loop mid-task — the combination needed to justify a dedicated agent.
- **Approved conclusion:**
  - No project-local `.claude/agents/` are required.
  - No custom agents should be added at this stage.
  - Built-in agents (including ad hoc `fork`) remain available for
    occasional use at the main session's own discretion — no project
    configuration needed for that.
  - Agents are not the mechanism for enforcing phase boundaries (they
    have no authority over the main session's own turn-taking); that
    belongs to Hooks, if it's ever needed, not Agents.
- Not done: MCP, Hooks, Commands, Settings — next, not started, per the
  one-section-at-a-time rule.

### 2026-08-30 — Skills (Claude Code infrastructure, section 2 of 7)
- Phase: none — Claude Code infrastructure only (Skills section of the
  CLAUDE.md→Skills→Agents→MCP→Hooks→Commands→Settings sequence). No
  product code, schema, package.json, or dependencies touched; nothing
  committed.
- Audited the one existing project-local skill,
  `.claude/skills/ui-ux-pro-max/` (a vendored generic design-recommendation
  tool — 377-line SKILL.md, Python CLI, CSV style/palette/typography
  databases). Confirmed it can create a competing design-system source of
  truth via its own documented `--persist` flag (writes `design-system/
  MASTER.md`, self-labeled "Global Source of Truth"), and its original
  frontmatter description was broad enough to plausibly auto-trigger on
  routine implementation/backend/testing phrasing, not just genuine design
  exploration. Per explicit instruction, kept — not removed, not rewritten
  — its actual design methodology, Python scripts, and CSV data are fully
  intact.
- Changed only two things in `ui-ux-pro-max/SKILL.md`: (1) narrowed the
  frontmatter `description` to explicit design-exploration use only,
  excluding implementation/backend/testing tasks; (2) added a short
  project-note callout (not touching the methodology below it) stating
  CLAUDE.md §2 is this project's authoritative design system, `--persist`
  must not be used here, and any output is a proposal to reconcile by hand
  — never a standalone spec.
- Added `.claude/skills/afit-verify/SKILL.md` (53 lines) — explicit-
  invocation-only verification procedure. Points to CLAUDE.md §17/§18 as
  the governing requirements rather than restating them; covers only
  scope discipline (test what changed, not the whole app), when to skip
  static checks, the three required viewports, role/permission and
  overflow checks, and three project-specific Playwright gotchas hit
  repeatedly this conversation (dev-overlay click interception, `<select>`
  label-vs-value matching, RSC-revalidation wait). Ends with: never modify
  product code while verifying, never commit, never push, report and stop.
- Verified: both skills' directories/files intact (`ui-ux-pro-max`'s 3
  Python scripts + 14 top-level CSV/data files confirmed present and
  unchanged; both `SKILL.md` frontmatters are well-formed YAML — checked
  by hand for unescaped quotes). `git status` confirms only `.claude/`
  (untracked as a whole) changed this session, nothing else. One notable
  finding: the newly-created `afit-verify` skill appeared correctly in
  the live skill listing within this same session, but the edited
  `ui-ux-pro-max` description did not refresh in-session (the listing
  still showed its old, cached description) — the file on disk is
  correct; whether the narrower description actually reduces auto-trigger
  matching should be confirmed after a fresh session.
- No lint/tsc/build run — Skills/configuration documentation only, no
  code changed (per explicit instruction).
- Not done: Agents, MCP, Hooks, Commands, Settings — next, not started,
  per the one-section-at-a-time rule.

### 2026-08-30 — AGENTS.md reconciliation
- Phase: none — Claude Code infrastructure work (Part 1 audit → Part 2,
  section 1 of the ordered CLAUDE.md→Skills→Agents→MCP→Hooks→Commands→
  Settings→Phase Plan sequence). No product/application code, schema, or
  config touched; nothing committed.
- Audited actual repo infrastructure first (not assumed): confirmed zero
  project-local `.claude/settings.json`, hooks, commands, or agents exist;
  the only project-local `.claude/` content is a vendored `ui-ux-pro-max`
  skill; no `.mcp.json`; no installed Playwright test framework (all UI
  verification this project has done is ad-hoc MCP browser automation,
  not a repeatable suite); `.playwright-mcp/` has accumulated 337 files/
  2.8MB of untracked session output; and a second, previously-unexamined
  instruction file, `AGENTS.md` (688 lines, repo root), exists and is
  **not** part of Claude Code's automatic context here.
- Compared `AGENTS.md` against this file section by section. Folded
  genuinely new, still-relevant information into the right existing
  sections rather than a wholesale copy: permission/sensitive-data
  specifics → §16; audit event taxonomy → §13; calling scope → §19;
  architecture priority tiebreaker → §21; WABIS (a temporary, separate
  WhatsApp integration this file had never once mentioned, and the actual
  explanation for the `WEBHOOK_DISCOVERY_MODE` code comment found during
  the Phase 4a verification session) and the Phase B3 WhatsApp
  media-download record (commits `54a8c11`/`3c0f004`, verified against a
  real Meta test WABA — a third already-built-and-verified WhatsApp
  capability beyond what §32 previously credited) → §32. Added new §33
  documenting AGENTS.md's status and pointing to where each piece landed.
- Resolved the one direct contradiction: AGENTS.md said to auto-commit
  after every successful phase; corrected that section in AGENTS.md
  itself to point to CLAUDE.md §18/§27 (no automatic commits, ever) as
  authoritative, rather than leaving two files disagreeing. Also marked
  AGENTS.md's stale "STOP LEAD LEAKAGE" current-priority checklist as
  resolved (CLAUDE.md §16 already covers this as done), pointing back
  here instead of reading like an open emergency. Added a short header
  note at the top of AGENTS.md stating CLAUDE.md is authoritative.
- Left completely untouched: the Next.js 16 dev-server's auto-generated
  `<!-- BEGIN:nextjs-agent-rules -->` block at the end of AGENTS.md
  (confirmed byte-for-byte unchanged) — that's tooling-managed content,
  not something to fight or rewrite.
- Verified: re-read both files in full after editing. Heading numbering
  in CLAUDE.md is sequential 0–33 with no gaps (one placement mistake
  caught and fixed mid-edit — §33 briefly landed before the WABIS/B3
  subsections that belong under §32; corrected). No lint/tsc/build run —
  this session touched only two Markdown files, nothing that affects the
  Next.js build.
- Not done: Skills/Agents/MCP/Hooks/Commands/Settings sections of the
  infrastructure redesign — explicitly next, not started, per the
  one-section-at-a-time rule. Not started: repeatable Playwright test
  suite, `.gitignore` additions for `.playwright-mcp/`/`.claude/`/
  `design/`/`graphify-out/`/loose screenshots (flagged in the audit,
  deferred to whichever future section covers it).

### 2026-08-30 — Documentation reconciliation (this session)
- Phase: none — documentation/architecture update only, no source touched.
- Read CLAUDE.md in full and compared it against live product decisions
  made in conversation since the last update. Found and fixed: §0 was
  missing three sessions' worth of real work (the 0a/0b/1/2/3 commit,
  Phase 4a verification, and the WhatsApp Numbers Settings UI session —
  all backfilled below); §22 "Current priority" still pointed at Phase 3
  after it shipped; §15 said no Settings page existed after one had been
  built (uncommitted).
- Added §27–§32: strict one-phase-then-`/clear` workflow, UI-first rule,
  token/session efficiency rule, the current central-WhatsApp-number
  production architecture, future (not-yet-implemented) Coexistence
  direction, and a reconciled Phase 4a/4b status replacing the stale
  bundled description in §25/§26 (left those sections' original text
  intact for history; §32 is the current source of truth on WhatsApp
  phase status).
- Not done: no code, schema, or config changed; no commit made.

### 2026-08-30 — WhatsApp Number Management UI (Settings)
- Phase: new, ad hoc — not in the original §7 list (see §32/§15). UI/UX
  only, explicitly no backend, per session instruction.
- Built: `/settings` (index) and `/settings/whatsapp-numbers`, admin-only
  (page-level check, same pattern as `/automation`). A list of WhatsApp
  numbers in business language (name, formatted number, status badge,
  purpose tag, assigned staff or "All staff", default badge) plus a
  guided 5-step "Add WhatsApp Number" wizard (Connect → Purpose → Assign →
  Default → Review) and a single-screen "Manage" edit form. Added a
  "Settings" entry to the admin desktop sidebar and mobile "More" menu.
  Staff picker uses real `getAssignableStaff()` data; everything else
  (`lib/settings/whatsapp-numbers.ts`) is local component state seeded
  with mock numbers — no `whatsapp_numbers` table exists, matching the
  Automation prototype's precedent (§12) and §3's no-new-schema rule.
- Fixed two real accessibility bugs found during Playwright testing
  (button-group controls nested inside a single `<label>`, producing
  garbled combined accessible names — switched to `<fieldset>`/`<legend>`)
  and one real logic bug (editing the number that's already default
  incorrectly warned it would "replace" the current default).
- Verified: lint/tsc/build clean. Playwright — Admin 1440×900/390×844/
  375×812: full add-wizard flow, edit, set-default, all correct, no
  overflow. Staff: no Settings nav entry anywhere, and both `/settings`
  and `/settings/whatsapp-numbers` return server-side 404.
- Not done / explicitly deferred: no persistence, no real Meta connection,
  no Realtime — see §32.

### 2026-08-30 — Phase 4a verification (no implementation)
- Phase: 4a (§25/§26) — verification only, per explicit instruction not to
  touch Phase 4b.
- Found that Phase 4a's env-var prerequisites already existed
  (`WHATSAPP_VERIFY_TOKEN`/`WHATSAPP_APP_SECRET`/`WHATSAPP_ACCESS_TOKEN`)
  and that most of what §25/§26 call "Phase 4b" was already built and
  already committed from before this session (webhook receiver, outbound
  sender, three-column Conversations UI) — see §32 for the full
  reconciliation this triggered.
- Verified locally (no Meta contact): GET verification handshake (correct/
  wrong token); POST with a self-computed valid HMAC-SHA256 signature
  ingests correctly into `conversations`/`messages`; invalid signature
  correctly rejected (401). Verified live in the UI: Admin sees the
  ingested message, thread + lead-details panel render correctly, Staff's
  list is correctly empty and a direct URL to an unlinked conversation
  404s. Test data cleaned up afterward (DB confirmed back to its exact
  prior single-conversation state).
- Not verified (and not safe to from this environment): a real send
  through Meta's live Graph API (would be a genuine external side effect
  on the real business account) and Meta's own delivery of a webhook call
  from its real infrastructure (requires this URL to be publicly
  registered, which is the Phase 4a account-setup step itself).
- Confirmed gap, not fixed (explicitly out of scope): no Supabase Realtime
  anywhere in the codebase — new messages need a manual refresh.

### 2026-08-30 — Phase 0a/0b/1/2/3 commit
- Phase: committing already-verified work, no new implementation.
- All four phases existed uncommitted in the working tree from prior
  sessions (Phase 3 had just been verified per the entry below; 0a/0b/1/2
  were already logged/built but never committed). Staged and committed
  exactly those files — commit `c6834a9` — deliberately excluding the
  in-progress Automation prototype, its `@xyflow/react` dependency bump,
  and all design/screenshot assets sitting in the same working tree.
- Not pushed, not deployed.

### 2026-08-30 — Phase 3 (verification only)
- Phase: 3 (Stage-aware Lead Detail, §5/§7/§22)
- Scope: this session did NOT write the Phase 3 implementation — it already
  existed, uncommitted, in the working tree (`lib/lead-stage-sections.ts`,
  `NextActionCard`, `QualificationScoreCard`, `LeadActivity`, and the gated
  sections in `app/(app)/leads/[id]/page.tsx`), evidently from a prior
  session that never logged or committed it. Per explicit instruction this
  session verified that existing implementation only — did not touch
  Dashboard, Leads-list, or the new `automation/` feature also sitting
  uncommitted in the same working tree (see the pre-existing but unlogged
  scope noted below).
- Verified: `npm run lint`, `npx tsc --noEmit`, `npm run build` all clean.
  Live Playwright verification against the single real lead in the DB
  (`afsal test`, id `88b62dab-...`, normally at Quotation), cycling its
  `status` through all 8 pipeline stages plus Won and Lost (via
  MarkWonForm/MarkLostForm, not the generic selector) as Admin
  (qetamarks@gmail.com) at 1440×900/390×844/375×812, and re-checked the
  same lead as Staff (afitinteriors@gmail.com, the assigned owner) at the
  same three viewports. For every stage the rendered section set matched
  `STAGE_SECTIONS` in `lib/lead-stage-sections.ts` exactly: New/Contacted/
  Qualified → Qualification only; Site Visit → +Site Visit; Quotation/
  Negotiation → +Quotation +Commercial; Won/Lost → Commercial only, no
  Qualification/Site Visit/Quotation. `canMarkWon` gating held too: the
  Won form only appeared when the stage was Quotation/Negotiation; New/
  Contacted/etc. offered only "Mark as Lost"; once Won, "Correct to Lost"
  replaced the open form and Won's job_value read-out showed
  correctly; once Lost, the page became a plain read-out with no
  Won/Lost form at all, per §6. Staff view showed identical stage gating
  and correctly omitted the admin-only Activity section entirely (already
  enforced by `LeadActivity`'s own role check, untouched this session).
  No horizontal overflow at any of the 6 role×narrow-viewport
  combinations checked (`document.documentElement.scrollWidth ===
  clientWidth` at 390 and 375 for both roles). Restored the lead to its
  exact original state afterward (status Quotation, job_value ₹2,50,000,
  quotation_amount ₹2,35,000, lost_reason cleared) — confirmed via a hard
  reload before finishing.
- One non-issue worth recording: right after changing stage via the
  selector, the newly-revealed/hidden sections can lag the DOM by ~1-2s
  before Next.js's Server Action revalidation repaints them (confirmed by
  waiting vs. not waiting before re-snapshotting) — not a Phase 3 defect,
  just note it if it ever gets reported as one.
- Not done this session (explicitly out of scope): Dashboard changes,
  Leads-list/`LeadCard` changes, and the new `automation/` feature that
  are all also sitting uncommitted and unlogged in this working tree from
  before this session — none of that was reviewed, tested, or touched.
  Nothing was committed; `git status` still shows all of it uncommitted.

### 2026-08-29 — Phase 0b
- Phase: 0b (AppShell, §1/§7)
- Note: no master planning brief attachment was actually received this
  session; proceeded using this file's own §1/§2/§7/§24 as the governing
  spec, since it already encodes the relevant excerpts.
- Inspected first (per §21): `app/(app)/layout.tsx`, `components/Sidebar.tsx`,
  `SidebarNavItem.tsx`, `SidebarAdminNav.tsx`, `SidebarProfileFooter.tsx`,
  `MobileBottomNav.tsx`, `MobileMoreMenu.tsx`, `MobileAdminMore.tsx`,
  `BuildingEmblem.tsx` — a working, role-aware, two-render-path AppShell
  already existed (dark sidebar+admin section on desktop; 3-item bottom nav
  + admin-only "More" overflow on mobile). Nav item lists were already
  correct per §1/§24 (Dashboard/Leads/Conversations only — no placeholder
  links for Deals/Quotations/Site Visits/Follow-ups/Reports, none of which
  have routes yet). Did not add any nav items.
- Built: wired Phase 0a tokens into the existing shell chrome only —
  `bg-gradient-dark-bg` on the desktop sidebar and mobile top bar
  (previously flat `bg-sidebar`), and converted `MobileBottomNav`/
  `MobileMoreMenu` from the light theme (`bg-card`/`text-muted-foreground`)
  to the same dark-chrome tokens already used by the sidebar
  (`bg-gradient-dark-bg`, `border-sidebar-border`, `text-sidebar-muted`/
  `text-sidebar-primary`/`text-sidebar-foreground`) — mobile chrome was
  inconsistent (dark top bar, light bottom bar) before this. Applied
  `font-brand` (falls back to system-ui until Inter is mounted) to the two
  "AFIT" wordmark spots only. No nav structure, route, or role-gating logic
  changed.
- Verified: lint clean, tsc clean, build clean. Playwright — Admin
  1440×900/390×844/375×812 and Staff 1440×900/390×844/375×812: exactly 3
  nav items + admin "More" (Automation/Audit Log) for Admin, exactly 3 items
  and no "More" for Staff on mobile; no Admin sidebar section for Staff;
  `/automation` still 404s for Staff; active-route highlighting correct on
  both nav surfaces; no horizontal overflow at any size; bottom-nav touch
  targets 120×62 well above 44×44.
- Not done yet / deliberately untouched: Lead Detail, pipeline/stage logic,
  Won/Lost logic, Automation/Audit Log functionality, RLS/auth, schema, the
  light "+ New Lead" header bar and `<main>` content area (left as-is —
  content chrome, not navigation). Inter is loaded (`lib/fonts.ts`) but
  still not mounted anywhere (`--font-inter` unset); `font-brand` currently
  renders as system-ui everywhere it's used.
- Remaining pre-existing issue noticed, not fixed (out of scope per this
  session's instruction not to expand scope): the global "Sign out" text
  link and "+ New Lead" header button are both under the 44×44 touch-target
  minimum on mobile — predates this phase, not part of the AppShell nav
  surfaces touched here.

### 2026-08-29 — Phase 0a
- Phase: 0a (design tokens, §2/§7)
- Built: extended `app/globals.css` (additive only) with Phase-0a tokens —
  `--glass-fill` (rgba(255,255,255,0.06)), `--surface-foreground` (#FFFFFF)
  / `--surface-foreground-muted` (#A3A3A3), `--error` (#EF4444) /
  `--error-foreground`, `--gradient-primary` and `--gradient-dark-bg`
  (linear-gradients), all mapped in `@theme inline` so Tailwind generates
  `bg-glass`, `text-surface-foreground(-muted)`, `bg-error`/`text-error`/
  `border-error` utilities; plus two plain `.bg-gradient-primary` /
  `.bg-gradient-dark-bg` classes since gradients aren't Tailwind color
  tokens. Reused the existing `--brand-600` (#16A34A) and `--chrome-900`/
  `--chrome-800` (#0B1210/#0F1A14) rather than redefining them under new
  names — they already matched §2 exactly and predate this phase (see the
  file's own header comment). Added `lib/fonts.ts` loading Inter via
  `next/font/google` (`--font-inter`) and a `--font-brand` theme token
  falling back to a plain sans stack until a later phase mounts it.
- Verified: `npm run lint` clean, `npx tsc --noEmit` clean, `npm run build`
  clean. No page/component file touched; no existing token's value changed
  (diff-reviewed) — `lib/fonts.ts` is not imported anywhere yet.
- Not done yet: nothing from §2 is wired into any page. Phase 0b (AppShell)
  is the first phase expected to actually consume these tokens.
<!-- 2026-08-29 — example entry format:
- Phase: 3 (stage-aware Lead Detail retrofit)
- Built: STAGE_SECTIONS config, gated Overview/Work/Commercial/Close rendering
- Verified: lint clean, tsc clean, build clean, Playwright admin+staff @ 1440x900/390x844/375x812
- Not done yet: Won/Lost close-workflow copy update
-->

---

## 1. Product shape — two deliberately different experiences

**Desktop = management/workspace.** Full CRM operations: pipeline
management, detailed lead/customer info, commercial info, quotations,
site-visit management, follow-ups/tasks, conversations, reports,
automation, audit log, admin/settings.

**Mobile = daily field/work execution.** Primary (bottom bar, every role):
today/home, leads, conversations, follow-ups/tasks. Secondary (mobile-
reachable, but via the More menu's Work section, not the bottom bar, every
role): site visits, deals, quotations. Quick actions, status updates,
calling/WhatsApp, and notes are embedded within these surfaces, not
separate nav destinations.

> **Updated 2026-08-30 (Mobile Navigation IA restructure):** this section
> originally listed mobile priorities as one flat, untiered set including
> site visits. That became the literal 5-tab bottom bar built across the
> Follow-ups/Site-Visits/Deals/Quotations phases — workable at the time,
> but the wrong shape for a bar that's supposed to stay 4 items as more
> modules arrive. Site visits (and, newly, deals/quotations, which had no
> mobile path at all before this) are still mobile-accessible — just one
> tap into More, not a permanent tab — rather than left desktop-only or
> silently contradicting this section.

Rules:
- Do NOT shrink the desktop UI onto mobile. Build two intentional surfaces.
- Do NOT expose every desktop module on mobile.
- Automation, Audit Log, and Settings are desktop/admin-only for primary
  navigation — never in the primary bottom bar, never visible to staff on
  mobile at all. On mobile they exist only inside the More menu's
  admin-only Management/System sections. (Corrects this rule's earlier
  "never in mobile nav" wording, which was already stale — the admin-only
  mobile More menu exposing exactly these two/three has existed since
  Phase 0b, before this section was last edited.)
- Mobile prioritizes what a salesperson needs *during the day*, not parity
  with desktop. The bottom bar itself prioritizes the highest-frequency
  subset of that — everything else mobile-relevant lives one tap away in
  More, not permanently on the bar.

---

## 2. Design system — build this before any page

Extracted from the brand spec. These are tokens, not per-component choices.
Put them in one place (Tailwind theme extension or CSS variables) and every
screen consumes them. Nobody redefines a hex code inline.

| Token | Value |
|---|---|
| Primary green | `#16A34A` (gradient variants for buttons) |
| Dark background | gradient `#0B1210` → `#0F1A14` |
| Glass card fill | `rgba(255,255,255,0.06)` |
| Text primary | `#FFFFFF` |
| Text secondary | `#A3A3A3` |
| Error | `#EF4444` |
| Font | Inter or Poppins |

Effects: subtle glassmorphism on cards, green gradient on primary buttons,
soft glow/particle accents on dark backgrounds (used sparingly — this is a
CRM, not a landing page). Rounded corners throughout, consistent radius.

Avoid: generic AI-slop patterns — accent stripes/color bars under titles,
default-blue palettes, cream/beige backgrounds, low-contrast icon-on-dark
combos. This brand already has a real identity (dark green chrome); don't
dilute it with default component-library styling.

---

## 3. Current database reality — do not invent entities

Live Supabase inspection confirmed these tables exist:

- `leads`
- `profiles`
- `conversations`
- `messages`
- `follow_ups`
- `audit_logs`

There is currently **no**:
- `deals` table
- `quotations` table
- `site_visits` table
- `reports` table
- admin/settings table

Lead fields include `status`, `job_value`, `quotation_amount`,
`site_visit_date`, `lost_reason`, plus attribution fields
(`campaign_name`, `adset_name`, `ad_name` — already threaded through from
Meta Ads, useful for the WhatsApp→CRM attribution work separately in
progress).

**Do not create new tables (deals, quotations, site_visits, reports,
admin_settings) without explicit approval.** Build UI-level views over
existing fields first; only promote to real schema once the UI-level
version has been used and has hit a real limit (see §8/§9).

---

## 4. Pipeline — exactly 8 user-facing stages

1. New
2. Contacted
3. Qualified
4. Site Visit
5. Quotation
6. Negotiation
7. Won
8. Lost

`Invalid` may exist internally for schema/data compatibility but is never a
user-facing pipeline stage.

The closed/default Lead Detail UI shows **only the current stage** —
never the full New→...→Lost chain as a permanent section. The stage
selector may expose all 8 when opened; the rest of the page stays
compact.

---

## 5. Stage-aware Lead Detail — THE core UX rule (currently unmet)

> **Status check before starting new work:** an earlier pass reorganized
> Lead Detail into a fixed 7-section layout (Header, Next Action, Overview,
> Work, Commercial, Activity, Close Lead) with one clear owner per section.
> That fixed the duplicate-card problem. It has **not** yet implemented
> per-stage visibility — every stage currently renders the same sections.
> This section (§5) is not yet satisfied. Treat it as the next real task,
> not a "nice to have."

The lead page should read as:

```
CURRENT STAGE → WHAT MATTERS NOW → NEXT ACTION → RELEVANT INFO → HISTORY
```

Not: everything about the entire sales process at once.

**Implementation approach:** a single config mapping stage → which
sections/actions render, e.g.:

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

Reuse every component already built (`NextActionCard`, `QualificationScoreSummary`,
`ConversationCard`, etc.) — this is about changing *what renders*, not
building new cards. Do not display irrelevant future-stage sections
(e.g. don't show Commercial/negotiation UI on a brand-new lead).

---

## 6. Won/Lost safety — do not remove

Won requires `job_value`. Lost requires `lost_reason`. These transitions
must stay gated:

- `setLeadStatus()` (generic) must reject direct writes of `Won`/`Lost`
  server-side. This protection already exists — **do not remove it.**
- Won/Lost can only be set through `markLeadWon()` / `markLeadLost()`,
  which enforce their required fields.
- The stage selector may list all 8 stages, but selecting Won/Lost routes
  into the proper close workflow, never a bare status write.

---

## 7. Build phases — work in this order, one phase per session

1. **0a — Design tokens.** Tailwind theme / CSS variables from §2. Every
   later phase consumes these; nothing redefines colors inline.
2. **0b — AppShell.** One shared layout component with two render paths
   (desktop sidebar+topbar, mobile bottom nav), driven by viewport + role.
   Every page after this sits inside it.
3. **1 — Command Center dashboard.** Stat cards, today's schedule, lead
   status donut, follow-ups due, recent activity. Pure UI — reads only
   from `leads` and `follow_ups`, no new schema.
4. **2 — Leads list.** Desktop table + mobile card list sharing one
   filter/search hook. Gives Lead Detail real navigation to test against.
5. **3 — Retrofit Lead Detail per §5.** The actual current priority.
6. **4 — Follow-ups.** Desktop workspace (full filtering, assignment,
   overdue/today/upcoming) + mobile Today's tasks — one data layer, two
   thin UI layers.
7. **5 — Site Visits & Quotations as UI-level views** over
   `site_visit_date` / `quotation_amount` — not new tables (see §8/§9).
8. **6 — Reports** (desktop only), computed from existing tables — no
   invented data, no new table required initially.
9. **7 — Deals workspace**, confirmed as its own desktop nav destination
   by the latest master planning brief (§8) — a UI-level view over
   Negotiation/Quotation-stage leads' commercial fields, not a new table.
10. **8 — Admin/Settings, Automation, Audit Log** — desktop + admin-only,
    already scoped as out of mobile nav.

Don't ask Claude Code to build the whole system in one prompt — hand it one
phase, let it finish + verify (§17/§18), then move to the next. Large
single-shot asks are exactly what causes drift and skipped QA.

---

## 8. Deals

No real `deals` entity exists. "Deal" info currently lives on `leads`
(`job_value`, `quotation_amount`, `status`). Do not use "Deal Details" as a
dumping ground for unrelated fields. If a dedicated Deal workspace is
needed later, decide explicitly whether it's a UI-level view over leads or
a real new entity — don't default to a new table.

> **Confirmed by the Aug 2026 master planning brief:** Deals *is* meant to
> be its own desktop nav destination (that brief's Navigation Philosophy
> section lists Dashboard, Leads, Deals, Quotations, Site Visits,
> Follow-ups, Conversations, Reports, Automation, Audit Log, Admin as the
> full desktop nav). Build it as Phase 7 (§7/§25): a UI-level view/list of
> leads at Negotiation/Quotation stage, surfacing their commercial fields —
> still no new table without explicit approval.

## 9. Quotation

Only `leads.quotation_amount` exists today. A real quotation module would
eventually need quotation number, customer, line items, qty/pricing,
discount, tax, total, validity, terms, status, generated document — but
none of that is approved yet. Build the UI-level view first.

## 10. Site Visits

Only `leads.site_visit_date` and generic `follow_ups` with
`type = site_visit` exist. A real site-visit system would eventually need
date/time, assigned staff, address, status, notes, photos,
arrival/completion state — not approved yet.

## 11. Follow-ups

`follow_ups` is real and has `assigned_to_id`, `due_date`, `due_time`,
`type`, `status`, `completed_at`. Operationally important on mobile.
Desktop gets the full workspace; mobile gets today/overdue/quick-complete/
quick-create with lead context.

## 12. Automation

Client-side workspace, admin-oriented. Desktop only, admin only. Do not
redesign into a mobile workflow unless explicitly requested.

## 13. Audit Log

Admin only, desktop oriented, not in mobile nav. Per-lead Activity can
exist (it already does) without exposing the full Audit Log workspace to
staff/mobile.

**Target event taxonomy (reconciled from AGENTS.md, 2026-08-30):** login,
failed login, logout, lead created/viewed/updated/assigned/reassigned/
deleted, phone number viewed, conversation viewed, message sent, follow-up
created/completed, export attempted/completed, user created, role/
permission changed. Confirmed already implemented in code today:
`lead_updated`, `message_sent`, `conversation_viewed`, `lead_viewed`
(`lib/audit-logs.ts`, `lib/actions/leads.ts`, `lib/conversations.ts`) —
the rest (auth events, export events, user/role management events) are
aspirational, not yet wired, since the features they'd attach to (login
audit, export, user management) don't exist yet either. Never log message
contents (§16) — `message_sent` audit metadata already excludes body text,
keep it that way.

## 14. Reports

No `/reports` route exists yet. Dashboard covers KPI/pipeline overview.
Future Reports is desktop-focused, reads existing tables (sales
performance, conversion, pipeline distribution, won/lost, staff
performance, follow-up performance, quotation performance) — no invented
data, no required new table.

## 15. Admin/Settings

User/profile/role management is still handled directly through Supabase —
no admin UI for that exists.

> **Update (2026-08-30):** a first Settings section now exists —
> `/settings` (index) and `/settings/whatsapp-numbers` — built as a pure
> UI/UX prototype (see §32). It is **uncommitted** and holds its data in
> local component state only; nothing persists across a reload and nothing
> is wired to Meta. Don't treat it as a working feature yet, but don't
> re-build it from scratch either — see §32 before touching it.

---

## 16. Authorization / RLS — verified, do not weaken

```
leads SELECT: private.is_admin() OR assigned_to_id = auth.uid()
leads INSERT: admin or self
leads UPDATE: admin or owner
```

Staff see only their own assigned leads. Admin sees all. Other tables have
appropriate admin/owner restrictions already verified. **Never replace
database security with UI-only hiding**, and never weaken or bypass RLS to
make a UI problem easier to solve.

**Permission specifics (reconciled from AGENTS.md, 2026-08-30):** Staff
must never be able to — reassign leads, bulk-export leads, manage
users/roles, change security settings, or view audit logs, including via
direct API/URL access, not just hidden UI. Admin-only: manage staff,
manage system settings, manage WhatsApp configuration, bulk export. Bulk
export doesn't exist as a feature yet, but when it's built it must be
Admin-only and server-enforced, same as everything else in this section.

Treat as sensitive (don't put in logs, error messages, or diagnostics):
phone numbers, emails, customer names, addresses, lead notes, conversation
contents, WhatsApp identifiers, call info. Never log passwords, API keys,
access tokens, webhook secrets, service-role keys, or full auth
cookies/headers.

---

## 17. Viewport & Playwright requirements

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

---

## 18. Quality gates — before considering a phase complete

```
npm run lint
npx tsc --noEmit
npm run build
```

Then Playwright verification per §17. Do not deploy automatically. Do not
push automatically unless explicitly instructed.

---

## 19. Next Action

Surface the next operational action prominently when one exists (call
customer, schedule site visit, send quotation, follow up on quotation,
negotiate, close lead). If there's no real next action, don't invent a
fake task just to fill the slot.

**Calling scope (reconciled from AGENTS.md, 2026-08-30):** "Call" today
means a plain `tel:` link — nothing more. Don't claim or imply the CRM can
access call audio, transcripts, duration, or keywords unless a call is
actually routed through a supported telephony provider, which it isn't. A
future pipeline (CRM → telephony provider → recording/transcription → AI
extraction → CRM) is plausible scope one day but needs explicit approval
before any of it is built — don't design toward it speculatively.

## 20. Qualification Score vs Pipeline Stage — do not conflate

Pipeline stage = where the lead is in the sales process (§4).
Qualification score = how strong/qualified the lead is, computed
deterministically from real fields (no AI/external calls, no fabricated
inputs). These are different concepts with different owners on the page —
never merge them into one number or one card.

---

## 21. General rule before changing code

1. Inspect the current implementation.
2. Inspect the live database if the decision depends on schema.
3. Understand existing RLS/auth.
4. Preserve working business logic.
5. Change only what's necessary.
6. Avoid duplicate fields/actions (one section = one owner, see §5).
7. Avoid creating new schema without explicit approval (§3, §8–10).
8. Verify with Playwright (§17).
9. Run lint/typecheck/build (§18).
10. Report exactly what changed and what was verified — update §0.

**Tiebreaker when priorities conflict (reconciled from AGENTS.md,
2026-08-30):** security > data integrity > correctness > reliability >
maintainability > performance > UI convenience. Never sacrifice security
or data integrity for a faster or prettier implementation.

---

## 22. Current priority

> **Updated 2026-08-30 — superseded.** Phase 3 is done: retrofitted,
> live-verified, and committed (`c6834a9`), alongside 0a/0b/1/2. Phase 4a
> (Meta account setup) is verified satisfied, and most of what §25/§26
> call "Phase 4b" already exists in the codebase (webhook, outbound
> sender, three-column Conversations UI) — see §32 for the reconciled,
> current breakdown of what's actually left. **Current priority is the
> remaining Phase 4b scope in §32**, not a fresh Phase 3.

~~Phase 3 (§5, §7): retrofit Lead Detail with real per-stage section
visibility. This is the one rule in this document that governed the last
restructuring pass but wasn't actually implemented yet. Fix this before
starting Command Center / Leads list / any new module — the same
STAGE_SECTIONS pattern will make every future module simpler to reason
about too.~~ *(kept for history — see the update note above)*

---

## 23. Reference assets already produced — adapt, don't re-derive

`whatsapp-conversations-view.jsx` — a working, faithful WhatsApp-UI clone
(conversation list + thread, real read-receipt ticks, search, mobile
list↔thread collapse with back button). Currently uses seed/mock data, not
wired to the real database.

When building the Conversations phase: adapt this file into
`components/conversations/ConversationsView.tsx`. Replace
`seedConversations()` with a real query against `conversations` +
`messages` keyed by `lead_id`, and wire the hardcoded unread count to real
unread-message state. **The visual design in this file is already
approved — don't redesign it from scratch, only swap the data layer** and
add a small link back to that lead's Lead Detail page in the thread
header.

> **Gap to close, per the Aug 2026 master planning brief (§13 there):**
> desktop Conversations needs a third panel — customer/lead context
> alongside the list and the thread, not just a link back to Lead Detail.
> The current file is a faithful 2-pane WhatsApp clone (list + thread)
> intentionally, since matching WhatsApp exactly was the ask at the time.
> Add the context panel as a desktop-only enhancement in Phase 4b (hidden
> on mobile, where the existing back-button pattern already covers it) —
> don't rebuild the 2-pane layout, extend it.

---

## 24. Open — sidebar modules with no spec yet

The reference dashboard mockup's sidebar lists modules this document has
no real spec for. Do not start a build phase for any of these until it has
**both** a real screen mockup/written spec and an answer to its open
question below — building against a sidebar label alone risks inventing
schema or UX that gets thrown away later (see §3, §21).

> **Partially resolved by the Aug 2026 master planning brief:** that
> document's own Navigation Philosophy section lists the full intended
> desktop nav as Dashboard, Leads, Deals, Quotations, Site Visits,
> Follow-ups, Conversations, Reports, Automation, Audit Log, Admin — and
> does **not** mention Customers, Services, Team, Mission Control, or
> Documents anywhere. Treat those five as **unconfirmed/deprioritized**,
> not merely "pending a spec" — they may not be part of the actual plan at
> all. Don't build toward them without asking again first. Deals is now
> resolved (§8) and out of this table.

| Module | What's unclear | Needed before building |
|---|---|---|
| Customers | Not mentioned in the latest nav plan at all. | Confirm whether this is still wanted, or dropped in favor of "Won leads" living inside Leads/Deals. |
| Services | Looks like a catalog of service types (plastering, false ceiling, kitchen). Not mentioned in the latest nav plan. | Confirm whether this is still wanted; if so, what fields it needs and which screens reference it. |
| Team | `profiles` already exists. Not mentioned in the latest nav plan. | Confirm whether this is still wanted, or deprioritized. |
| Mission Control | Not mentioned in the latest nav plan at all — unclear if this was ever distinct from Command Center/Dashboard. | Confirm whether this still exists as a concept. |
| Documents | Not mentioned in the latest nav plan. | Confirm whether this is still wanted; if so, what's stored where. |
| Reports | Scoped generally in §14, no mockup yet, but confirmed as a real nav item. | Paste the Reports screen mockup/spec if one exists. |
| Settings | Confirmed as a real nav item. A first section (WhatsApp Numbers) now exists as a UI prototype — see §15/§32 — but nothing beyond that is designed, and the rest of Admin/Settings (user/role management etc.) still has no spec. | Paste a mockup/spec for whatever comes after WhatsApp Numbers, and confirm what else belongs under Settings. |

**What to bring back from ChatGPT (or wherever the spec lives):**
1. Confirmation on whether Customers/Services/Team/Mission
   Control/Documents are still wanted at all, given the latest brief
   omits them entirely.
2. Screen mockups/written specs for Reports and Settings — both are
   confirmed nav items now, just not designed yet.
3. Confirm whether Quotation and Site Visit are still meant to stay
   UI-level views (§9, §10) now that they're getting dedicated sidebar
   modules, or whether the scope has grown enough to warrant real schema —
   if so, that needs explicit approval before Claude Code builds it (§3).

Once any of these arrives, it gets folded into this document as a new
numbered section (like §5 for Lead Detail) before a build phase is written
for it.

---

## 25. Copy-paste prompts for Claude Code — one per phase

Run these in order, one per Claude Code session, in this repo. Each one
assumes Claude Code will read this file first — say so explicitly if your
Claude Code setup doesn't auto-load CLAUDE.md.

**Phase 0a — Design tokens**
> Read CLAUDE.md in full. This session's task is Phase 0a only: build the
> design token system from §2 as a Tailwind theme extension plus any CSS
> variables needed for the glass effect and gradients. Don't touch any
> existing page or component yet. When done, show me the token file, run
> lint/typecheck/build, and append a Session Log entry to §0.

**Phase 0b — AppShell**
> Read CLAUDE.md. Task: Phase 0b only — build the shared AppShell
> (desktop sidebar+topbar, mobile bottom nav) from §1 and §7, consuming
> the tokens from Phase 0a rather than redefining colors. Make it read
> the current user's role so Automation and Audit Log never render for
> staff or on mobile (§1, §13). Wrap an empty content area — no page
> content yet. Verify per §17/§18 and update the Session Log.

**Phase 1 — Command Center dashboard**
> Read CLAUDE.md. Task: Phase 1 only — build the Command Center
> dashboard from §7 inside the Phase 0b AppShell: stat cards, today's
> schedule, lead status donut, follow-ups due today, recent activity.
> Pull real data from `leads` and `follow_ups` only — no new tables (§3).
> Match the reference screenshot's layout and the §2 visual language.
> Verify per §17/§18, update the Session Log.

**Phase 2 — Leads list**
> Read CLAUDE.md. Task: Phase 2 only — build the Leads list: desktop
> table + mobile card list sharing one filter/search hook, inside the
> AppShell. Respect RLS (§16) — staff must only ever see their assigned
> leads through this list. Link each row to the existing Lead Detail
> page. Verify per §17/§18, update the Session Log.

**Phase 3 — Stage-aware Lead Detail retrofit (current priority, §22)**
> Read CLAUDE.md, especially §5. Task: Phase 3 only — the one still-open
> architecture gap. Build the STAGE_SECTIONS config and gate every
> section/action in Lead Detail by the lead's current stage, so New,
> Won, and Lost each render visibly different sections — not the same 7
> sections every time. Do not touch the Won/Lost safety logic in §6, only
> what renders around it. Verify per §17/§18 across both roles and all
> three viewports, update the Session Log.

**Phase 4a — Meta WhatsApp account setup (not a code task)**
> No Claude Code work here. Before live chat can be built, complete the
> account-level steps in §26: Meta Business verification, WhatsApp
> Business Account + number setup, and a permanent access token. Bring
> the access token and phone number ID back as environment variables —
> never pasted into chat or committed to code.

**Phase 4b — Live WhatsApp integration**
> Read CLAUDE.md §23 and §26. Task: build the webhook endpoint that
> receives inbound WhatsApp messages from Meta and writes them into
> `conversations`/`messages`; capture the `referral`/`ctwa_clid` data on
> new conversations per §26 (confirm first whether lead-level
> campaign/ad attribution is already wired from the same referral data,
> per §3, before duplicating that logic); wire outbound sending through
> Meta's API when staff reply; and enable Supabase Realtime on
> `messages` so ConversationsView updates live without a refresh. Then
> adapt whatsapp-conversations-view.jsx into
> components/conversations/ConversationsView.tsx on top of this real
> data, replacing the seed data and hardcoded unread count. Keep the
> visual design as-is. Verify per §17/§18, update the Session Log.

**Phase 5 — Follow-ups**
> Read CLAUDE.md §7, §11. Task: build Follow-ups — desktop full
> workspace (filtering, assignment, overdue/today/upcoming) and mobile
> Today's tasks, both reading the same `follow_ups` table. Verify per
> §17/§18, update the Session Log.

**Phase 6 — Site Visits & Quotations as views**
> Read CLAUDE.md §9, §10. Task: build Site Visits and Quotations as
> UI-level views over existing lead fields (site_visit_date,
> quotation_amount) — do not create new tables without explicit
> approval. Verify per §17/§18, update the Session Log.

**Phase 7 — Deals workspace**
> Read CLAUDE.md §8. Task: build a Deals nav destination as a UI-level
> view/list over leads currently at Negotiation or Quotation stage,
> surfacing job_value/quotation_amount/status — no new table without
> explicit approval. Verify per §17/§18, update the Session Log.

**Do not start a Phase 8+ prompt for Customers, Services, Team, Mission
Control, or Documents yet** — see §24, they may not even be part of the
actual plan. Reports and Settings are confirmed nav items but still need a
mockup/spec before a phase prompt is written for them. Bring back specs
first; each will get turned into a numbered section and a phase prompt the
same way Phase 3 was.

---

## 26. Live WhatsApp integration (Meta Cloud API) — the real Phase 4

"Live chat" means real inbound/outbound sync with Meta's WhatsApp Business
Platform (Cloud API), not just wiring the UI to rows that already exist.
Confirm with the project owner whether the `conversations`/`messages`
tables currently receive any real WhatsApp data at all before assuming
this is a small task — if nothing feeds them yet, this is the full build
below, not a data-wiring exercise.

This splits into account-level setup (must be done by an authorized person
on the Meta Business account — Claude Code cannot do this) and code
(Claude Code builds once credentials exist as env vars). See Phase 4a/4b
in §25.

### Message flow
1. Customer messages the WhatsApp Business number (directly, or via a
   Click-to-WhatsApp ad).
2. Meta POSTs that message to a webhook URL this project exposes (a
   Next.js API route or Supabase Edge Function), verified via the
   webhook verify token set up in Meta's dashboard.
3. That webhook writes the message into `messages`, matched to the right
   `conversations` row by phone number (create the conversation row if
   this phone number is new).
4. Supabase Realtime pushes the new row to anyone with ConversationsView
   open — this is what makes it live instead of requiring a refresh.
5. When staff reply from the CRM, the same backend calls Meta's Cloud
   API to actually send the WhatsApp message, then logs that outbound
   message too.

### Conversion attribution — the ctwa_clid mechanism
When a customer messages via a Click-to-WhatsApp ad, the first webhook
message includes a `referral` object: ad ID, headline, and a `ctwa_clid`
— a click ID tying that conversation to the exact ad/ad set/campaign that
produced it. Capture this when the conversation is created and store it
against the conversation (and/or lead). This is the mechanism that
connects ad spend to a specific WhatsApp thread at the message level.
Leads already carry `campaign_name`/`adset_name`/`ad_name` (§3) — check
whether those are already populated from this same referral data at
lead-creation time before re-deriving it at the conversation level.

Optionally, later: once a lead becomes a paying customer, send that event
to Meta via the Conversions API (CAPI), so Meta's own Ads Manager can
report real conversions too — not just this CRM. Keeps both systems
telling the same story instead of only the CRM knowing the truth.

### Policy constraint to design around
Meta only allows free-form replies within 24 hours of the customer's last
message. Outside that window, only pre-approved message templates can be
sent. Any "re-engage a cold lead" feature needs templates submitted for
Meta's approval in advance — plan this as its own small piece of work, not
an afterthought bolted onto Phase 4b.

---

## 27. Development workflow — strict, permanent (added 2026-08-30)

This supersedes the looser phrasing in §7/§21 ("work one phase at a time") with
an explicit, non-optional loop:

```
ONE PHASE → IMPLEMENT → FULL TEST → REPORT → /clear → NEXT PHASE
```

- Never start the next phase in the same session after finishing one.
- After implementation: run the required quality gates (§18), run the
  full relevant Playwright verification for that phase (§17), report the
  exact results, then **stop** and wait for `/clear`.
- Do not continue automatically into further work, and do not ask whether
  to continue — stop and wait.
- This applies even when the next phase seems obvious or small.

## 28. UI-first rule (added 2026-08-30)

For every product phase, in this order:

```
UI / UX DESIGN FIRST → approve/verify UI direction → implementation →
backend/data work only when required
```

- Do not start a phase with backend/database work when the requirement is
  fundamentally a UI/product workflow question.
- Do not create backend structures speculatively "for later" — see §3.
- If backend persistence genuinely is required to finish a phase, stop and
  report the dependency explicitly rather than building it silently (this
  is what happened with the WhatsApp Numbers UI, §15/§32 — it stayed a
  local-state prototype and the missing table was reported, not created).

## 29. Token / session efficiency (added 2026-08-30)

Claude Code sessions on this project have been hitting daily/session usage
limits. Every session should:

- Inspect existing work before rewriting it; reuse correct existing
  implementation instead of re-deriving it.
- Avoid repeated full-file reads and unnecessary test re-runs — targeted
  verification is fine once something is already conclusively verified.
- Not refactor unrelated code, not touch unrelated backlog, not implement
  future phases early, not build speculative functionality.
- Make the smallest safe change the current phase actually requires.
- Still satisfy the full-test rule (§17/§18) for whatever *is* completed
  this session — efficiency is about scope, not about skipping
  verification of what was built.

## 30. Current WhatsApp production architecture (added 2026-08-30)

This is the current, intended production direction — not a proposal:

```
Meta Ads
  ↓
Central WhatsApp API number
  ↓
AFIT CRM inbox
  ↓
Auto assignment / manual assignment
  ↓
Staff
  ↓
CRM live chat
  ↓
Same central API number
  ↓
Customer
```

One shared WhatsApp Business number, owned by the business, is the only
channel customers message and the only channel staff reply through — staff
never message from their own personal WhatsApp number in this flow. This
matches what's already built (§26): inbound webhook → `conversations`/
`messages` → staff reply in the CRM → outbound send via the same number's
Cloud API credentials.

One relevant fact not previously written down anywhere in this file:
`conversations` already has a `phone_number_id` column, and both the
webhook (matching) and outbound sender (`lib/whatsapp/send-message.ts`,
which takes `phoneNumberId` as a parameter rather than reading a single
hardcoded value) are already keyed per-conversation rather than assuming
one global number. That wasn't a deliberate multi-number feature — it's
just how the ingestion match key was built — but it means the foundation
for §31 already exists at the code level, even though nothing in the UI
surfaces number identity yet and only one number's credentials
(`WHATSAPP_ACCESS_TOKEN`) currently exist as env vars.

## 31. Future WhatsApp Coexistence — not implemented now (added 2026-08-30)

Meta supports "Coexistence": a staff member's existing personal WhatsApp
Business App number can be linked so it works alongside a central API
number, both reachable through Meta's infrastructure. This project **may**
support that later:

```
Staff's existing WhatsApp Business App number
  ↕
Meta-supported Coexistence
  ↕
CRM
```

**Do not implement this now.** No Coexistence API calls, no speculative
per-staff-number schema, no unsupported Meta functionality. The only
requirement right now is that the current architecture (§30) doesn't
*foreclose* this later — don't design anything that hard-codes "there is
exactly one WhatsApp number, ever" as a structural assumption throughout
the conversation code.

Concretely, this means keeping these concepts distinguishable rather than
collapsed into one, both in code and in how new work is discussed:

- **WhatsApp Business account** — the Meta-level account.
- **WhatsApp number / `phone_number_id`** — a specific connected number;
  already a real per-conversation column (§30).
- **Conversation** — a `conversations` row; already tied to a
  `phone_number_id`, not just a lead.
- **Customer / contact** — the person on the other end of a conversation.
  There is currently **no separate `customers` table** — the contact's
  identity today lives implicitly on `conversations.wa_id` plus whatever
  name Meta's webhook payload supplied, cross-referenced to `leads` by
  exact phone match (see `app/api/webhooks/whatsapp/route.ts`). This
  section is a conceptual/target model for how to *think about* the
  architecture, not an instruction to create a `customers` table — that
  still needs the same explicit approval as any new table (§3). Note this
  is a different question from the "Customers" *nav module* in §24, which
  is about a sidebar destination and remains unconfirmed/deprioritized.
- **Lead** — the sales-pipeline entity, real and central (§3–§6).
- **Assigned staff** — who owns the lead (`leads.assigned_to_id`).
- **Channel/source** — currently implicitly always "WhatsApp"; there is no
  `channel` column anywhere observed in `conversations`. Not a problem to
  fix now — just something to keep in mind before ever assuming
  WhatsApp is the only channel this schema could describe.

The important distinction for Coexistence specifically: **which staff
member is assigned to a lead is not the same fact as which WhatsApp number
a conversation runs through.** Today those two things happen to be
implicitly entangled only through the central-number architecture (§30) —
every conversation uses the same number regardless of who's assigned.
Don't write new conversation code that makes "assigned staff" and
"the number in use" the same variable, even though today there's only ever
one number, so a future per-staff number doesn't require re-deriving the
whole conversation model.

## 32. Phase 4a/4b — reconciled current status (added 2026-08-30)

§25/§26 describe Phase 4a (manual Meta setup) and Phase 4b (the full
webhook+send+Realtime+UI build) as originally planned. That plan is now
out of date relative to what actually exists in the codebase — this
section is the current source of truth; §25/§26 are kept for history.

**Phase 4a — satisfied.** The required env vars
(`WHATSAPP_VERIFY_TOKEN`/`WHATSAPP_APP_SECRET`/`WHATSAPP_ACCESS_TOKEN`)
already exist and were confirmed live-verifiable (2026-08-30 session, §0).

**Already built and already committed** (from sessions before this
document was reconciled, under an unrelated "Phase B3/B5" naming scheme
that was never written into this file):
- Inbound webhook (`app/api/webhooks/whatsapp/route.ts`): Meta handshake,
  HMAC signature verification, message parsing, conversation find-or-
  create, message persistence with dedup, status updates, CTWA
  `referral`→`lead.ad_id` capture.
- Outbound sender (`lib/whatsapp/send-message.ts`): Cloud API text send,
  24-hour-window error handling.
- Conversations UI at `/conversations`: three-column desktop workspace
  (list + thread + lead-details panel — the "gap to close" §23 flagged is
  already closed), mobile full-screen list↔thread↔bottom-sheet. RLS-scoped
  correctly (admin sees all, staff only their assigned leads' threads,
  unlinked conversations admin-only, enforced server-side not just hidden).
- An orphaned-looking `/chat` route exists in parallel to `/conversations`
  — not dead code, `lib/actions/messages.ts` revalidates both on every
  send. Needs a scoping decision (keep both intentionally, or retire one)
  at some point — not blocking anything.

**Still genuinely open (the real remaining Phase 4b scope):**
1. **Supabase Realtime** on `messages`/`conversations` — confirmed zero
   `realtime`/`channel` usage anywhere in the codebase. New messages
   require a manual refresh. This is the single largest remaining piece.
2. **Multi-number/channel-ready conversation architecture** per §30/§31 —
   not urgent, not blocking, but the next time conversation code is
   touched, keep the distinctions in §31 in mind rather than deepening any
   single-number assumption.
3. **Outbound send, verified against the real Meta API** — never actually
   exercised (only structurally verified by code review) in any session on
   record. When explicitly authorized, test with the controlled number
   `8075287437` rather than a real customer's number.
4. Style/consistency cleanup: `/conversations` components still use raw
   Tailwind `slate-*` colors rather than the §2 design tokens (cosmetic,
   not urgent).

**Do not** fold Realtime, Coexistence, or the WhatsApp Numbers UI's
backend persistence into a Phase 4a re-verification, and do not treat any
of items 1–4 above as already done just because most of the surrounding
system is. Each is its own scoped piece of work under §27's one-phase
discipline.

### WABIS (reconciled from AGENTS.md, 2026-08-30)

`WEBHOOK_DISCOVERY_MODE` in `app/api/webhooks/whatsapp/route.ts` (payload-
shape logging, engaged only when that env var is explicitly set, never
logs values/headers, always returns 200) exists for a temporary,
separate WhatsApp integration called **WABIS**. AGENTS.md is the only
place this was previously documented at all. Treat as still true here:
WABIS is temporary — do not design the core CRM conversation model around
it, do not assume its webhook functionality exists, do not invent or
guess its payload format. If WABIS integration work happens, it must stay
isolated behind a clear boundary, and the CRM must keep working after
WABIS is eventually removed. This is unrelated to the central-number
architecture in §30 — don't conflate the two.

### Phase B3 — WhatsApp media download (already complete, reconciled from
AGENTS.md, 2026-08-30)

Also already built and committed, under the same pre-existing "Phase B"
naming scheme as the webhook/sender work above: **on-demand Meta media
download to private Supabase Storage** — commits `54a8c11`, `3c0f004`.
Verified end-to-end against a real Meta-delivered inbound image (not a
simulated payload) via Meta's TEST WhatsApp Business Account (test WABA
`1093817206430417`, test phone number ID `1259504780587760` — test-scoped
identifiers, not production). Confirmed working: media metadata lookup,
download via the test-scoped access token, MIME type + file size
validation, SHA-256 integrity verification, upload to the private
`whatsapp-media` Supabase Storage bucket, `media_storage_path` written to
the message record, signed URL retrieval, and reuse of already-downloaded
media without a repeat Meta download. The production WABA was never
accessed during this work. Treat this as done — verify it still works
before rebuilding any part of it, don't re-implement it from scratch.

## 33. AGENTS.md — status and relationship to this document (added 2026-08-30)

A second instruction file, `AGENTS.md`, exists at the repo root — it
predates this reconciliation and is **not** part of Claude Code's
automatic context in this project (confirmed: it doesn't load
automatically the way this file does). It overlapped, and in one place
outright conflicted with, the rules here.

**This file (CLAUDE.md) is the single authoritative source for current
rules and status.** Where the two ever disagree, this file wins — in
particular: **no automatic commits, ever**, regardless of what AGENTS.md
said before this reconciliation (§18, §27).

AGENTS.md is kept, not deleted, because: (a) "AGENTS.md" is the native
convention some other AI coding tools default to reading, and this repo
may still be touched by one; (b) Next.js 16's own dev-server tooling
auto-appends a generated instructions block to it (left completely
untouched — don't fight or rewrite tooling-generated content); (c) it
held real historical/technical detail worth keeping as a record rather
than deleting.

That genuinely useful detail has been folded into this file already:
security/permission specifics → §16; audit event taxonomy → §13; calling
scope → §19; architecture priority tiebreaker → §21; WABIS and the Phase
B3 media-download record → §32 above. AGENTS.md itself was corrected in
two places during this reconciliation: its git-checkpoint section no
longer says to auto-commit after a phase, and its "current immediate
priority" (a since-resolved security checklist) is now marked resolved
and points here instead of reading like an open emergency.

## 34. Phase 4b.1 — live conversation update UX (decided, added 2026-08-30)

Design-only phase, completed before any Realtime code. Extends §32's Phase
4b scope with the UI/UX contract that §32's Realtime work (4b.2/4b.3) must
follow. These are implementation contracts, not new architecture — they
don't restate §17 (viewports/a11y basics), §30 (central-number
architecture), or §31 (multi-number concepts); read those alongside this.

**Visual language:** reuse the existing WhatsApp-style bubbles/list/tokens
exactly — no new colors, components, or layout. `/conversations` and
`/chat` get identical live-update behavior through one shared mechanism.

**Conversation list:** re-sorts to most-recent on any new message,
whether or not that conversation is open. A non-open conversation that
receives a message gets a transient accent-dot cue, cleared the instant
it's opened. That cue is client-memory only — no persisted unread state,
no numeric count, no `localStorage`/`sessionStorage`.

**Open thread:** new messages append live. Auto-scroll only when the
viewer is already at/near the bottom — never yank their scroll position
while they're reading older messages. Sending your own message may always
scroll to bottom. A "New message ↓" affordance for the scrolled-up case is
optional for v1, may be cut without violating this spec.

**Connection state:** connected / reconnecting / disconnected — indicator
near the list header (never the thread header), same behavior on desktop
and mobile. Silent (no visible chrome) when connected; reconnecting/
disconnected use the existing `success`/`warning`/`danger` tokens. No
large persistent status panel.

**Accessibility:** incoming thread messages in an `aria-live="polite"`
region; never steal focus on arrival; connection state has a real
accessible label, never color alone; respect `prefers-reduced-motion`.

**Multi-number/channel readiness:** no UI may assume or display one
WhatsApp number — never show or hardcode `phone_number_id`; all copy
stays channel-agnostic; no number/channel selector or badge in this
phase.

**Shared architecture contract for 4b.2/4b.3:** one Realtime subscription
mechanism serves both `/conversations` and `/chat` — never two parallel
implementations. Subscriptions must be conversation-scoped and RLS-safe:
a staff client must never receive an event for a conversation it can't
access. De-duplicate by stable identifier (`messages.id` /
`wa_message_id`) only, never by content/timestamp heuristics.

**Explicitly deferred, not part of 4b.2/4b.3:** a persisted per-staff
unread system, numeric unread counts, a last-message-preview snippet in
list rows, any number/channel indicator UI, `/chat` vs `/conversations`
consolidation, the `/conversations` styling/token migration, live
assignment-change propagation, Coexistence, and any staff-personal-
WhatsApp-Business-App integration.
