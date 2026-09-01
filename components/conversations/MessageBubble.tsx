import type { MessageListItem } from "@/lib/conversations";
import { formatDateTime } from "@/lib/format";
import { MediaMessage } from "@/components/conversations/MediaMessage";

const MEDIA_TYPES = new Set(["image", "video", "audio", "document", "sticker"]);

// Compact WhatsApp-style delivery ticks in place of status text. This is a
// presentation change only -- message.status is the same real value the
// webhook status callbacks already write (sent/delivered/read/failed);
// nothing here invents new state.
function DeliveryTicks({ status }: { status: string | null }) {
  if (!status) return null;

  if (status === "failed") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5 text-red-200">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    );
  }

  const isRead = status === "read";
  const doubleCheck = status === "delivered" || status === "read";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 12"
      fill="none"
      className={`h-3 w-4 ${isRead ? "text-sky-300" : "text-blue-100"}`}
      aria-label={status}
    >
      <path d="M1 6.5L4.5 10L11 2" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      {doubleCheck && (
        <path d="M7 6.5L10.5 10L17 2" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function MessageBubble({ message }: { message: MessageListItem }) {
  const isOutbound = message.direction === "outbound";
  const isMedia = MEDIA_TYPES.has(message.message_type) && message.media_id;

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-lg ${
          isOutbound ? "bg-[#14342a] text-white" : "border border-border bg-white text-foreground"
        }`}
      >
        {isMedia ? (
          <MediaMessage messageId={message.id} messageType={message.message_type} caption={message.body} />
        ) : message.body ? (
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        ) : (
          <p className={`italic ${isOutbound ? "text-emerald-100" : "text-muted-foreground"}`}>
            Unsupported message type: {message.message_type}
          </p>
        )}
        <p
          className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${
            isOutbound && message.status === "failed" ? "text-red-200" : isOutbound ? "text-emerald-100" : "text-muted-foreground"
          }`}
        >
          {formatDateTime(message.created_at)}
          {isOutbound && <DeliveryTicks status={message.status} />}
        </p>
      </div>
    </div>
  );
}
