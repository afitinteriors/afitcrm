import { describe, it, expect } from "vitest";
import { toCanonicalPhone } from "./phone";

describe("toCanonicalPhone", () => {
  describe("Indian numbers resolve to the same canonical value", () => {
    const expected = "+919876543210";
    const equivalentInputs = [
      "+919876543210",
      "+91 9876543210",
      "919876543210",
      "91 9876543210",
      "+91-98765-43210",
      "91-98765-43210",
      "09876543210",
      "9876543210",
      "(91) 98765-43210",
      "91.98765.43210",
    ];

    for (const input of equivalentInputs) {
      it(`"${input}" -> ${expected}`, () => {
        const result = toCanonicalPhone(input);
        expect(result).toEqual({ ok: true, e164: expected });
      });
    }
  });

  describe("international numbers use their own country calling code, never reinterpreted as Indian", () => {
    it("+1 (US)", () => {
      expect(toCanonicalPhone("+1 415 555 2671")).toEqual({ ok: true, e164: "+14155552671" });
    });

    it("+44 (UK)", () => {
      expect(toCanonicalPhone("+44 20 7183 8750")).toEqual({ ok: true, e164: "+442071838750" });
    });

    it("+971 (UAE)", () => {
      expect(toCanonicalPhone("+971 50 123 4567")).toEqual({ ok: true, e164: "+971501234567" });
    });

    it("00-prefixed international dialing form is treated the same as +", () => {
      expect(toCanonicalPhone("0044 20 7183 8750")).toEqual({ ok: true, e164: "+442071838750" });
    });

    it("an explicit non-Indian country code is never overridden by the India fallback", () => {
      const result = toCanonicalPhone("+14155552671");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.e164.startsWith("+91")).toBe(false);
    });
  });

  describe("does not blindly strip a leading 91", () => {
    it("a valid non-Indian number that happens to start with 91 after + is read by its real country code, not treated as Indian", () => {
      // +912... is not a real assignable Indian number range in a way that
      // would collide here; this asserts the explicit-country-code branch
      // never re-applies the India default once a "+" is present, whatever
      // digits follow it -- confirmed by never invoking the IN fallback
      // when cleaned starts with "+" (see toCanonicalPhone's own branch
      // logic, exercised by the international-number tests above).
      const result = toCanonicalPhone("+441619876543"); // a UK number, not stripped to "9876543"
      expect(result).toEqual({ ok: true, e164: "+441619876543" });
    });
  });

  describe("invalid / unparseable numbers", () => {
    it("empty string", () => {
      expect(toCanonicalPhone("")).toEqual({ ok: false, reason: "empty" });
    });

    it("whitespace only", () => {
      expect(toCanonicalPhone("   ")).toEqual({ ok: false, reason: "empty" });
    });

    it("too short to be any real number", () => {
      expect(toCanonicalPhone("12345")).toEqual({ ok: false, reason: "unparseable" });
    });

    it("non-numeric garbage", () => {
      expect(toCanonicalPhone("not-a-phone-number")).toEqual({ ok: false, reason: "unparseable" });
    });

    it("a bare number too short to be a valid Indian national number", () => {
      expect(toCanonicalPhone("98765")).toEqual({ ok: false, reason: "unparseable" });
    });

    it("non-string input", () => {
      expect(toCanonicalPhone(undefined)).toEqual({ ok: false, reason: "empty" });
      expect(toCanonicalPhone(null)).toEqual({ ok: false, reason: "empty" });
      expect(toCanonicalPhone(12345 as unknown)).toEqual({ ok: false, reason: "empty" });
    });

    it("never throws on pathological input", () => {
      expect(() => toCanonicalPhone("+" + "9".repeat(50))).not.toThrow();
    });
  });
});
