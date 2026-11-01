import { describe, it, expect, vi, beforeEach } from "vitest";

const generateReplyMock = vi.fn();
const generateStructuredMock = vi.fn();
vi.mock("@/lib/ai/gemini", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/gemini")>("@/lib/ai/gemini");
  return {
    ...actual,
    generateReply: (...args: unknown[]) => generateReplyMock(...args),
    generateStructured: (...args: unknown[]) => generateStructuredMock(...args),
  };
});

import { nextMissingField, draftQuestion, extractAnswer, formatConfirmationSummary, classifyConfirmation, describeKnownFields } from "./qualification";
import { GeminiError } from "@/lib/ai/gemini";

beforeEach(() => {
  generateReplyMock.mockReset();
  generateStructuredMock.mockReset();
});

describe("nextMissingField", () => {
  it("returns fields in fixed priority order", () => {
    expect(nextMissingField({})).toBe("location");
    expect(nextMissingField({ location: "Kollam" })).toBe("estimated_sqft");
    expect(nextMissingField({ location: "Kollam", estimated_sqft: 1200 })).toBe("project_type");
    expect(nextMissingField({ location: "Kollam", estimated_sqft: 1200, project_type: "New" })).toBe("expected_start_date");
  });

  it("returns null once every field is known", () => {
    expect(nextMissingField({ location: "Kollam", estimated_sqft: 1200, project_type: "New", expected_start_date: "next month" })).toBeNull();
  });
});

describe("draftQuestion", () => {
  it("returns null when Gemini is not configured", async () => {
    generateReplyMock.mockRejectedValue(new GeminiError("not_configured", "x"));
    expect(await draftQuestion("location", "Nothing confirmed yet.", "hi")).toBeNull();
  });

  it("propagates a real API error", async () => {
    generateReplyMock.mockRejectedValue(new GeminiError("gemini_api_error", "boom"));
    await expect(draftQuestion("location", "Nothing confirmed yet.", "hi")).rejects.toThrow("boom");
  });

  it("asks about exactly the given field", async () => {
    generateReplyMock.mockResolvedValue("Where is the site located?");
    const result = await draftQuestion("location", "Service: Gypsum", "I need plastering");
    expect(result).toBe("Where is the site located?");
    const [, userText] = generateReplyMock.mock.calls[0];
    expect(userText).toContain("Ask for the site location");
    expect(userText).toContain("Service: Gypsum");
    expect(userText).toContain("I need plastering");
  });
});

describe("extractAnswer", () => {
  it("returns null when Gemini is not configured", async () => {
    generateStructuredMock.mockRejectedValue(new GeminiError("not_configured", "x"));
    expect(await extractAnswer("location", "Kollam")).toBeNull();
  });

  it("returns the extracted value when the customer answers", async () => {
    generateStructuredMock.mockResolvedValue({ answered: true, value: "Kollam" });
    expect(await extractAnswer("location", "it's in Kollam")).toEqual({ answered: true, value: "Kollam" });
  });

  it("returns answered:false when the reply doesn't answer the question", async () => {
    generateStructuredMock.mockResolvedValue({ answered: false, value: "" });
    expect(await extractAnswer("location", "how much will it cost?")).toEqual({ answered: false });
  });
});

describe("formatConfirmationSummary", () => {
  it("builds a deterministic summary from known fields, matching Section 6's worked example shape", () => {
    const summary = formatConfirmationSummary("Gypsum plastering", { estimated_sqft: "1500", location: "Kollam", expected_start_date: "next month" });
    expect(summary).toBe("Gypsum plastering, about 1500 sqft, Kollam, starting next month. Is that right?");
  });

  it("omits fields that weren't collected", () => {
    expect(formatConfirmationSummary(null, { location: "Kollam" })).toBe("Kollam. Is that right?");
  });
});

describe("classifyConfirmation", () => {
  it("returns null when Gemini is not configured", async () => {
    generateStructuredMock.mockRejectedValue(new GeminiError("not_configured", "x"));
    expect(await classifyConfirmation("yes")).toBeNull();
  });

  it("returns true for a clear yes", async () => {
    generateStructuredMock.mockResolvedValue({ confirmed: true });
    expect(await classifyConfirmation("yes that's right")).toBe(true);
  });

  it("returns false for anything short of a clear yes", async () => {
    generateStructuredMock.mockResolvedValue({ confirmed: false });
    expect(await classifyConfirmation("no, it's actually 2000 sqft")).toBe(false);
  });
});

describe("describeKnownFields", () => {
  it("lists the service and every known field", () => {
    expect(describeKnownFields("Gypsum", { location: "Kollam", estimated_sqft: 1200 })).toBe("Service: Gypsum; location: Kollam; size: 1200");
  });

  it("falls back to a fixed phrase when nothing is known", () => {
    expect(describeKnownFields(null, {})).toBe("Nothing confirmed yet.");
  });
});
