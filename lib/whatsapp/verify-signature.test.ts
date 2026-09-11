import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyMetaSignature } from "./verify-signature";

// Regression coverage confirming the Meta webhook's own authentication is
// unaffected by Phase E (this file was not modified for the WABIS work).
describe("verifyMetaSignature (Meta webhook auth — unchanged by Phase E)", () => {
  const APP_SECRET = "test-app-secret";
  const BODY = JSON.stringify({ entry: [] });

  function sign(body: string, secret: string): string {
    return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
  }

  it("accepts a correctly signed body", () => {
    expect(verifyMetaSignature(BODY, sign(BODY, APP_SECRET), APP_SECRET)).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    expect(verifyMetaSignature(BODY, sign(BODY, "wrong-secret"), APP_SECRET)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyMetaSignature(BODY, null, APP_SECRET)).toBe(false);
  });

  it("rejects a signature without the sha256= prefix", () => {
    expect(verifyMetaSignature(BODY, "deadbeef", APP_SECRET)).toBe(false);
  });

  it("rejects a tampered body", () => {
    const validSignatureForOriginal = sign(BODY, APP_SECRET);
    expect(verifyMetaSignature(BODY + "tampered", validSignatureForOriginal, APP_SECRET)).toBe(false);
  });
});
