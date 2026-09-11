// Structured parsing of WABIS's outbound-webhook payload, for the endpoint
// currently wired only to the Gypsum Plaster "Contact Collection" flow
// (WABIS flow ID 981027, "Forward Data to Webhook" on its Start Bot Flow
// node). This is not Meta's Cloud API shape (entry[].changes[].value...) --
// it's a completely different flat shape.
//
// Verified against real captured/production deliveries: the observed
// top-level keys were exactly first_name, chat_id, postbackid,
// user_input_data, user_message, whatsapp_bot_username. An earlier version
// of this parser assumed a different shape (wa_message_id, whatsapp_bot_id,
// subscriber_id, ...) based on a prior claim of being "confirmed against a
// live WABIS account inspection" -- that claim was never backed by any
// saved evidence (checked: no discovery-mode log, no saved payload, nothing
// in git history) and did not match what was actually received. Only the
// fields listed above are read here; nothing throws on malformed input, and
// no field or semantic beyond what was directly observed is assumed.
//
// A real production delivery (11 Sep 2026, via a temporary structure-only
// diagnostic on the live route -- see git history) showed postbackid can
// arrive as an empty string. It was never confirmed to be required or to be
// a message id in the first place (see the comment on parseWabisMessage
// below), so this parser now treats it as optional: required fields for a
// valid payload are chat_id and whatsapp_bot_username only.

import type { InboundWhatsAppMessage } from "./ingest";

export type ParsedWabisMessage = InboundWhatsAppMessage;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * conversations are keyed by (wa_id, phone_number_id); WABIS has no
 * equivalent of Meta's own phone_number_id. whatsapp_bot_username (the
 * bot's own WhatsApp number, e.g. "+91 7356877322" -- matches the live
 * WABIS dashboard for this account) is the only per-bot identifier this
 * payload actually carries, so it's used here rather than the
 * previously-assumed (and never actually observed) whatsapp_bot_id.
 */
export function wabisPhoneNumberId(whatsappBotUsername: string): string {
  return `wabis:${whatsappBotUsername}`;
}

/**
 * chat_id is confirmed (live WABIS account inspection) to equal the
 * subscriber's phone number -- matched the same way the existing Meta
 * path matches leads by phone.
 *
 * postbackid identifies the WABIS postback/action that triggered this
 * delivery. Its semantics beyond "an identifier for this event" are not
 * confirmed -- it is NOT known to be a message id, and a real delivery has
 * shown it can arrive as an empty string. It is therefore optional: when
 * present and non-empty it's used as the closest available idempotency key
 * for messages.wa_message_id (nullable in the schema); otherwise
 * waMessageId is null, meaning this message simply has no idempotency key
 * -- not that the payload is invalid.
 *
 * user_input_data was observed as an empty array in the one captured
 * delivery. Its populated shape is unknown, so nothing is extracted from
 * it -- it is not read or assumed to carry any particular structure.
 *
 * There is no service/label field in this payload. Which service a
 * message belongs to is not something this parser can read off the
 * payload -- it can only be known from which endpoint/flow the delivery
 * arrived on, which is a routing fact, not parsed payload data.
 */
export function parseWabisMessage(payload: unknown): ParsedWabisMessage | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  const chatId = p.chat_id;
  const whatsappBotUsername = p.whatsapp_bot_username;

  if (!isNonEmptyString(chatId)) return null;
  if (!isNonEmptyString(whatsappBotUsername)) return null;

  // Wrong type, missing, or empty -> treated as absent (null); never
  // invalidates the whole payload -- see the comment above.
  const postbackId = isNonEmptyString(p.postbackid) ? p.postbackid : null;

  const firstName = typeof p.first_name === "string" && p.first_name.length > 0 ? p.first_name : null;
  const userMessage = typeof p.user_message === "string" ? p.user_message : null;

  return {
    waMessageId: postbackId,
    phoneNumberId: wabisPhoneNumberId(whatsappBotUsername),
    fromPhone: chatId,
    customerName: firstName,
    messageType: "text",
    body: userMessage,
    mediaId: null,
    // WABIS has no confirmed attribution/referral concept -- never invented.
    referral: null,
    // This parser is wired to exactly one WABIS endpoint/flow (see file
    // header) -- the Gypsum Plaster "Contact Collection" flow. That routing
    // fact, not anything read from the payload, is the entire basis for
    // this hint; it is never derived from message text.
    serviceHint: "Gypsum Plaster",
    raw: payload,
  };
}
