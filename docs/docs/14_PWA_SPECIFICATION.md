# 14 — PWA Specification

Azhar and future field staff live on the mobile app day to day. It must install like a real app and survive patchy connectivity on site.

## Requirements

- Correct CRM-specific manifest (name, icons, theme color matching the dark-green brand) — do not reuse any manifest from an unrelated existing app in the repository.
- Installable on Android and desktop Chrome/Edge; iOS Add-to-Home-Screen supported as a baseline (iOS PWA limitations accepted, not worked around with native wrappers in v1).
- App icons and splash/theme colors per the brand (dark green `#16A34A` primary, matching the published design canvas).
- Service worker caches app shell/static assets only by default — **never** indiscriminately caches private customer/financial API responses. Caching a specific, explicitly-reviewed read (e.g. "today's lead list" for offline viewing) is a deliberate, documented exception, not a default behavior.
- Offline mode clearly indicates what is unavailable rather than silently failing or showing stale data as if it were live.
- Only explicitly supported offline drafts are queued (e.g. a daily site report or a call-outcome note started without signal) — sync with idempotency and visible conflict handling, never a silent overwrite.
- Logout clears user-specific local cached data.
- Update prompt when a new version is available — never silently strand a user on a broken old schema against a migrated backend.

## Test checklist

- Install flow on Android and desktop.
- Update flow (new version deployed while app is open).
- Offline launch — app shell loads, shows a clear "you're offline" state for data it can't fetch.
- Session expiry and reconnect behavior — no crash, no silent data loss.
- The compulsory Call Outcome sheet (`docs/09`) behaves correctly offline: it queues the outcome locally if there's no signal right after a call (common on a job site) and syncs once reconnected, still blocking the lead from showing "handled" until the queued outcome actually lands server-side.
