import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { parseTelegramUpdate, linkTelegramChat } from "./telegram-chat-link";

describe("parseTelegramUpdate", () => {
  it("extracts chatId and username from a real-shaped update", () => {
    const update = {
      update_id: 1,
      message: { message_id: 1, chat: { id: 555, type: "private" }, from: { id: 555, username: "azhar_afit" }, date: 1, text: "/start" },
    };
    expect(parseTelegramUpdate(update)).toEqual({ chatId: "555", username: "azhar_afit" });
  });

  it("returns null when the sender has no username", () => {
    const update = { message: { chat: { id: 555 }, from: { id: 555 }, text: "hi" } };
    expect(parseTelegramUpdate(update)).toBeNull();
  });

  it("returns null for an update with no message (e.g. a channel post)", () => {
    expect(parseTelegramUpdate({ update_id: 1, channel_post: { chat: { id: 1 } } })).toBeNull();
  });

  it("returns null for malformed input without throwing", () => {
    expect(parseTelegramUpdate(null)).toBeNull();
    expect(parseTelegramUpdate("not an object")).toBeNull();
    expect(parseTelegramUpdate({})).toBeNull();
    expect(parseTelegramUpdate({ message: {} })).toBeNull();
  });
});

describe("linkTelegramChat", () => {
  it("matches telegram_username case-insensitively and with or without a leading @", async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: "profile-1" }], error: null });
    const or = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ or });
    const from = vi.fn().mockReturnValue({ update });
    const supabase = { from } as unknown as SupabaseClient<Database>;

    const linked = await linkTelegramChat(supabase, { chatId: "555", username: "Azhar_Afit" });

    expect(linked).toBe(true);
    expect(update).toHaveBeenCalledWith({ telegram_chat_id: "555" });
    expect(or).toHaveBeenCalledWith("telegram_username.ilike.Azhar_Afit,telegram_username.ilike.@Azhar_Afit");
  });

  it("returns false when no profile matches", async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = { from: () => ({ update: () => ({ or: () => ({ select }) }) }) } as unknown as SupabaseClient<Database>;

    expect(await linkTelegramChat(supabase, { chatId: "555", username: "stranger" })).toBe(false);
  });

  it("returns false (not throws) on a database error", async () => {
    const select = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const supabase = { from: () => ({ update: () => ({ or: () => ({ select }) }) }) } as unknown as SupabaseClient<Database>;

    expect(await linkTelegramChat(supabase, { chatId: "555", username: "azhar" })).toBe(false);
  });
});
