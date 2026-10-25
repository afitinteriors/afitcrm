# 10 — WhatsApp / Meta Integration

Target end state: `Meta Ad → Customer WhatsApp message → direct WhatsApp Cloud API webhook → CRM` — no third-party WABA reseller in the critical path for new leads. Today's interim state uses a reseller ("WABIS"); migration is a deliberate phase, not a day-one requirement.

## Owner's setup steps (non-technical, must happen before this can go live)

1. **Meta Business verification** (company documents).
2. **WhatsApp Business Account + phone number on Cloud API.** If migrating an existing number from a reseller, coordinate the migration window with that reseller — expect a short window where messaging may be interrupted. Do this deliberately, not silently mid-build.
3. **Message templates submitted for Meta approval**: lead-acknowledgement, call-missed holding message, quotation-sent follow-up (1/3/7 day), site-visit reminder, invite link. Each needs approval before it can be sent outside the free messaging window.
4. **Meta app + permanent system-user access token**, generated with the owner's involvement; the coding agent helps wire it into environment variables but the token itself is never pasted into chat/prompts.

## The technical flow

```
Meta Ad (Click-to-WhatsApp or Lead Form)
  → customer sends/opens WhatsApp message
  → Meta delivers a webhook to our Cloud API endpoint
  → webhook receiver verifies X-Hub-Signature-256, then:
      - normalizes phone number
      - finds-or-creates customer
      - captures `referral` object (ctwa_clid, source_id, headline) IF this is the first inbound message from this number — Meta only sends it once
      - creates/links a deal (service TBD at this point)
      - stores the message in message_events
      - triggers Workflow A (Lead Intake, docs/12)
  → AI agent or staff responds (docs/11)
  → outbound sends check window state before choosing template vs free-form
  → on Won/payment, a Conversions API (CAPI) event is sent back to Meta using the stored ctwa_clid, closing the attribution loop
```

## Ad attribution — why this matters and how not to lose it

- The `referral` object (`ctwa_clid`, `source_id`, ad headline) arrives **only on the customer's first message** in a new conversation. If the webhook receiver doesn't persist it immediately into `ad_referrals` on that very first event, the ability to attribute the eventual sale back to the ad is lost permanently for that lead.
- Without sending a Conversions API event back to Meta on conversion (visit booked / deal won), Meta's own ad optimization never learns which leads were good — ad performance degrades over time. CAPI wiring is not optional polish; it is part of why the ads work at all.

## Message windows (do not get this wrong — it blocks real sends)

- **24-hour customer service window**: opens on an inbound customer message; while open, free-form replies are allowed.
- **72-hour CTWA free window**: opens specifically when a conversation starts from a Click-to-WhatsApp ad; messages (template or free-form) inside it are not billed by Meta, separate from the 24h window's free-form permission.
- Outside both windows, only an **approved template** message can be sent. The CRM must track window state per conversation (`message_conversations.window state` in `docs/06`) and automatically choose template vs. free-form — never attempt and fail a free-form send outside the window, and never silently drop a message that should have gone as a template.

## Service (keyword) detection — see `docs/11_AI_SALES_AGENT.md` §Service detection for the full resolution order and keyword table. Summary: ad tapped → ad headline/pre-filled text → keyword match → AI semantic match → ask, only as a last resort.

## Lead Form ads

Meta Lead Ads form submissions (no WhatsApp involved) create leads the same way via a separate webhook, tagged `source = "lead form"`, for customers who fill a form instead of messaging.

## Opt-out and compliance

- "STOP" (or equivalent) from a customer sets `contact_preferences.opt_out`, suppressing all marketing/follow-up sends across every channel for that customer immediately.
- Before any outbound send: verify consent, channel availability, template/provider requirements, opt-out status, business hours, and duplicate-send protection (idempotency key on the outbound action, not just the inbound webhook).

## Cost reference (India, approximate, confirm current rates before budgeting)

Meta charges per delivered template message by category: marketing ≈ ₹0.86, utility/authentication ≈ ₹0.12 (+18% GST), with utility free inside an open service window. A direct Cloud API integration avoids an ongoing per-message reseller markup on top of Meta's own rate. Confirm current rates on Meta's official pricing page before finalizing budget, since these are revised periodically.

## Phased migration (do not do this all on day one)

1. Build the CRM's WhatsApp Inbox and AI agent against the **existing reseller connection** first, so the team gets value immediately without a risky number migration blocking everything else.
2. Stand up the direct Cloud API integration on a **test number** in parallel; verify webhook, templates, ad tracking end-to-end.
3. Migrate the real business number from the reseller to Cloud API in a planned window, with the owner's sign-off, then decommission the reseller connection.
