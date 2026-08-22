import type { MessageListItem } from "@/lib/conversations";
import { formatDateTime } from "@/lib/format";
import { MediaMessage } from "@/components/conversations/MediaMessage";

const MEDIA_TYPES = new Set(["image", "video", "audio", "document", "sticker"]);

const STATUS_LABELS: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed to send",
};

export function MessageBubble({ message }: { message: MessageListItem }) {
  const isOutbound = message.direction === "outbound";
  const isMedia = MEDIA_TYPES.has(message.message_type) && message.media_id;

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-lg rounded-xl px-3 py-2 text-sm shadow-sm ${
          isOutbound ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-900"
        }`}
      >
        {isMedia ? (
          <MediaMessage messageId={message.id} messageType={message.message_type} caption={message.body} />
        ) : message.body ? (
          <p className="whitespace-pre-wrap">{message.body}</p>
        ) : (
          <p className={`italic ${isOutbound ? "text-blue-100" : "text-slate-400"}`}>
            Unsupported message type: {message.message_type}
          </p>
        )}
        <p
          className={`mt-1 text-[11px] ${
            isOutbound && message.status === "failed"
              ? "text-red-200"
              : isOutbound
                ? "text-blue-100"
                : "text-slate-400"
          }`}
        >
          {formatDateTime(message.created_at)}
          {isOutbound && message.status ? ` · ${STATUS_LABELS[message.status] ?? message.status}` : ""}
        </p>
      </div>
    </div>
  );
}
