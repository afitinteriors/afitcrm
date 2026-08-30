import Link from "next/link";
import { Card } from "@/components/Card";
import { getConversationForLead } from "@/lib/conversations";
import { formatRelative, labelize } from "@/lib/format";

const STATUS_DOT: Record<string, string> = {
  open: "bg-success",
  closed: "bg-muted-foreground/40",
};

function messageSnippet(message: NonNullable<Awaited<ReturnType<typeof getConversationForLead>>>["lastMessage"]): string {
  if (!message) return "No messages yet";
  const prefix = message.direction === "outbound" ? "You: " : "";
  const text = message.body || labelize(message.message_type);
  return `${prefix}${text}`;
}

export async function ConversationCard({ leadId }: { leadId: string }) {
  const conversation = await getConversationForLead(leadId);

  if (!conversation) {
    return (
      <Card title="WhatsApp Conversation">
        <p className="text-sm text-muted-foreground">No WhatsApp conversation linked yet.</p>
      </Card>
    );
  }

  return (
    <Card title="WhatsApp Conversation">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm text-foreground">{messageSnippet(conversation.lastMessage)}</p>
        <span
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[conversation.status] ?? STATUS_DOT.closed}`}
          title={labelize(conversation.status)}
        />
      </div>
      {conversation.lastMessage && (
        <p className="mt-1 text-xs text-muted-foreground">{formatRelative(conversation.lastMessage.created_at)}</p>
      )}
      <Link
        href={`/conversations/${conversation.id}`}
        className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
      >
        View conversation →
      </Link>
    </Card>
  );
}
