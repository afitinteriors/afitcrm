import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendTextMessage, sendMediaMessage, uploadMediaToMeta, SendMessageError } from "@/lib/whatsapp/send-message";
import { MEDIA_BUCKET } from "@/lib/whatsapp/media";

// The executor's only integration point for anything that would leave a
// WhatsApp message with the customer.

export interface OutboundSender {
  sendText(conversationId: string, text: string): Promise<void>;
  sendMedia(conversationId: string, mediaAssetId: string): Promise<void>;
}

export class OutboundSendingBlockedError extends Error {}

// Kept for reference/rollback -- no longer the default wired implementation
// as of this phase (see trigger.ts). Every method throws a clear, typed
// error rather than faking success.
export class BlockedOutboundSender implements OutboundSender {
  async sendText(): Promise<void> {
    throw new OutboundSendingBlockedError(
      "Automation-driven WhatsApp sending is not yet enabled. This flow reached a Send Text/Ask Question block, which will send once outbound sending is explicitly approved for automations."
    );
  }

  async sendMedia(): Promise<void> {
    throw new OutboundSendingBlockedError(
      "Automation-driven WhatsApp sending is not yet enabled. This flow reached a Send Image/Send Video block, which will send once outbound sending is explicitly approved for automations."
    );
  }
}

// Production sender, approved for text as of this phase. Reuses
// lib/whatsapp/send-message.ts's sendTextMessage() unmodified -- the same
// function already live for staff's manual replies in /conversations/-chat
// (lib/actions/messages.ts). This class only adds: (1) resolving the
// conversation's wa_id/phone_number_id by conversationId (the same
// per-action-lookup idiom already used by createOrLinkLeadForConversation/
// captureLeadField in crm-actions.ts, rather than threading these through
// ExecutionContext), and (2) persisting the resulting outbound message --
// which lib/automations/executor.ts's send_text/ask_question path never did
// on its own, unlike the human sendMessage action. Once that message row
// exists with its real wa_message_id, the existing, unmodified WhatsApp
// webhook status-callback code (app/api/webhooks/whatsapp/route.ts) picks
// it up automatically for delivered/read/failed updates -- no webhook
// change needed or made here.
//
// Constructed per automation execution with the caller's own service-role
// Supabase client (see trigger.ts) -- never a module-level singleton,
// since (unlike BlockedOutboundSender) it needs a real, request-scoped
// client to do its own lookups and writes.
export class RealOutboundSender implements OutboundSender {
  constructor(private supabase: SupabaseClient<Database>) {}

  async sendText(conversationId: string, text: string): Promise<void> {
    const { data: conversation, error: conversationError } = await this.supabase
      .from("conversations")
      .select("wa_id, phone_number_id")
      .eq("id", conversationId)
      .single();

    if (conversationError || !conversation) {
      throw new Error(
        `Failed to look up conversation for outbound send: ${conversationError?.message ?? "not found"}`
      );
    }

    // Throws SendMessageError on any failure (not_configured / outside_window
    // / meta_api_error) -- not caught here, so it propagates uncaught exactly
    // like any other node's failure (see executor.ts/trigger.ts). No message
    // row is ever inserted for a send Meta rejected.
    const result = await sendTextMessage(conversation.phone_number_id, conversation.wa_id, text);

    // Meta has already accepted and sent the message by this point -- from
    // here on we're only recording it, not deciding whether to send it.
    // Same convention as the human sendMessage path.
    const { error: insertError } = await this.supabase.from("messages").insert({
      conversation_id: conversationId,
      wa_message_id: result.waMessageId,
      direction: "outbound",
      message_type: "text",
      body: text,
      status: "sent",
    });

    if (insertError) {
      // The message cannot be un-sent. This is the same accepted "sent but
      // recording failed" risk already present in the human sendMessage
      // path, not a new one introduced here -- but the caller must still
      // treat this as a failed step (the run/session are marked failed),
      // since the outbound history is now missing this message and its
      // wa_message_id, which is what the existing status-callback webhook
      // needs to find it.
      throw new Error(
        `Message was sent by Meta (wa_message_id: ${result.waMessageId}) but saving it to the conversation failed: ${insertError.message}`
      );
    }
  }

  // Sends an image/video asset from the automation_media library. Media
  // MVP (approved architecture, 2026-09-01): lazy upload on first send,
  // cache the returned Meta media id on the asset row, transparently
  // re-upload and retry once if a *cached* id is rejected (Meta media ids
  // expire after 30 days per Meta's own docs, and Meta gives no distinct
  // error code for "expired id" vs. other media-send problems -- so any
  // meta_api_error while using a cached id is treated as a signal to
  // retry fresh, bounded to exactly one retry so a genuinely bad file
  // fails closed after one extra round trip rather than looping).
  async sendMedia(conversationId: string, mediaAssetId: string): Promise<void> {
    const { data: conversation, error: conversationError } = await this.supabase
      .from("conversations")
      .select("wa_id, phone_number_id")
      .eq("id", conversationId)
      .single();

    if (conversationError || !conversation) {
      throw new Error(
        `Failed to look up conversation for outbound send: ${conversationError?.message ?? "not found"}`
      );
    }

    const { data: asset, error: assetError } = await this.supabase
      .from("automation_media")
      .select("media_type, mime_type, storage_path, meta_media_id")
      .eq("id", mediaAssetId)
      .single();

    if (assetError || !asset) {
      throw new Error(`Media asset not found (${mediaAssetId}): ${assetError?.message ?? "not found"}`);
    }

    let mediaId = asset.meta_media_id;
    const usedCachedId = Boolean(mediaId);

    if (!mediaId) {
      mediaId = await this.uploadAssetToMeta(conversation.phone_number_id, asset, mediaAssetId);
    }

    let result;
    try {
      result = await sendMediaMessage(conversation.phone_number_id, conversation.wa_id, asset.media_type, mediaId);
    } catch (err) {
      if (usedCachedId && err instanceof SendMessageError && err.code === "meta_api_error") {
        // Self-healing retry: the cached media id may have expired or
        // been rejected -- upload the same bytes fresh and try once more.
        mediaId = await this.uploadAssetToMeta(conversation.phone_number_id, asset, mediaAssetId);
        result = await sendMediaMessage(conversation.phone_number_id, conversation.wa_id, asset.media_type, mediaId);
      } else {
        throw err;
      }
    }

    // Meta has already accepted and sent the message by this point -- from
    // here on we're only recording it, same convention as sendText.
    const { error: insertError } = await this.supabase.from("messages").insert({
      conversation_id: conversationId,
      wa_message_id: result.waMessageId,
      direction: "outbound",
      message_type: asset.media_type,
      media_id: mediaId,
      media_storage_path: asset.storage_path,
      status: "sent",
    });

    if (insertError) {
      throw new Error(
        `Message was sent by Meta (wa_message_id: ${result.waMessageId}) but saving it to the conversation failed: ${insertError.message}`
      );
    }
  }

  // Downloads the asset's bytes from the whatsapp-media bucket, uploads
  // them to Meta to obtain a fresh media id, and caches that id on the
  // automation_media row for reuse by future sends. Used both for a
  // never-yet-sent asset and for the self-healing retry above.
  private async uploadAssetToMeta(
    phoneNumberId: string,
    asset: { mime_type: string; storage_path: string },
    mediaAssetId: string
  ): Promise<string> {
    const { data: fileBlob, error: downloadError } = await this.supabase.storage
      .from(MEDIA_BUCKET)
      .download(asset.storage_path);

    if (downloadError || !fileBlob) {
      throw new Error(`Failed to read media asset from storage: ${downloadError?.message ?? "not found"}`);
    }

    const bytes = Buffer.from(await fileBlob.arrayBuffer());
    const { mediaId } = await uploadMediaToMeta(phoneNumberId, bytes, asset.mime_type);

    const { error: updateError } = await this.supabase
      .from("automation_media")
      .update({ meta_media_id: mediaId, updated_at: new Date().toISOString() })
      .eq("id", mediaAssetId);

    if (updateError) {
      // Not fatal -- the upload itself succeeded and mediaId is usable for
      // this send. The next send will simply upload fresh again instead of
      // reusing a cached id, which is safe (self-healing path handles the
      // same shape of retry) just not optimal. Log, don't throw.
      console.error("Failed to cache Meta media id on automation_media:", updateError.message);
    }

    return mediaId;
  }
}
