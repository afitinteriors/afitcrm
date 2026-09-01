"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import type { AutomationMediaRow, AutomationMediaType } from "@/lib/supabase/types";

// Media MVP (approved architecture, added 2026-09-01) -- admin-only
// upload for the automation builder's media picker. Storage has no RLS
// policies of its own anywhere in this project (confirmed before writing
// this -- zero rows in pg_policies for storage.objects), so every storage
// write in this codebase, inbound (lib/whatsapp/media.ts) or outbound
// here, goes through the service-role client. Authorization is enforced
// at this Server Action layer instead (requireAdmin(), same pattern as
// lib/actions/automation-config.ts), before the admin client is ever
// touched -- not a substitute for RLS on automation_media itself (which
// still independently enforces admin-only INSERT), just the only
// mechanism available for the storage half of this write.

export type UploadMediaState = { error: string } | { asset: AutomationMediaRow } | null;

const MEDIA_BUCKET = "whatsapp-media";
const OUTBOUND_PREFIX = "outbound";

// Meta's current documented Cloud API limits for outbound image/video
// messages (developers.facebook.com/docs/whatsapp/cloud-api/reference/media,
// confirmed live before implementing this -- not assumed from memory):
// images JPEG/PNG only, max 5MB; videos MP4/3GPP only, max 16MB.
const IMAGE_MIME_EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };
const VIDEO_MIME_EXTENSIONS: Record<string, string> = { "video/mp4": "mp4", "video/3gpp": "3gp" };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 16 * 1024 * 1024;

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}

function classifyMedia(mimeType: string): { mediaType: AutomationMediaType; extension: string } | null {
  if (IMAGE_MIME_EXTENSIONS[mimeType]) return { mediaType: "image", extension: IMAGE_MIME_EXTENSIONS[mimeType] };
  if (VIDEO_MIME_EXTENSIONS[mimeType]) return { mediaType: "video", extension: VIDEO_MIME_EXTENSIONS[mimeType] };
  return null;
}

export async function uploadAutomationMedia(
  _prevState: UploadMediaState,
  formData: FormData
): Promise<UploadMediaState> {
  if (!(await requireAdmin())) return { error: "Admin access required." };

  const file = formData.get("file");
  const name = String(formData.get("name") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) return { error: "No file provided." };
  if (!name) return { error: "A name is required." };

  const classification = classifyMedia(file.type);
  if (!classification) {
    return { error: "Unsupported file type. Use JPEG or PNG for images, MP4 or 3GPP for videos." };
  }
  const { mediaType, extension } = classification;

  const maxBytes = mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    return { error: `File is too large -- WhatsApp's own limit for ${mediaType}s is ${limitMb}MB.` };
  }

  const assetId = crypto.randomUUID();
  const storagePath = `${OUTBOUND_PREFIX}/${assetId}.${extension}`;
  const admin = createAdminClient();

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: `Failed to upload file: ${uploadError.message}` };
  }

  // The table write itself goes through the session-scoped client, not
  // the admin one -- automation_media's own RLS (admin-only INSERT) is
  // the real enforcement here, matching every other automation-config
  // write in this app (lib/actions/automation-config.ts), unlike the
  // storage step above which has no RLS to defer to.
  const supabase = await createClient();
  const { data: inserted, error: insertError } = await supabase
    .from("automation_media")
    .insert({
      id: assetId,
      name,
      media_type: mediaType,
      mime_type: file.type,
      storage_path: storagePath,
      file_size_bytes: file.size,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    // Orphaned storage object cleanup -- best-effort, matches the
    // "storage write already happened, don't leave it dangling silently"
    // caution already established in lib/whatsapp/media.ts.
    await admin.storage.from(MEDIA_BUCKET).remove([storagePath]);
    return { error: insertError?.message ?? "Failed to save the media asset." };
  }

  return { asset: inserted };
}
