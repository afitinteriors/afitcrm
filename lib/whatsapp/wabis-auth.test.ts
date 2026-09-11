import { describe, it, expect } from "vitest";
import { isValidWabisSecret } from "./wabis-auth";

const SECRET = "a".repeat(48);

describe("isValidWabisSecret", () => {
  it("accepts a matching secret", () => {
    expect(isValidWabisSecret(SECRET, SECRET)).toBe(true);
  });

  it("rejects a non-matching secret of the same length", () => {
    expect(isValidWabisSecret("b".repeat(48), SECRET)).toBe(false);
  });

  it("rejects a secret of a different length", () => {
    expect(isValidWabisSecret("short", SECRET)).toBe(false);
  });

  it("rejects a missing candidate (route param absent)", () => {
    expect(isValidWabisSecret(undefined, SECRET)).toBe(false);
  });

  it("rejects a missing expected value (env var not configured)", () => {
    expect(isValidWabisSecret(SECRET, undefined)).toBe(false);
  });

  it("rejects an empty-string candidate", () => {
    expect(isValidWabisSecret("", SECRET)).toBe(false);
  });

  it("rejects when both are missing", () => {
    expect(isValidWabisSecret(undefined, undefined)).toBe(false);
  });
});
