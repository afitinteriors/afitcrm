import "server-only";

// Outbound text sending for Phase B5.
//
// Requires WHATSAPP_ACCESS_TOKEN (same server-side token used for B3 media
// download) with whatsapp_business_messaging permission. The token never
// reaches the client -- this module is only ever called from
// lib/actions/messages.ts, a Server Action.

const DEFAULT_GRAPH_API_VERSION = "v21.0";

// Meta's documented error code for the 24-hour customer service window
// having closed: developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
const WINDOW_CLOSED_ERROR_CODE = 131047;

export type SendMessageErrorCode = "not_configured" | "outside_window" | "meta_api_error";

const SEND_ERROR_STATUS: Record<SendMessageErrorCode, number> = {
  not_configured: 500,
  outside_window: 422,
  meta_api_error: 502,
};

const SEND_ERROR_PUBLIC_MESSAGE: Record<SendMessageErrorCode, string> = {
  not_configured: "WhatsApp sending is not configured.",
  outside_window:
    "This conversation is outside the 24-hour reply window. The customer needs to message again before you can send a free-form reply.",
  meta_api_error: "WhatsApp did not accept this message.",
};

export class SendMessageError extends Error {
  code: SendMessageErrorCode;
  status: number;
  publicMessage: string;

  constructor(code: SendMessageErrorCode, message: string, publicMessage?: string) {
    super(message);
    this.name = "SendMessageError";
    this.code = code;
    this.status = SEND_ERROR_STATUS[code];
    this.publicMessage = publicMessage ?? SEND_ERROR_PUBLIC_MESSAGE[code];
  }
}

export type SendTextMessageResult = { waMessageId: string };

/**
 * Sends a free-form text message via the Cloud API. Throws SendMessageError
 * on any failure -- callers must not persist a message row unless this
 * resolves successfully, so a rejected send is never shown as sent.
 */
export async function sendTextMessage(
  phoneNumberId: string,
  to: string,
  body: string
): Promise<SendTextMessageResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new SendMessageError("not_configured", "WHATSAPP_ACCESS_TOKEN is not configured.");
  }

  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION;
  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body, preview_url: false },
      }),
    }
  );

  const data = (await response.json().catch(() => ({}))) as {
    error?: { code?: number; message?: string };
    messages?: { id?: string }[];
  };

  if (!response.ok) {
    if (data.error?.code === WINDOW_CLOSED_ERROR_CODE) {
      throw new SendMessageError(
        "outside_window",
        `Meta rejected send: 24-hour window closed (error code ${data.error.code})`
      );
    }
    const metaMessage = data.error?.message ?? `HTTP ${response.status}`;
    throw new SendMessageError(
      "meta_api_error",
      `Meta send failed: ${metaMessage}`,
      `WhatsApp did not accept this message: ${metaMessage}`
    );
  }

  const waMessageId = data.messages?.[0]?.id;
  if (typeof waMessageId !== "string") {
    throw new SendMessageError("meta_api_error", "Meta response was missing a message id.");
  }

  return { waMessageId };
}
