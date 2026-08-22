"use client";

import { useState } from "react";

type MediaState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

const IMAGE_TYPES = new Set(["image", "sticker"]);

const TYPE_ICON: Record<string, string> = {
  image: "🖼️",
  sticker: "🖼️",
  video: "🎬",
  audio: "🎵",
  document: "📄",
};

// Customer media is never fetched automatically -- this only calls the
// existing, already-authorized GET /api/media/[messageId] route when the
// user explicitly taps. That route (and the B3 download/validation/storage
// pipeline behind it) is unchanged; this is purely a UI-layer gate on when
// it gets called.
export function MediaMessage({
  messageId,
  messageType,
  caption,
}: {
  messageId: string;
  messageType: string;
  caption: string | null;
}) {
  const [state, setState] = useState<MediaState>({ status: "idle" });
  const isImage = IMAGE_TYPES.has(messageType);

  async function load() {
    if (state.status === "loading" || state.status === "ready") return;
    setState({ status: "loading" });

    try {
      const res = await fetch(`/api/media/${messageId}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to load media.");

      setState({ status: "ready", url: body.url });
      if (!isImage) {
        // Documents/video/audio: the tap means "open this," so open it once
        // it's ready rather than making the user tap a second time.
        window.open(body.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Failed to load media." });
    }
  }

  if (state.status === "ready" && isImage) {
    return (
      <div>
        {/* Signed, short-lived, externally-hosted URL -- not a build-time
            optimizable asset, so next/image doesn't apply here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={state.url}
          alt={caption || "WhatsApp image"}
          className="max-w-xs rounded-lg border border-slate-200 object-cover"
        />
        {caption && <p className="mt-1 text-sm text-slate-700">{caption}</p>}
      </div>
    );
  }

  if (state.status === "ready") {
    return (
      <a
        href={state.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-blue-700 active:bg-slate-100"
      >
        {TYPE_ICON[messageType] ?? "📎"} Open {messageType} again
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={load}
      disabled={state.status === "loading"}
      className="flex min-h-11 w-full min-w-40 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-medium text-slate-700 active:bg-slate-100 disabled:opacity-70"
    >
      <span className="text-lg">{TYPE_ICON[messageType] ?? "📎"}</span>
      <span className="flex-1">
        {state.status === "loading"
          ? "Loading…"
          : `Tap to ${isImage ? "view" : "open"} ${messageType}`}
        {caption && state.status !== "loading" && (
          <span className="block truncate text-xs font-normal text-slate-500">{caption}</span>
        )}
        {state.status === "error" && (
          <span className="block text-xs font-normal text-red-600">{state.message}</span>
        )}
      </span>
    </button>
  );
}
