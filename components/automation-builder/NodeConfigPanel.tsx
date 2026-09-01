"use client";

import { useActionState, useEffect, useRef } from "react";
import { getNodeDefinition, CAPTURABLE_LEAD_FIELDS, type CapturableLeadField } from "@/lib/automations/graph-schema";
import type { FlowNodeType } from "@/components/automation-builder/FlowNode";
import { uploadAutomationMedia, type UploadMediaState } from "@/lib/actions/automation-media";
import type { AutomationMediaRow, AutomationMediaType } from "@/lib/supabase/types";
import { SubmitButton } from "@/components/SubmitButton";

// Media MVP (approved architecture, added 2026-09-01): the picker + inline
// upload for send_image/send_video. No delete/replace/media-management UI
// in v1 -- upload and pick only, matching the approved scope exactly.
function MediaPicker({
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
        {mediaType === "image" ? "Image" : "Video"}
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
      {!selectedId && (
        <p className="mt-1 text-xs text-warning">A media file must be selected before this flow can be saved.</p>
      )}

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
          className="h-7 w-full rounded-md border border-border px-2 text-xs font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          pendingLabel="Uploading…"
        >
          Upload
        </SubmitButton>
      </form>
    </div>
  );
}

// Only capture_lead_field/send_text/ask_question/send_image/send_video have
// any configurable parameter today -- create_or_link_lead takes none, and
// every other visible type is either structural or disabled/planned. This
// panel stays a description + delete (+ config where it applies), not
// padded with fields that wouldn't do anything.
export function NodeConfigPanel({
  node,
  onDelete,
  onFieldKeyChange,
  onTextChange,
  mediaAssets,
  onMediaAssetIdChange,
  onMediaUploaded,
}: {
  node: FlowNodeType | null;
  onDelete: (id: string) => void;
  onFieldKeyChange: (id: string, fieldKey: CapturableLeadField) => void;
  onTextChange: (id: string, text: string) => void;
  mediaAssets: AutomationMediaRow[];
  onMediaAssetIdChange: (id: string, mediaAssetId: string) => void;
  onMediaUploaded: (asset: AutomationMediaRow) => void;
}) {
  if (!node) {
    return (
      <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-muted-foreground">Select a block to see its details.</p>
        </div>
      </aside>
    );
  }

  const def = getNodeDefinition(node.data.nodeType);
  const isTrigger = node.data.nodeType === "trigger";
  const isCapture = node.data.nodeType === "capture_lead_field";
  const isTextNode = node.data.nodeType === "send_text" || node.data.nodeType === "ask_question";
  const isMediaNode = node.data.nodeType === "send_image" || node.data.nodeType === "send_video";

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">BLOCK</p>
        <p className="text-sm font-semibold text-foreground">{def.label}</p>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">{def.description}</p>

        {isTextNode && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground">
              {node.data.nodeType === "ask_question" ? "Question text" : "Message text"}
            </label>
            <textarea
              value={node.data.text ?? ""}
              onChange={(e) => onTextChange(node.id, e.target.value)}
              rows={4}
              placeholder={node.data.nodeType === "ask_question" ? "e.g. What's the approximate area in sqft?" : "e.g. Thanks for reaching out! Here's a bit about our work…"}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {!node.data.text?.trim() && <p className="mt-1 text-xs text-warning">Message text is required before this flow can be saved.</p>}
          </div>
        )}

        {isMediaNode && (
          <MediaPicker
            key={node.id}
            mediaType={node.data.nodeType === "send_image" ? "image" : "video"}
            mediaAssets={mediaAssets}
            selectedId={node.data.mediaAssetId}
            onSelect={(id) => onMediaAssetIdChange(node.id, id)}
            onUploaded={onMediaUploaded}
          />
        )}

        {isCapture && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Field to capture</label>
            <select
              value={node.data.fieldKey ?? ""}
              onChange={(e) => onFieldKeyChange(node.id, e.target.value as CapturableLeadField)}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>
                Select a field…
              </option>
              {CAPTURABLE_LEAD_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            {!node.data.fieldKey && <p className="mt-1 text-xs text-warning">A field must be selected before this flow can be saved.</p>}
          </div>
        )}

        {isTrigger ? (
          <p className="text-xs text-muted-foreground">
            This block is required and can&apos;t be removed. Configure which keywords route to this service on the{" "}
            services page.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="h-9 w-full rounded-md border border-danger/30 px-3 text-sm font-medium text-danger hover:bg-danger-soft"
          >
            Delete block
          </button>
        )}
      </div>
    </aside>
  );
}
