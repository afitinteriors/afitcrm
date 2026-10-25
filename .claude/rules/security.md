# Security

Non-negotiable. Expands CLAUDE.md's Auth/RLS/Security section — CLAUDE.md
wins on conflict. Never:

- Weaken or bypass an RLS policy to make a UI or workflow problem easier
  to solve.
- Rely on UI-only hiding in place of a real server-side authorization
  check.
- Expose a secret (API key, access token, webhook secret, service-role
  key) in code, logs, error messages, or a report.
- Introduce an unsigned/unverified production webhook endpoint.
- Log sensitive payloads (message contents, phone numbers, customer PII)
  unnecessarily — see CLAUDE.md's sensitive-data list.
- Bypass server-side validation because a client-side check already
  covers the common case.

Any of the above requires stopping and asking, not proceeding and noting
it in a report afterward.
