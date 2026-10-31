// R-QUOTE-002 (docs/BLUEPRINT_V1.md Section 8): pure discount math, shared
// by lib/actions/quotations.ts (the enforcement) and the UI (the display).
// Measured against a quotation's own version 1 -- see
// supabase/migrations/20261031140000_quotations_discount_approval.sql for
// why there's no independent "list price" to discount from instead.

// A price INCREASE (or no change) is never a "discount" -- floors at 0
// rather than returning a negative percentage.
export function discountPercent(v1Amount: number, currentAmount: number): number {
  if (!(v1Amount > 0)) return 0;
  const percent = ((v1Amount - currentAmount) / v1Amount) * 100;
  return percent > 0 ? percent : 0;
}

export function needsDiscountApproval(pct: number, limitPercent: number): boolean {
  return pct > limitPercent;
}
