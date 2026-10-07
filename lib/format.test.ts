import { describe, it, expect } from "vitest";
import { firstInitial } from "./format";

// Regression coverage for the /conversations hydration bug (React error
// #418): name.charAt(0) reads the first UTF-16 code unit, not the first
// character, so a name starting with an emoji or other supplementary-plane
// character produces a lone surrogate -- which a server-rendered page and a
// client re-render of the same expression can end up representing
// differently. firstInitial() must never return a lone (unpaired) surrogate
// half for any input, real contact names included.
describe("firstInitial", () => {
  it("uppercases a plain ASCII name", () => {
    expect(firstInitial("sreekumar")).toBe("S");
  });

  it("handles a name that is already a single character", () => {
    expect(firstInitial("a")).toBe("A");
  });

  it("returns an empty string for an empty name", () => {
    expect(firstInitial("")).toBe("");
  });

  it("extracts a complete emoji (a surrogate pair), not a lone surrogate half", () => {
    const result = firstInitial("🙏🙏");
    // U+1F64F is a surrogate pair -- two UTF-16 code units. A correct
    // extraction returns exactly those two code units (one grapheme); the
    // buggy `charAt(0)` would return only the lone high surrogate "\ud83d".
    expect(result).toBe("🙏");
    expect(result.length).toBe(2);
    expect(result.charCodeAt(0)).toBeGreaterThanOrEqual(0xd800);
    expect(result.charCodeAt(0)).toBeLessThanOrEqual(0xdbff);
  });

  it("extracts the first full character from a name starting with a supplementary-plane mathematical letter", () => {
    // Real production example: "𝓥𝓲𝓷𝓸𝓭 𝓚 𝓚 𝓚𝓪𝓻𝓪" (U+1D4E5, also a surrogate pair).
    const result = firstInitial("𝓥𝓲𝓷𝓸𝓭");
    expect(result.length).toBe(2);
    expect(Array.from(result)).toHaveLength(1);
  });

  it("falls through to a plain BMP character when the emoji is not first", () => {
    expect(firstInitial("Achu❣️❣️❣️❣️❣️kashi")).toBe("A");
  });
});
