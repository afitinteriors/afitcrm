"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadAutomationMedia, type UploadMediaState } from "@/lib/actions/automation-media";
import type { AutomationMediaRow, AutomationMediaType } from "@/lib/supabase/types";
import { SubmitButton } from "@/components/SubmitButton";

// Real media library: image and video only (automation_media.media_type). Moved
// here unchanged from the previous config panel -- upload and pick, nothing else.
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
  onSelect: (id: string) => void;
  onUploaded: (asset: AutomationMediaRow) => void;
}) {
  const assetsOfType = mediaAssets.filter((a) => a.media_type === mediaType);
  const [state, formAction, isPending] = useActionState<UploadMediaState, FormData>(uploadAutomationMedia, null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && state && "asset" in state) {
      onSelect(state.asset.id);
      onUploaded(state.asset);
      formRef.current?.reset();
    }
    wasPending.current = isPending;
    // onSelect/onUploaded are stable setters from the parent -- excluded to
    // avoid re-running this effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, state]);

  const uploadError = state && "error" in state ? state.error : null;
  const accept = mediaType === "image" ? "image/jpeg,image/png" : "video/mp4,video/3gpp";

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">
        {mediaType === "image" ? "Image" : "Video"} from media library
      </label>
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="" disabled>
          Select {mediaType === "image" ? "an image" : "a video"}…
        </option>
        {assetsOfType.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <form ref={formRef} action={formAction} className="mt-3 space-y-2 rounded-md border border-dashed border-border p-2">
        <p className="text-xs font-medium text-muted-foreground">Upload new {mediaType}</p>
        <input
          type="text"
          name="name"
          placeholder="Name (e.g. Living room render)"
          required
          className="block w-full rounded-md border border-border px-2 py-1.5 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="file"
          name="file"
          accept={accept}
          required
          className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
        />
        {uploadError && <p className="text-xs text-danger">{uploadError}</p>}
        <SubmitButton
          className="h-8 w-full rounded-md border border-border px-2 text-xs font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          pendingLabel="Uploading…"
        >
          Upload
        </SubmitButton>
      </form>
    </div>
  );
}

// No backing library exists yet for audio, documents or WhatsApp templates
// (automation_media only stores image and video). These lists are placeholders
// so the flow can be designed; the value is saved as a name only and nothing
// is uploaded, sent or synced. Replace with a real picker when that exists.
export const PLACEHOLDER_AUDIO = ["Welcome voice note", "Project brief (voice)"];
export const PLACEHOLDER_DOCUMENTS = ["Company brochure.pdf", "Price list.pdf"];
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
