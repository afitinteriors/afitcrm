import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateReply, generateStructured, GeminiError } from "./gemini";

describe("generateReply", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
    process.env.GEMINI_MODEL = originalModel;
    global.fetch = originalFetch;
  });

  it("throws not_configured before any network call when the key is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as never;

    await expect(generateReply("system", "user")).rejects.toMatchObject({ code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("with a configured key", () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY = "test-gemini-key";
      delete process.env.GEMINI_MODEL;
    });

    it("POSTs to the default model with the x-goog-api-key header, system_instruction and contents", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "Hello" }] } }] }) });
      global.fetch = fetchMock as never;

      const result = await generateReply("You are helpful.", "Hi there");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "x-goog-api-key": "test-gemini-key" }),
          body: JSON.stringify({
            system_instruction: { parts: [{ text: "You are helpful." }] },
            contents: [{ parts: [{ text: "Hi there" }] }],
            generationConfig: { maxOutputTokens: 400 },
          }),
        }),
      );
      expect(result).toBe("Hello");
    });

    it("uses GEMINI_MODEL when set", async () => {
      process.env.GEMINI_MODEL = "gemini-custom";
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "x" }] } }] }) });
      global.fetch = fetchMock as never;

      await generateReply("s", "u");

      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("gemini-custom"), expect.anything());
    });

    it("joins multiple text parts in the response", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "Hello " }, { text: "there" }] } }] }) }) as never;

      expect(await generateReply("s", "u")).toBe("Hello there");
    });

    it("throws gemini_api_error with the API's own message on a non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { message: "Invalid API key" } }) }) as never;

      await expect(generateReply("s", "u")).rejects.toMatchObject({ code: "gemini_api_error", message: expect.stringContaining("Invalid API key") });
    });

    it("falls back to the HTTP status when the error body isn't JSON", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("not json"); } }) as never;

      await expect(generateReply("s", "u")).rejects.toThrow(GeminiError);
    });

    it("throws empty_response when there's no text in the candidates", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) }) as never;

      await expect(generateReply("s", "u")).rejects.toMatchObject({ code: "empty_response" });
    });
  });
});

describe("generateStructured", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  const SCHEMA = { type: "OBJECT" as const, properties: { answered: { type: "BOOLEAN" as const }, value: { type: "STRING" as const } }, required: ["answered", "value"] };

  it("sends responseMimeType/responseSchema and parses the JSON response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"answered":true,"value":"Kollam"}' }] } }] }) });
    global.fetch = fetchMock as never;

    const result = await generateStructured<{ answered: boolean; value: string }>("system", "user", SCHEMA);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse((options as { body: string }).body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema).toEqual(SCHEMA);
    expect(result).toEqual({ answered: true, value: "Kollam" });
  });

  it("throws empty_response (not a raw JSON parse crash) when Gemini returns malformed JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }) }) as never;

    await expect(generateStructured("s", "u", SCHEMA)).rejects.toMatchObject({ code: "empty_response" });
  });

  it("throws not_configured before any network call when the key is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as never;

    await expect(generateStructured("s", "u", SCHEMA)).rejects.toMatchObject({ code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
