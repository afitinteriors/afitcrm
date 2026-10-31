import { describe, expect, it } from "vitest";
import { isValidHermesApiKey } from "@/lib/hermes-auth";

const KEY = "a".repeat(32);

describe("isValidHermesApiKey", () => {
  it("accepts the correct key as a Bearer header", () => {
    expect(isValidHermesApiKey(`Bearer ${KEY}`, KEY)).toBe(true);
  });

  it("accepts the correct key with no Bearer prefix", () => {
    expect(isValidHermesApiKey(KEY, KEY)).toBe(true);
  });

  it("rejects a wrong key", () => {
    expect(isValidHermesApiKey(`Bearer ${"b".repeat(32)}`, KEY)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isValidHermesApiKey(null, KEY)).toBe(false);
  });

  it("rejects when no key is configured", () => {
    expect(isValidHermesApiKey(`Bearer ${KEY}`, undefined)).toBe(false);
  });

  it("rejects a different-length candidate without throwing", () => {
    expect(isValidHermesApiKey("Bearer short", KEY)).toBe(false);
  });

  it("rejects an empty header", () => {
    expect(isValidHermesApiKey("", KEY)).toBe(false);
  });
});
