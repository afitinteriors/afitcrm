import "server-only";

// Blueprint V1 Section 6 (docs/BLUEPRINT_V1.md): "Model: set in Settings ->
// AI provider. Default: Gemini API paid tier (Flash)." Settings-driven
// provider switching is future work (same Settings-later caveat as every
// other rule constant in lib/constants.ts) -- this wrapper only talks to
// Gemini, with the model name itself overridable via env var so a model
// change doesn't need a code change.
//
// Same guard-clause shape as every other outbound credential this
// session (telegram-send.ts, github-bug-ticket.ts): throws before any
// network call when unconfigured. GEMINI_API_KEY is forced empty in
// .env.development.local -- local dev must never make a real, billed
// Gemini call.

const DEFAULT_MODEL = "gemini-3.8-flash";

export type GeminiErrorCode = "not_configured" | "gemini_api_error" | "empty_response";

export class GeminiError extends Error {
  code: GeminiErrorCode;
  constructor(code: GeminiErrorCode, message: string) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
  }
}

// One-shot text generation: a system instruction (the agent's persona and
// hard rules) plus a single user turn (the conversation context assembled
// by the caller). No multi-turn chat history object -- callers that need
// history serialize it into the user text themselves (see
// lib/ai/first-reply.ts), keeping this wrapper a thin, swappable transport
// rather than something that encodes AFIT-specific conversation shape.
export async function generateReply(systemInstruction: string, userText: string): Promise<string> {
  const text = await callGemini(systemInstruction, userText);
  return text;
}

// JSON Schema subset Gemini's responseSchema accepts (uppercase type
// names, per the REST API -- see lib/ai/qualification.ts's callers).
export type GeminiJsonSchema = {
  type: "OBJECT" | "STRING" | "NUMBER" | "BOOLEAN" | "ARRAY";
  properties?: Record<string, GeminiJsonSchema>;
  required?: string[];
  items?: GeminiJsonSchema;
};

// Structured extraction (Blueprint V1 Phase 6, increment 2): used where
// the caller needs a typed value back, not free text -- e.g. "did the
// customer answer the location question, and what did they say?" Keeping
// this a generic transport (caller supplies the schema and does its own
// parsing/validation of the returned JSON) rather than baking AFIT-specific
// shapes in here, same separation as generateReply/lib/ai/first-reply.ts.
export async function generateStructured<T>(systemInstruction: string, userText: string, schema: GeminiJsonSchema): Promise<T> {
  const text = await callGemini(systemInstruction, userText, { responseMimeType: "application/json", responseSchema: schema });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError("empty_response", "Gemini returned invalid JSON.");
  }
}

async function callGemini(
  systemInstruction: string,
  userText: string,
  jsonConfig?: { responseMimeType: "application/json"; responseSchema: GeminiJsonSchema },
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("not_configured", "GEMINI_API_KEY is not configured.");
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: userText }] }],
      generationConfig: { maxOutputTokens: 400, ...jsonConfig },
    }),
  });

  if (!response.ok) {
    let description = `HTTP ${response.status}`;
    try {
      const errorBody = (await response.json()) as { error?: { message?: string } };
      if (errorBody.error?.message) description = errorBody.error.message;
    } catch {
      // Gemini's error body is always JSON in practice; fall back to the
      // HTTP status above for anything else.
    }
    throw new GeminiError("gemini_api_error", `Gemini did not accept this request: ${description}`);
  }

  const body = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) {
    throw new GeminiError("empty_response", "Gemini returned no text.");
  }
  return text;
}
