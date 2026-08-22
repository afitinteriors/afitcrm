import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// On-demand Meta media download for Phase B3.
//
// Requires WHATSAPP_ACCESS_TOKEN (a Meta system-user access token with
// whatsapp_business_messaging permission) to be set server-side. Optional
// WHATSAPP_GRAPH_API_VERSION overrides the default Graph API version below.
// Neither the access token nor Meta's temporary media CDN URL is ever
// returned to the caller -- only a short-lived Supabase signed URL is.

const MEDIA_BUCKET = "whatsapp-media";
const MAX_MEDIA_BYTES = 100 * 1024 * 1024; // matches the whatsapp-media bucket's file_size_limit
const SIGNED_URL_TTL_SECONDS = 60;
const DEFAULT_GRAPH_API_VERSION = "v21.0";

// Meta's documented supported WhatsApp media types:
// developers.facebook.com/docs/whatsapp/cloud-api/reference/media
const MEDIA_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/amr": "amr",
  "audio/ogg": "ogg",
  "application/pdf": "pdf",
  "application/vnd.ms-powerpoint": "ppt",
  "application/msword": "doc",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
};

export type MediaErrorCode =
  | "not_media"
  | "unsupported_media_type"
  | "media_too_large"
  | "integrity_mismatch"
  | "meta_api_error"
  | "storage_error";

const MEDIA_ERROR_STATUS: Record<MediaErrorCode, number> = {
  not_media: 400,
  unsupported_media_type: 422,
  media_too_large: 422,
  integrity_mismatch: 502,
  meta_api_error: 502,
  storage_error: 500,
};

const MEDIA_ERROR_PUBLIC_MESSAGE: Record<MediaErrorCode, string> = {
  not_media: "Message has no media.",
  unsupported_media_type: "Unsupported media type.",
  media_too_large: "Media exceeds the allowed size limit.",
  integrity_mismatch: "Media failed an integrity check and was discarded.",
  meta_api_error: "Could not retrieve media from WhatsApp.",
  storage_error: "Could not store media.",
};

export class MediaError extends Error {
  code: MediaErrorCode;
  status: number;
  publicMessage: string;

  constructor(code: MediaErrorCode, message: string) {
    super(message);
    this.name = "MediaError";
    this.code = code;
    this.status = MEDIA_ERROR_STATUS[code];
    this.publicMessage = MEDIA_ERROR_PUBLIC_MESSAGE[code];
  }
}

export function extensionForMimeType(mimeType: string): string | null {
  return MEDIA_EXTENSIONS[mimeType] ?? null;
}

// conversationId and messageId are always server-generated UUIDs, never
// user-controlled strings, so this path can't be used for traversal.
export function buildMediaStoragePath(
  conversationId: string,
  messageId: string,
  extension: string
): string {
  return `${conversationId}/${messageId}.${extension}`;
}

export type MediaAccessProfile = { id: string; role: "admin" | "staff" };

// Mirrors the lead ownership model used elsewhere (lib/leads.ts): admin sees
// everything, staff only conversations linked to a lead assigned to them. A
// conversation with no linked lead has no staff owner, so it fails closed.
export function canAccessConversationMedia(
  profile: MediaAccessProfile,
  conversationLeadId: string | null,
  leadAssignedToId: string | null
): boolean {
  if (profile.role === "admin") return true;
  if (!conversationLeadId) return false;
  return leadAssignedToId === profile.id;
}

type MetaMediaMetadata = {
  url: string;
  mimeType: string;
  sha256: string;
  fileSize: number;
};

async function fetchMetaMediaMetadata(mediaId: string, accessToken: string): Promise<MetaMediaMetadata> {
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION;
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new MediaError("meta_api_error", `Meta media metadata request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    url?: string;
    mime_type?: string;
    sha256?: string;
    file_size?: number;
  };

  if (
    typeof data.url !== "string" ||
    typeof data.mime_type !== "string" ||
    typeof data.sha256 !== "string" ||
    typeof data.file_size !== "number"
  ) {
    throw new MediaError("meta_api_error", "Meta media metadata response was missing required fields.");
  }

  return { url: data.url, mimeType: data.mime_type, sha256: data.sha256, fileSize: data.file_size };
}

async function fetchMetaMediaBytes(url: string, accessToken: string): Promise<ArrayBuffer> {
  // Meta's media CDN URL is temporary and itself requires the same bearer
  // token -- it is fetched here only and never forwarded to the client.
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    throw new MediaError("meta_api_error", `Meta media download failed with status ${response.status}`);
  }
  return response.arrayBuffer();
}

function sha256Hex(bytes: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

type MessageMediaRow = {
  id: string;
  conversation_id: string;
  media_id: string | null;
  media_storage_path: string | null;
};

/**
 * Returns the storage path for a message's media, downloading it from Meta
 * and validating it first if it hasn't been fetched yet. Safe to call
 * repeatedly for the same message -- an existing media_storage_path is
 * reused without contacting Meta again.
 */
export async function resolveMediaStoragePath(
  admin: SupabaseClient<Database>,
  message: MessageMediaRow
): Promise<{ path: string; reused: boolean }> {
  if (message.media_storage_path) {
    return { path: message.media_storage_path, reused: true };
  }
  if (!message.media_id) {
    throw new MediaError("not_media", "Message has no media_id to download.");
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new MediaError("meta_api_error", "WHATSAPP_ACCESS_TOKEN is not configured.");
  }

  const metadata = await fetchMetaMediaMetadata(message.media_id, accessToken);

  const extension = extensionForMimeType(metadata.mimeType);
  if (!extension) {
    throw new MediaError("unsupported_media_type", `Unsupported media MIME type: ${metadata.mimeType}`);
  }
  if (metadata.fileSize > MAX_MEDIA_BYTES) {
    throw new MediaError(
      "media_too_large",
      `Media file size ${metadata.fileSize} exceeds limit ${MAX_MEDIA_BYTES}.`
    );
  }

  const bytes = await fetchMetaMediaBytes(metadata.url, accessToken);

  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    throw new MediaError(
      "media_too_large",
      `Downloaded media size ${bytes.byteLength} exceeds limit ${MAX_MEDIA_BYTES}.`
    );
  }
  if (bytes.byteLength !== metadata.fileSize) {
    throw new MediaError("integrity_mismatch", "Downloaded byte length did not match Meta-reported file size.");
  }

  const actualSha256 = sha256Hex(bytes);
  if (actualSha256.toLowerCase() !== metadata.sha256.toLowerCase()) {
    throw new MediaError("integrity_mismatch", "Downloaded media SHA-256 did not match Meta-reported checksum.");
  }

  const path = buildMediaStoragePath(message.conversation_id, message.id, extension);

  const { error: uploadError } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: metadata.mimeType, upsert: false });

  // A "duplicate" here means a concurrent request already uploaded the same
  // deterministic path first -- not a real failure, just lost the race.
  if (uploadError && !/duplicate/i.test(uploadError.message)) {
    throw new MediaError("storage_error", `Failed to upload media to storage: ${uploadError.message}`);
  }

  const { error: updateError } = await admin
    .from("messages")
    .update({ media_storage_path: path })
    .eq("id", message.id)
    .is("media_storage_path", null);

  if (updateError) {
    throw new MediaError("storage_error", `Failed to record media storage path: ${updateError.message}`);
  }

  return { path, reused: false };
}

export async function createMediaSignedUrl(admin: SupabaseClient<Database>, path: string): Promise<string> {
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    throw new MediaError("storage_error", `Failed to create signed URL: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}

export { MEDIA_BUCKET, SIGNED_URL_TTL_SECONDS };
