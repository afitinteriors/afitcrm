import { describe, expect, it } from "vitest";
import {
  BUSINESS_TZ,
  businessDate,
  businessDateOf,
  businessDatePlusDays,
  parseBusinessDateTime,
  toBusinessDateTimeLocal,
} from "@/lib/business-time";
import { formatDate, formatDateTime } from "@/lib/format";

describe("business time zone", () => {
  it("is Asia/Kolkata", () => {
    expect(BUSINESS_TZ).toBe("Asia/Kolkata");
  });
});

describe("parseBusinessDateTime -- entered wall-clock time means IST", () => {
  it("A/C: 11:00 IST is the instant 05:30Z, independent of the server or browser zone", () => {
    expect(parseBusinessDateTime("2026-10-05T11:00")?.toISOString()).toBe("2026-10-05T05:30:00.000Z");
  });

  it("accepts seconds and trims", () => {
    expect(parseBusinessDateTime(" 2026-10-05T11:00:30 ")?.toISOString()).toBe("2026-10-05T05:30:30.000Z");
  });

  it("rejects malformed and impossible values", () => {
    for (const bad of ["", "garbage", "2026-10-05", "2026-10-05 11:00", "2026-02-31T10:00", "2026-10-05T25:00", "2026-13-01T10:00"]) {
      expect(parseBusinessDateTime(bad)).toBeNull();
    }
  });

  it("does not depend on the process time zone", () => {
    const original = process.env.TZ;
    for (const tz of ["UTC", "America/Los_Angeles", "Pacific/Auckland"]) {
      process.env.TZ = tz;
      expect(parseBusinessDateTime("2026-10-05T11:00")?.toISOString()).toBe("2026-10-05T05:30:00.000Z");
    }
    process.env.TZ = original;
  });
});

describe("toBusinessDateTimeLocal -- prefill", () => {
  it("B: shows the stored instant as IST wall-clock time", () => {
    expect(toBusinessDateTimeLocal("2026-10-05T05:30:00.000Z")).toBe("2026-10-05T11:00");
    expect(toBusinessDateTimeLocal("2026-10-05T05:30:00+00:00")).toBe("2026-10-05T11:00");
  });

  it("returns empty for null/invalid", () => {
    expect(toBusinessDateTimeLocal(null)).toBe("");
    expect(toBusinessDateTimeLocal(undefined)).toBe("");
    expect(toBusinessDateTimeLocal("nope")).toBe("");
  });

  it("repeated edit -> save cycles never drift", () => {
    let stored = parseBusinessDateTime("2026-10-05T11:00")!.toISOString();
    for (let i = 0; i < 5; i += 1) {
      const prefill = toBusinessDateTimeLocal(stored);
      expect(prefill).toBe("2026-10-05T11:00");
      stored = parseBusinessDateTime(prefill)!.toISOString();
      expect(stored).toBe("2026-10-05T05:30:00.000Z");
    }
  });
});

describe("D: business-day bucketing uses IST, not UTC", () => {
  it("00:30 IST belongs to the IST day, which is the previous UTC day", () => {
    const instant = parseBusinessDateTime("2026-10-05T00:30")!;
    expect(instant.toISOString()).toBe("2026-10-04T19:00:00.000Z");
    expect(businessDateOf(instant.toISOString())).toBe("2026-10-05");
    expect(instant.toISOString().slice(0, 10)).toBe("2026-10-04"); // what the old code compared
  });

  it("23:30 IST stays on the same IST day", () => {
    expect(businessDateOf(parseBusinessDateTime("2026-10-05T23:30")!.toISOString())).toBe("2026-10-05");
  });

  it("'today' rolls over at IST midnight (18:30Z), not UTC midnight", () => {
    expect(businessDate(new Date("2026-10-04T18:29:59Z"))).toBe("2026-10-04");
    expect(businessDate(new Date("2026-10-04T18:30:00Z"))).toBe("2026-10-05");
  });

  it("businessDateOf ignores unparsable input", () => {
    expect(businessDateOf("nope")).toBeNull();
  });
});

describe("businessDatePlusDays -- the 7-day window", () => {
  it("counts from the IST day, not the UTC day", () => {
    // 2026-09-21T19:00Z is 00:30 IST on the 22nd: +7 is the 29th (UTC-based math gave the 28th).
    expect(businessDatePlusDays(7, new Date("2026-09-21T19:00:00Z"))).toBe("2026-09-29");
    expect(businessDatePlusDays(7, new Date("2026-09-21T18:00:00Z"))).toBe("2026-09-28"); // 23:30 IST on the 21st
  });

  it("rolls over month and year boundaries", () => {
    expect(businessDatePlusDays(7, new Date("2026-12-27T20:00:00Z"))).toBe("2027-01-04");
    expect(businessDatePlusDays(0, new Date("2026-09-21T19:00:00Z"))).toBe("2026-09-22");
  });
});

describe("display formatting is in IST", () => {
  it("shows a 05:30Z visit as 11:00 am", () => {
    expect(formatDateTime("2026-10-05T05:30:00.000Z")).toMatch(/05 Oct 2026,? 11:00 am/i);
  });

  it("formatDate uses the IST day for an instant just after UTC midnight", () => {
    // 2026-10-04T19:00Z is 00:30 IST on the 5th.
    expect(formatDate("2026-10-04T19:00:00Z")).toBe(formatDate("2026-10-05T05:00:00Z"));
  });

  it("H: date-only follow-up due dates render unchanged", () => {
    expect(formatDate("2026-09-25")).toMatch(/^25 Sept? 2026$/);
    expect(formatDate("2026-09-25")).toBe(formatDate("2026-09-25T00:00:00Z"));
  });
});
