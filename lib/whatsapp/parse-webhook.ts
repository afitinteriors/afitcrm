export type ParsedWhatsAppMessage = {
  waMessageId: string;
  phoneNumberId: string;
  fromPhone: string;
  customerName: string | null;
  messageText: string;
  timestamp: string; // ISO 8601
};

function describeMessage(message: Record<string, unknown>): string {
  const type = typeof message.type === "string" ? message.type : "unknown";

  if (type === "text") {
    const text = message.text as { body?: string } | undefined;
    if (text?.body) return text.body;
  }

  const mediaTypes = ["image", "video", "document", "audio", "sticker"];
  if (mediaTypes.includes(type)) {
    const media = message[type] as { caption?: string } | undefined;
    return media?.caption ? `[${type}] ${media.caption}` : `[${type} message]`;
  }

  if (type === "location") {
    const location = message.location as { name?: string; address?: string } | undefined;
    return `[location shared] ${location?.name ?? location?.address ?? ""}`.trim();
  }

  if (type === "button") {
    const button = message.button as { text?: string } | undefined;
    return button?.text ? `[button reply] ${button.text}` : "[button reply]";
  }

  if (type === "interactive") {
    const interactive = message.interactive as
      | { button_reply?: { title?: string }; list_reply?: { title?: string } }
      | undefined;
    const title = interactive?.button_reply?.title ?? interactive?.list_reply?.title;
    return title ? `[interactive reply] ${title}` : "[interactive reply]";
  }

  if (type === "reaction") {
    const reaction = message.reaction as { emoji?: string } | undefined;
    return reaction?.emoji ? `[reaction] ${reaction.emoji}` : "[reaction]";
  }

  return `[${type} message]`;
}

/**
 * Parses a Meta WhatsApp Cloud API webhook payload into a flat list of
 * inbound messages, skipping non-message events (delivery/read status
 * callbacks) and anything malformed rather than throwing — webhook
 * payloads are untrusted external input even after signature verification.
 */
export function parseWhatsAppWebhookPayload(payload: unknown): ParsedWhatsAppMessage[] {
  const results: ParsedWhatsAppMessage[] = [];

  if (!payload || typeof payload !== "object") return results;
  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return results;

  for (const entry of entries) {
    const changes = entry?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = change?.value;
      const messages = value?.messages;
      if (!Array.isArray(messages)) continue; // status callbacks etc. have no `messages`

      const phoneNumberId = value?.metadata?.phone_number_id;
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];

      for (const message of messages) {
        if (!message || typeof message !== "object") continue;
        const waMessageId = message.id;
        const fromPhone = message.from;
        const rawTimestamp = message.timestamp;
        if (typeof waMessageId !== "string" || typeof fromPhone !== "string") continue;

        const contact = contacts.find((c: { wa_id?: string }) => c?.wa_id === fromPhone);
        const customerName =
          typeof contact?.profile?.name === "string" ? contact.profile.name : null;

        const timestampSeconds = Number(rawTimestamp);
        const timestamp = Number.isFinite(timestampSeconds)
          ? new Date(timestampSeconds * 1000).toISOString()
          : new Date().toISOString();

        results.push({
          waMessageId,
          phoneNumberId: typeof phoneNumberId === "string" ? phoneNumberId : "",
          fromPhone,
          customerName,
          messageText: describeMessage(message),
          timestamp,
        });
      }
    }
  }

  return results;
}
