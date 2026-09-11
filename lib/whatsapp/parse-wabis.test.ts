import { describe, it, expect } from "vitest";
import { parseWabisMessage, wabisPhoneNumberId } from "./parse-wabis";

// Shape verified against ONE real captured delivery (Vercel Preview
// function logs, 8 Sep 2026) from the Gypsum Plaster "Contact Collection"
// WABIS flow -- not invented, and not the same shape an earlier version of
// this parser assumed (that earlier shape was never actually verified).
const VALID_PAYLOAD = {
  first_name: "Test",
  chat_id: "919000000000",
  postbackid: "postback-abc123",
  user_input_data: [] as unknown[],
  user_message: "Hello",
  whatsapp_bot_username: "+91 7356877322",
};

function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const clone = { ...obj };
  delete clone[key];
  return clone;
}

describe("parseWabisMessage", () => {
  it("parses a valid real-shape payload", () => {
    const result = parseWabisMessage(VALID_PAYLOAD);
    expect(result).not.toBeNull();
    expect(result?.waMessageId).toBe("postback-abc123");
    expect(result?.fromPhone).toBe("919000000000"); // chat_id used as the phone identity
    expect(result?.phoneNumberId).toBe("wabis:+91 7356877322");
    expect(result?.customerName).toBe("Test");
    expect(result?.body).toBe("Hello");
    expect(result?.messageType).toBe("text");
    expect(result?.mediaId).toBeNull();
  });

  it("never invents Meta attribution", () => {
    const result = parseWabisMessage(VALID_PAYLOAD);
    expect(result?.referral).toBeNull();
    expect(result).not.toHaveProperty("campaign_id");
    expect(result).not.toHaveProperty("ad_id");
    expect(result).not.toHaveProperty("ctwa_clid");
  });

  it("does not extract or assume structure from user_input_data", () => {
    const result = parseWabisMessage(VALID_PAYLOAD) as unknown as Record<string, unknown>;
    expect(result).not.toHaveProperty("userInputData");
    expect(result).not.toHaveProperty("user_input_data");
  });

  it("rejects a non-object payload", () => {
    expect(parseWabisMessage(null)).toBeNull();
    expect(parseWabisMessage(undefined)).toBeNull();
    expect(parseWabisMessage("a string")).toBeNull();
    expect(parseWabisMessage(42)).toBeNull();
    expect(parseWabisMessage([])).toBeNull();
  });

  it("rejects a payload missing chat_id", () => {
    expect(parseWabisMessage(omit(VALID_PAYLOAD, "chat_id"))).toBeNull();
  });

  it("rejects a payload missing postbackid", () => {
    expect(parseWabisMessage(omit(VALID_PAYLOAD, "postbackid"))).toBeNull();
  });

  it("rejects a payload missing whatsapp_bot_username", () => {
    expect(parseWabisMessage(omit(VALID_PAYLOAD, "whatsapp_bot_username"))).toBeNull();
  });

  it("rejects empty-string identity fields", () => {
    expect(parseWabisMessage({ ...VALID_PAYLOAD, chat_id: "" })).toBeNull();
    expect(parseWabisMessage({ ...VALID_PAYLOAD, postbackid: "" })).toBeNull();
    expect(parseWabisMessage({ ...VALID_PAYLOAD, whatsapp_bot_username: "" })).toBeNull();
  });

  it("tolerates a missing first_name (customerName becomes null, not invented)", () => {
    const result = parseWabisMessage(omit(VALID_PAYLOAD, "first_name"));
    expect(result?.customerName).toBeNull();
  });

  it("tolerates a missing user_message (body becomes null)", () => {
    const result = parseWabisMessage(omit(VALID_PAYLOAD, "user_message"));
    expect(result?.body).toBeNull();
  });

  it("tolerates a non-empty user_input_data without reading into it", () => {
    const result = parseWabisMessage({ ...VALID_PAYLOAD, user_input_data: [{ some: "shape we've never seen" }] });
    expect(result).not.toBeNull();
    expect(result?.body).toBe("Hello");
  });

  it("always sets serviceHint to Gypsum Plaster (routing fact, not derived from payload content)", () => {
    const result = parseWabisMessage(VALID_PAYLOAD);
    expect(result?.serviceHint).toBe("Gypsum Plaster");

    // Confirms it's not derived from user_message text -- unrelated body,
    // same hint.
    const otherBody = parseWabisMessage({ ...VALID_PAYLOAD, user_message: "asking about something else entirely" });
    expect(otherBody?.serviceHint).toBe("Gypsum Plaster");
  });
});

describe("wabisPhoneNumberId", () => {
  it("derives a namespaced id from the confirmed whatsapp_bot_username", () => {
    expect(wabisPhoneNumberId("+91 7356877322")).toBe("wabis:+91 7356877322");
  });
});
