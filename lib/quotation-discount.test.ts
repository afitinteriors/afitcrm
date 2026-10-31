import { describe, expect, it } from "vitest";
import { discountPercent, needsDiscountApproval } from "./quotation-discount";

describe("discountPercent -- R-QUOTE-002 (docs/BLUEPRINT_V1.md Section 8)", () => {
  it("computes the percentage drop from v1", () => {
    expect(discountPercent(100000, 95000)).toBeCloseTo(5, 5);
    expect(discountPercent(100000, 92000)).toBeCloseTo(8, 5);
    expect(discountPercent(50000, 50000)).toBe(0);
  });

  it("floors at 0 for a price increase -- never a negative discount", () => {
    expect(discountPercent(100000, 110000)).toBe(0);
  });

  it("returns 0 when v1Amount is zero or negative (nothing sane to divide by)", () => {
    expect(discountPercent(0, 5000)).toBe(0);
    expect(discountPercent(-1, 5000)).toBe(0);
  });
});

describe("needsDiscountApproval", () => {
  it("is false at or below the limit, true strictly above it", () => {
    expect(needsDiscountApproval(5, 5)).toBe(false);
    expect(needsDiscountApproval(4.99, 5)).toBe(false);
    expect(needsDiscountApproval(5.01, 5)).toBe(true);
    expect(needsDiscountApproval(8, 5)).toBe(true);
  });

  it("matches the blueprint's own worked example: limit 5%, 8% needs approval", () => {
    const pct = discountPercent(100000, 92000); // 8%
    expect(needsDiscountApproval(pct, 5)).toBe(true);
  });
});
