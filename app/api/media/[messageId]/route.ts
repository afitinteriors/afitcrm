import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import {
  MediaError,
  canAccessConversationMedia,
  createMediaSignedUrl,
  extractOriginalFilename,
  resolveMediaStoragePath,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/whatsapp/media";

// Needs the Node.js runtime for node:crypto (SHA-256 verification in media.ts).
export const runtime = "nodejs";

// Returns a short-lived signed URL for a message's WhatsApp media, downloading
// it from Meta on first request and reusing the stored copy afterwards.
// Authorization follows the same lead-ownership model as leads/conversations:
// admin can access any message, staff only messages whose conversation is
// linked to a lead assigned to them.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messageId } = await params;
  const admin = createAdminClient();

  const { data: message, error: messageError } = await admin
    .from("messages")
    .select("id, conversation_id, media_id, media_storage_path, message_type, raw_payload")
    .eq("id", messageId)
    .maybeSingle();

  if (messageError || !message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!message.media_id) {
    return NextResponse.json({ error: "Message has no media" }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .select("id, lead_id")
    .eq("id", message.conversation_id)
    .maybeSingle();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let leadAssignedToId: string | null = null;
  if (conversation.lead_id) {
    const { data: lead } = await admin
      .from("leads")
      .select("assigned_to_id")
      .eq("id", conversation.lead_id)
      .maybeSingle();
    leadAssignedToId = lead?.assigned_to_id ?? null;
  }

  if (!canAccessConversationMedia(profile, conversation.lead_id, leadAssignedToId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { path } = await resolveMediaStoragePath(admin, message);
    const filename = extractOriginalFilename(message.message_type, message.raw_payload);
    const url = await createMediaSignedUrl(admin, path, filename);
    return NextResponse.json({ url, expiresIn: SIGNED_URL_TTL_SECONDS });
  } catch (err) {
    if (err instanceof MediaError) {
      console.error(`Media download failed (${err.code}) for message ${message.id}:`, err.message);
      return NextResponse.json({ error: err.publicMessage }, { status: err.status });
    }
    console.error("Unexpected media download error:", err);
    return NextResponse.json({ error: "Media unavailable" }, { status: 500 });
  }
}
