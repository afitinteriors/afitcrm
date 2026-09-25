import { describe, it, expect } from "vitest";
import { parseWabisMessage, wabisPhoneNumberId, WABIS_NEW_LEAD_ASSIGNEE_ID } from "./parse-wabis";

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

  it("rejects a payload missing whatsapp_bot_username", () => {
    expect(parseWabisMessage(omit(VALID_PAYLOAD, "whatsapp_bot_username"))).toBeNull();
  });

  it("rejects empty-string required identity fields (chat_id, whatsapp_bot_username)", () => {
    expect(parseWabisMessage({ ...VALID_PAYLOAD, chat_id: "" })).toBeNull();
    expect(parseWabisMessage({ ...VALID_PAYLOAD, whatsapp_bot_username: "" })).toBeNull();
  });

  // postbackid is an optional idempotency key, not a required identity
  // field -- a real production delivery showed it can arrive missing or
  // empty, and neither should invalidate an otherwise-valid payload. When
  // it's absent, a deterministic content-derived key takes its place (see
  // parse-wabis.ts's deterministicFallbackMessageId) so message-level dedup
  // still works -- these messages must never end up with a null/absent
  // idempotency key again.
  it("tolerates a missing postbackid (payload still valid, gets a deterministic fallback waMessageId)", () => {
    const result = parseWabisMessage(omit(VALID_PAYLOAD, "postbackid"));
    expect(result).not.toBeNull();
    expect(result?.waMessageId).not.toBeNull();
    expect(result?.waMessageId).toMatch(/^wabis-fallback:[0-9a-f]{64}$/);
    // The rest of the payload is still parsed normally.
    expect(result?.fromPhone).toBe("919000000000");
    expect(result?.phoneNumberId).toBe("wabis:+91 7356877322");
  });

  it("tolerates an empty-string postbackid (gets the same kind of deterministic fallback)", () => {
    const result = parseWabisMessage({ ...VALID_PAYLOAD, postbackid: "" });
    expect(result).not.toBeNull();
    expect(result?.waMessageId).toMatch(/^wabis-fallback:[0-9a-f]{64}$/);
  });

  it("tolerates a wrong-type postbackid (treated as absent, gets the deterministic fallback)", () => {
    const result = parseWabisMessage({ ...VALID_PAYLOAD, postbackid: 12345 });
    expect(result).not.toBeNull();
    expect(result?.waMessageId).toMatch(/^wabis-fallback:[0-9a-f]{64}$/);
  });

  it("uses a non-empty postbackid as waMessageId / idempotency key unchanged when present", () => {
    const result = parseWabisMessage(VALID_PAYLOAD);
    expect(result?.waMessageId).toBe("postback-abc123");
  });

  describe("deterministic fallback waMessageId (empty/missing postbackid)", () => {
    it("the same redelivered payload produces the exact same fallback key (real duplicate-delivery dedup)", () => {
      const payload = { ...VALID_PAYLOAD, postbackid: "" };
      const first = parseWabisMessage(payload);
      const second = parseWabisMessage({ ...payload }); // a fresh object, same content -- simulates a retry
      expect(first?.waMessageId).not.toBeNull();
      expect(first?.waMessageId).toBe(second?.waMessageId);
    });

    it("two genuinely different messages (different text) do not collide", () => {
      const a = parseWabisMessage({ ...VALID_PAYLOAD, postbackid: "", user_message: "Hello" });
      const b = parseWabisMessage({ ...VALID_PAYLOAD, postbackid: "", user_message: "Something else entirely" });
      expect(a?.waMessageId).not.toBe(b?.waMessageId);
    });

    it("two genuinely different senders (different chat_id) do not collide", () => {
      const a = parseWabisMessage({ ...VALID_PAYLOAD, postbackid: "", chat_id: "919000000000" });
      const b = parseWabisMessage({ ...VALID_PAYLOAD, postbackid: "", chat_id: "919111111111" });
      expect(a?.waMessageId).not.toBe(b?.waMessageId);
    });

    it("never collides with the real-postbackid path's own waMessageId", () => {
      const withRealId = parseWabisMessage(VALID_PAYLOAD);
      const withFallback = parseWabisMessage({ ...VALID_PAYLOAD, postbackid: "" });
      expect(withRealId?.waMessageId).not.toBe(withFallback?.waMessageId);
      expect(withFallback?.waMessageId?.startsWith("wabis-fallback:")).toBe(true);
      expect(withRealId?.waMessageId?.startsWith("wabis-fallback:")).toBe(false);
    });
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

  it("always sets defaultAssigneeId to Azhar Vahab's profile id (routing fact, never read from the payload)", () => {
    expect(WABIS_NEW_LEAD_ASSIGNEE_ID).toBe("243a2241-848e-4209-8712-8636de4835dd");
    expect(parseWabisMessage(VALID_PAYLOAD)?.defaultAssigneeId).toBe(WABIS_NEW_LEAD_ASSIGNEE_ID);

    // A payload field with a lookalike name can't override it.
    const spoofed = parseWabisMessage({ ...VALID_PAYLOAD, defaultAssigneeId: "attacker", assigned_to_id: "attacker" });
    expect(spoofed?.defaultAssigneeId).toBe(WABIS_NEW_LEAD_ASSIGNEE_ID);
  });
});

describe("wabisPhoneNumberId", () => {
  it("derives a namespaced id from the confirmed whatsapp_bot_username", () => {
    expect(wabisPhoneNumberId("+91 7356877322")).toBe("wabis:+91 7356877322");
  });
});
