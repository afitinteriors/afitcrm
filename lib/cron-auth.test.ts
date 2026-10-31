import { describe, expect, it } from "vitest";
import { isValidCronSecret } from "@/lib/cron-auth";

const SECRET = "a".repeat(32);

describe("isValidCronSecret", () => {
  it("accepts the correct secret as a Bearer header", () => {
    expect(isValidCronSecret(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("accepts the correct secret with no Bearer prefix", () => {
    expect(isValidCronSecret(SECRET, SECRET)).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(isValidCronSecret(`Bearer ${"b".repeat(32)}`, SECRET)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isValidCronSecret(null, SECRET)).toBe(false);
  });

  it("rejects when no secret is configured", () => {
    expect(isValidCronSecret(`Bearer ${SECRET}`, undefined)).toBe(false);
  });

  it("rejects a different-length candidate without throwing", () => {
    expect(isValidCronSecret("Bearer short", SECRET)).toBe(false);
  });

  it("rejects an empty header", () => {
    expect(isValidCronSecret("", SECRET)).toBe(false);
  });
});
