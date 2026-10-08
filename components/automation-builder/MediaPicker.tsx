"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { uploadAutomationMedia, type UploadMediaState } from "@/lib/actions/automation-media";
import type { AutomationMediaRow, AutomationMediaType } from "@/lib/supabase/types";

// Real media library: image, video and document (automation_media.media_type,
// extended to include "document" in the Step 8 media hardening phase). Moved
// here unchanged from the previous config panel -- upload and pick, nothing else.
const MEDIA_LABEL: Record<AutomationMediaType, string> = { image: "Image", video: "Video", document: "Document" };
const MEDIA_ACCEPT: Record<AutomationMediaType, string> = {
  image: "image/jpeg,image/png",
  video: "video/mp4,video/3gpp",
  document: "application/pdf",
};
export function MediaPicker({
  mediaType,
  mediaAssets,
  selectedId,
  onSelect,
  onUploaded,
}: {
  mediaType: AutomationMediaType;
  mediaAssets: AutomationMediaRow[];
  selectedId: string | undefined;
  onSelect: (id: string, name?: string) => void;
  onUploaded: (asset: AutomationMediaRow) => void;
}) {
  const assetsOfType = mediaAssets.filter((a) => a.media_type === mediaType);
  const [state, formAction, isPending] = useActionState<UploadMediaState, FormData>(uploadAutomationMedia, null);
  const [, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && state && "asset" in state) {
      // Pass the freshly uploaded asset's own name directly -- looking it up
      // from the `mediaAssets` prop here would race the parent's own state
      // update from onUploaded below (same render's stale closure), silently
      // saving mediaAssetId with no mediaName and leaving the canvas summary
      // stuck on "No media chosen" even though the block is fully configured
      // and executes correctly (found live while verifying Step 8's Send
      // Document picker; the pre-existing image/video pickers shared the
      // same bug).
      onSelect(state.asset.id, state.asset.name);
      onUploaded(state.asset);
      if (nameRef.current) nameRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
    wasPending.current = isPending;
    // onSelect/onUploaded are stable setters from the parent -- excluded to
    // avoid re-running this effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, state]);

  // Not a <form>: this picker renders inside the builder's own <form>, and a
  // nested form is ignored by the browser. A submit button here would then
  // submit the builder (draft save) instead of uploading. The action is
  // invoked directly with the file and name instead.
  function handleUpload() {
    const file = fileRef.current?.files?.[0];
    const name = nameRef.current?.value.trim() ?? "";
    if (!file) {
      setLocalError("Choose a file to upload.");
      return;
    }
    if (!name) {
      setLocalError("A name is required.");
      return;
    }
    setLocalError(null);
    const payload = new FormData();
    payload.set("name", name);
    payload.set("file", file);
    startTransition(() => formAction(payload));
  }

  const uploadError = localError ?? (state && "error" in state ? state.error : null);
  const accept = MEDIA_ACCEPT[mediaType];
  const label = MEDIA_LABEL[mediaType];

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">{label} from media library</label>
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value, assetsOfType.find((a) => a.id === e.target.value)?.name)}
        className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="" disabled>
          Select {mediaType === "image" ? "an image" : mediaType === "video" ? "a video" : "a document"}…
        </option>
        {assetsOfType.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <div className="mt-3 space-y-2 rounded-md border border-dashed border-border p-2">
        <p className="text-xs font-medium text-muted-foreground">Upload new {label.toLowerCase()}</p>
        <input
          ref={nameRef}
          type="text"
          name="name"
          placeholder="Name (e.g. Living room render)"
          className="block w-full rounded-md border border-border px-2 py-1.5 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept={accept}
          onChange={() => setLocalError(null)}
          className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
        />
        {uploadError && <p className="text-xs text-danger">{uploadError}</p>}
        <button
          type="button"
          onClick={handleUpload}
          disabled={isPending}
          className="h-8 w-full rounded-md border border-border px-2 text-xs font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Uploading…" : "Upload"}
        </button>
      </div>
    </div>
  );
}

// No backing library exists yet for audio or WhatsApp templates
// (automation_media stores image/video/document only -- see Step 8). These
// lists are placeholders so the flow can be designed; the value is saved as
// a name only and nothing is uploaded, sent or synced. Replace with a real
// picker when that exists.
export const PLACEHOLDER_AUDIO = ["Welcome voice note", "Project brief (voice)"];
export const PLACEHOLDER_TEMPLATES = ["welcome_intro_v1", "site_visit_reminder_v1"];

export function PlaceholderPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="" disabled>
          Choose…
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-muted-foreground">Placeholder list -- no library is connected yet.</p>
    </div>
  );
}
