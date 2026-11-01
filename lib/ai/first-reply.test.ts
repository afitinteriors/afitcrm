import { describe, it, expect, vi, beforeEach } from "vitest";

const generateReplyMock = vi.fn();
vi.mock("@/lib/ai/gemini", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/gemini")>("@/lib/ai/gemini");
  return { ...actual, generateReply: (...args: unknown[]) => generateReplyMock(...args) };
});

import { draftFirstReply } from "./first-reply";
import { GeminiError } from "@/lib/ai/gemini";

describe("draftFirstReply", () => {
  beforeEach(() => {
    generateReplyMock.mockReset();
  });

  it("returns null (skips silently) when Gemini is not configured", async () => {
    generateReplyMock.mockRejectedValue(new GeminiError("not_configured", "x"));

    const result = await draftFirstReply({ service_required: "Gypsum", project_type: null, location: null, estimated_sqft: null, expected_start_date: null, messageBody: "hi" });

    expect(result).toBeNull();
  });

  it("propagates a real API error instead of swallowing it", async () => {
    generateReplyMock.mockRejectedValue(new GeminiError("gemini_api_error", "boom"));

    await expect(
      draftFirstReply({ service_required: null, project_type: null, location: null, estimated_sqft: null, expected_start_date: null, messageBody: "hi" }),
    ).rejects.toThrow("boom");
  });

  it("asks about the first missing field, includes the message body and known fields in the prompt, trims the result", async () => {
    generateReplyMock.mockResolvedValue("  Sure, could you share the site location?  ");

    const result = await draftFirstReply({
      service_required: "Gypsum plastering",
      project_type: "Residential",
      location: null,
      estimated_sqft: 1200,
      expected_start_date: null,
      messageBody: "chuvar smooth aakkanam",
    });

    expect(result).toEqual({ text: "Sure, could you share the site location?", field: "location" });
    const [systemInstruction, userText] = generateReplyMock.mock.calls[0];
    expect(systemInstruction).toContain("Never quote a final price");
    expect(userText).toContain("Gypsum plastering");
    expect(userText).toContain("size: 1200");
    expect(userText).toContain("chuvar smooth aakkanam");
  });

  it("returns null once every qualification field is already known", async () => {
    const result = await draftFirstReply({
      service_required: "Gypsum plastering",
      project_type: "Residential",
      location: "Kollam",
      estimated_sqft: 1200,
      expected_start_date: "next month",
      messageBody: "hi",
    });

    expect(result).toBeNull();
    expect(generateReplyMock).not.toHaveBeenCalled();
  });

  it("describes nothing known when no fields are set", async () => {
    generateReplyMock.mockResolvedValue("ok");

    await draftFirstReply({ service_required: null, project_type: null, location: null, estimated_sqft: null, expected_start_date: null, messageBody: "hi" });

    const [, userText] = generateReplyMock.mock.calls[0];
    expect(userText).toContain("Nothing confirmed yet.");
  });
});
