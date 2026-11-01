"use client";

import { useActionState, useState } from "react";
import { sendAiDraft, discardAiDraft } from "@/lib/actions/ai-draft";

// Blueprint V1 Phase 6: the draft-mode review surface -- nothing the AI
// drafts ever reaches the customer without this. Sits in the same spot
// ReplyComposer occupies (replacing it while a draft is pending, since
// sending the draft IS the reply -- a separate free-typed message would
// just be a second, redundant composer for the same turn). A successful
// send/discard clears conversations.pending_ai_draft, which unmounts this
// component on the parent's next render -- no local "clear" needed here.
export function AiDraftCard({ conversationId, draftText }: { conversationId: string; draftText: string }) {
  const [sendState, sendAction, isSending] = useActionState(sendAiDraft, null);
  const [discardState, discardAction, isDiscarding] = useActionState(discardAiDraft, null);
  const [text, setText] = useState(draftText);
  const [editing, setEditing] = useState(false);
  const busy = isSending || isDiscarding;

  return (
    <div className="shrink-0 border-t border-border bg-emerald-50/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.95-6.364l-2.121 2.121M8.172 15.828l-2.121 2.121m0-12.728l2.121 2.121m7.656 7.656l2.121 2.121" />
          </svg>
        </span>
        <p className="text-xs font-medium text-emerald-700">AI suggests</p>
        <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">Draft — not sent</span>
      </div>

      {(sendState?.error || discardState?.error) && (
        <p className="mb-2 text-xs text-red-600">{sendState?.error || discardState?.error}</p>
      )}

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setEditing(true);
        }}
        disabled={busy}
        rows={3}
        className="mb-2 w-full resize-none rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
      />

      <div className="flex gap-2">
        <form action={discardAction} className="flex-1">
          <input type="hidden" name="conversation_id" value={conversationId} />
          <button
            type="submit"
            disabled={busy}
            className="h-9 w-full rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary disabled:opacity-60"
          >
            Discard
          </button>
        </form>
        <form action={sendAction} className="flex-[1.4]">
          <input type="hidden" name="conversation_id" value={conversationId} />
          <input type="hidden" name="text" value={text} />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="h-9 w-full rounded-lg bg-[#16A34A] text-xs font-medium text-white hover:bg-[#15803D] disabled:opacity-50"
          >
            {editing ? "Send edited reply" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
