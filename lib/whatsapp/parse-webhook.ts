// Structured parsing of Meta WhatsApp Cloud API webhook payloads.
// Payload shape reference: entry[].changes[].value.{messages[],statuses[],contacts[],metadata}.
// This is untrusted external input even after signature verification — every
// field is read defensively and nothing here throws on malformed input.

export type ParsedWhatsAppMessage = {
  waMessageId: string;
  phoneNumberId: string;
  fromPhone: string;
  customerName: string | null;
  timestamp: string; // ISO 8601
  messageType: string;
  body: string | null;
  mediaId: string | null;
  referral: unknown;
  raw: unknown; // the original Meta message object, stored verbatim in raw_payload
};

export type ParsedWhatsAppStatus = {
  waMessageId: string;
  status: string;
  timestamp: string; // ISO 8601
};

const MEDIA_TYPES = ["image", "video", "document", "audio", "sticker"];

function toIsoTimestamp(rawTimestamp: unknown): string {
  const seconds = Number(rawTimestamp);
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
}

function extractBodyAndMedia(message: Record<string, unknown>): { body: string | null; mediaId: string | null } {
  const type = typeof message.type === "string" ? message.type : "unknown";

  if (type === "text") {
    const text = message.text as { body?: string } | undefined;
    return { body: typeof text?.body === "string" ? text.body : null, mediaId: null };
  }

  if (MEDIA_TYPES.includes(type)) {
    const media = message[type] as { id?: string; caption?: string } | undefined;
    return {
      body: typeof media?.caption === "string" ? media.caption : null,
      mediaId: typeof media?.id === "string" ? media.id : null,
    };
  }

  if (type === "location") {
    const location = message.location as
      | { latitude?: number; longitude?: number; name?: string; address?: string }
      | undefined;
    if (!location) return { body: null, mediaId: null };
    const parts = [location.name, location.address, `${location.latitude},${location.longitude}`].filter(Boolean);
    return { body: parts.join(" — ") || null, mediaId: null };
  }

  if (type === "button") {
    const button = message.button as { text?: string; payload?: string } | undefined;
    return { body: typeof button?.text === "string" ? button.text : null, mediaId: null };
  }

  if (type === "interactive") {
    const interactive = message.interactive as
      | { button_reply?: { title?: string }; list_reply?: { title?: string } }
      | undefined;
    const title = interactive?.button_reply?.title ?? interactive?.list_reply?.title;
    return { body: typeof title === "string" ? title : null, mediaId: null };
  }

  if (type === "reaction") {
    const reaction = message.reaction as { emoji?: string; message_id?: string } | undefined;
    return { body: typeof reaction?.emoji === "string" ? reaction.emoji : null, mediaId: null };
  }

  if (type === "contacts") {
    return { body: null, mediaId: null };
  }

  // Unknown/unsupported type: no body, no media — raw payload still preserved by the caller.
  return { body: null, mediaId: null };
}

/**
 * Parses inbound messages (`value.messages[]`) into structured records.
 * Skips entries that are missing the minimum fields needed to persist a
 * message safely (id, sender) rather than throwing.
 */
export function parseWhatsAppMessages(payload: unknown): ParsedWhatsAppMessage[] {
  const results: ParsedWhatsAppMessage[] = [];

  if (!payload || typeof payload !== "object") return results;
  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return results;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: unknown })?.value as
        | {
            messages?: unknown;
            metadata?: { phone_number_id?: unknown };
            contacts?: unknown;
          }
        | undefined;
      const messages = value?.messages;
      if (!Array.isArray(messages)) continue; // status-only or non-message change

      const phoneNumberId = value?.metadata?.phone_number_id;
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];

      for (const message of messages) {
        if (!message || typeof message !== "object") continue;
        const m = message as Record<string, unknown>;
        const waMessageId = m.id;
        const fromPhone = m.from;
        if (typeof waMessageId !== "string" || typeof fromPhone !== "string") continue;

        const contact = (contacts as Array<{ wa_id?: string; profile?: { name?: string } }>).find(
          (c) => c?.wa_id === fromPhone
        );
        const customerName = typeof contact?.profile?.name === "string" ? contact.profile.name : null;

        const { body, mediaId } = extractBodyAndMedia(m);

        results.push({
          waMessageId,
          phoneNumberId: typeof phoneNumberId === "string" ? phoneNumberId : "",
          fromPhone,
          customerName,
          timestamp: toIsoTimestamp(m.timestamp),
          messageType: typeof m.type === "string" ? m.type : "unknown",
          body,
          mediaId,
          referral: m.referral ?? null,
          raw: m,
        });
      }
    }
  }

  return results;
}

/**
 * Parses status callbacks (`value.statuses[]`) — sent/delivered/read/failed
 * — into structured records used to update previously-persisted messages.
 */
export function parseWhatsAppStatuses(payload: unknown): ParsedWhatsAppStatus[] {
  const results: ParsedWhatsAppStatus[] = [];

  if (!payload || typeof payload !== "object") return results;
  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return results;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: unknown })?.value as { statuses?: unknown } | undefined;
      const statuses = value?.statuses;
      if (!Array.isArray(statuses)) continue;

      for (const status of statuses) {
        if (!status || typeof status !== "object") continue;
        const s = status as Record<string, unknown>;
        const waMessageId = s.id;
        const statusValue = s.status;
        if (typeof waMessageId !== "string" || typeof statusValue !== "string") continue;

        results.push({
          waMessageId,
          status: statusValue,
          timestamp: toIsoTimestamp(s.timestamp),
        });
      }
    }
  }

  return results;
}
