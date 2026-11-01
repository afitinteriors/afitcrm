import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type ParsedTelegramUpdate = { chatId: string; username: string } | null;

// Pure: pulls just the two fields app/api/webhooks/telegram/route.ts needs
// out of Telegram's update payload (https://core.telegram.org/bots/api#update),
// without assuming more shape than it actually reads. Returns null for
// anything that isn't a private-chat text message with a username -- a
// bot/channel update, a message from a user with no @username set (the
// owner must know a member's exact username to type it into Settings, so a
// member with none can never match anyway), or a malformed body.
export function parseTelegramUpdate(payload: unknown): ParsedTelegramUpdate {
  if (!payload || typeof payload !== "object") return null;
  const update = payload as Record<string, unknown>;
  const message = update.message as Record<string, unknown> | undefined;
  if (!message || typeof message !== "object") return null;

  const chat = message.chat as Record<string, unknown> | undefined;
  const from = message.from as Record<string, unknown> | undefined;
  const chatId = chat?.id;
  const username = from?.username;

  if (typeof chatId !== "number" || typeof username !== "string" || username.length === 0) return null;
  return { chatId: String(chatId), username };
}

// Matches the message sender's username against profiles.telegram_username
// (case-insensitive, same as Telegram's own username matching -- usernames
// are case-insensitive on Telegram) and records their chat_id. No match is
// not an error: most messages to this bot are expected to be the one-time
// linking message from a known staff member, but a stranger finding the
// bot is not a failure case worth logging loudly.
export async function linkTelegramChat(supabase: SupabaseClient<Database>, update: NonNullable<ParsedTelegramUpdate>): Promise<boolean> {
  // Telegram's own `username` field never carries a leading "@", but
  // Settings' free-text entry (components/settings/TeamMemberFormModal.tsx)
  // never strips one if the owner typed it that way -- matching both forms
  // means linking doesn't silently fail over a cosmetic "@" difference.
  const { data, error } = await supabase
    .from("profiles")
    .update({ telegram_chat_id: update.chatId })
    .or(`telegram_username.ilike.${update.username},telegram_username.ilike.@${update.username}`)
    .select("id");

  if (error) {
    console.error("Failed to link Telegram chat_id:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}
