"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendMessage } from "@/lib/actions/messages";

// Text-only, mobile-first composer. Authorization is enforced entirely by
// the sendMessage action (via RLS) -- this component renders whenever the
// conversation page itself rendered, since read access and send access
// share the same ownership condition.
export function ReplyComposer({ conversationId }: { conversationId: string }) {
  const [state, formAction, isPending] = useActionState(sendMessage, null);
  const [text, setText] = useState("");
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) {
      setText("");
    }
    wasPending.current = isPending;
  }, [isPending, state]);

  return (
    <form action={formAction} className="shrink-0 border-t border-slate-200 bg-white p-2">
      <input type="hidden" name="conversation_id" value={conversationId} />
      {state?.error && <p className="mb-2 px-1 text-xs text-red-600">{state.error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          name="body"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Type a message"
          rows={1}
          disabled={isPending}
          className="min-h-11 flex-1 resize-none rounded-full border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isPending || !text.trim()}
          aria-label="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white active:bg-blue-700 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
