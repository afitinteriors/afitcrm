import { describe, expect, it } from "vitest";
import { isOptOutMessage } from "./opt-out";

describe("isOptOutMessage -- R-MSG-002 (docs/BLUEPRINT_V1.md Section 8)", () => {
  it("matches a bare 'stop', case-insensitive and trimmed", () => {
    expect(isOptOutMessage("stop")).toBe(true);
    expect(isOptOutMessage("STOP")).toBe(true);
    expect(isOptOutMessage("Stop")).toBe(true);
    expect(isOptOutMessage("  stop  ")).toBe(true);
  });

  it("does NOT match stop as part of a real sentence (exact match only, to avoid false positives)", () => {
    expect(isOptOutMessage("please don't stop the work")).toBe(false);
    expect(isOptOutMessage("stop sending so many messages please")).toBe(false);
    expect(isOptOutMessage("when will the work stop")).toBe(false);
  });

  it("does not match unrelated text, empty, or null/undefined", () => {
    expect(isOptOutMessage("hello")).toBe(false);
    expect(isOptOutMessage("")).toBe(false);
    expect(isOptOutMessage(null)).toBe(false);
    expect(isOptOutMessage(undefined)).toBe(false);
  });
});
