import { describe, it, expect } from "vitest";
import { getVapidConfig, VAPID_CONFIG_ERRORS } from "./config";

// Synthetic, correctly-shaped values (87 / 43 base64url chars) -- not real keys.
const PUBLIC_KEY = "BSYNTHETICPUBLICKEY".padEnd(87, "A");
const PRIVATE_KEY = "SYNTHETICPRIVATEKEY".padEnd(43, "Q");
const SUBJECT = "mailto:ops@afitbuilders.in";

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: PUBLIC_KEY,
    VAPID_PRIVATE_KEY: PRIVATE_KEY,
    VAPID_SUBJECT: SUBJECT,
    ...overrides,
  } as unknown as NodeJS.ProcessEnv;
}

const reasonOf = (overrides: Record<string, string | undefined>) => {
  const result = getVapidConfig(env(overrides));
  return result.ok ? "OK" : result.reason;
};

describe("getVapidConfig -- every diagnostic branch", () => {
  it("accepts a correct configuration", () => {
    expect(getVapidConfig(env())).toEqual({ ok: true, config: { publicKey: PUBLIC_KEY, privateKey: PRIVATE_KEY, subject: SUBJECT } });
  });

  it("accepts an https: subject", () => {
    expect(reasonOf({ VAPID_SUBJECT: "https://afitbuilders.in/contact" })).toBe("OK");
  });

  it("tolerates leading/trailing whitespace or a newline around a value", () => {
    expect(reasonOf({ VAPID_SUBJECT: `  ${SUBJECT}\n`, VAPID_PRIVATE_KEY: `${PRIVATE_KEY}\r\n` })).toBe("OK");
  });

  it.each([
    ["public key missing", { NEXT_PUBLIC_VAPID_PUBLIC_KEY: undefined }, "VAPID_PUBLIC_KEY_MISSING"],
    ["public key empty", { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "  " }, "VAPID_PUBLIC_KEY_MISSING"],
    ["public key wrong length", { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "BAAAA" }, "VAPID_PUBLIC_KEY_INVALID_FORMAT"],
    ["public key not base64url", { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "B!".padEnd(87, "A") }, "VAPID_PUBLIC_KEY_INVALID_FORMAT"],
    ["private key missing", { VAPID_PRIVATE_KEY: undefined }, "VAPID_PRIVATE_KEY_MISSING"],
    ["private key wrong length", { VAPID_PRIVATE_KEY: "short" }, "VAPID_PRIVATE_KEY_INVALID_FORMAT"],
    ["private key not base64url", { VAPID_PRIVATE_KEY: "P+/".padEnd(43, "Q") }, "VAPID_PRIVATE_KEY_INVALID_FORMAT"],
    ["subject missing", { VAPID_SUBJECT: undefined }, "VAPID_SUBJECT_MISSING"],
    ["subject empty", { VAPID_SUBJECT: "   " }, "VAPID_SUBJECT_MISSING"],
    ["subject with inner space", { VAPID_SUBJECT: "mailto:ops @afitbuilders.in" }, "VAPID_SUBJECT_INVALID_WHITESPACE"],
    ["subject with newline inside", { VAPID_SUBJECT: "mailto:ops@afitbuilders\n.in" }, "VAPID_SUBJECT_INVALID_WHITESPACE"],
    ["subject with control char", { VAPID_SUBJECT: "mailto:ops@afit\u0007.in" }, "VAPID_SUBJECT_INVALID_WHITESPACE"],
    ["bare email (no mailto:)", { VAPID_SUBJECT: "ops@afitbuilders.in" }, "VAPID_SUBJECT_INVALID_FORMAT"],
    ["plain text", { VAPID_SUBJECT: "not-a-contact" }, "VAPID_SUBJECT_INVALID_FORMAT"],
    ["mailto: without a domain", { VAPID_SUBJECT: "mailto:ops" }, "VAPID_SUBJECT_INVALID_FORMAT"],
    ["http: (not https:)", { VAPID_SUBJECT: "http://afitbuilders.in" }, "VAPID_SUBJECT_INVALID_FORMAT"],
    ["mailto placeholder", { VAPID_SUBJECT: "mailto:admin@afit.example" }, "VAPID_SUBJECT_PLACEHOLDER"],
    ["https placeholder", { VAPID_SUBJECT: "https://example.com/contact" }, "VAPID_SUBJECT_PLACEHOLDER"],
  ] as const)("%s -> %s", (_label, overrides, expected) => {
    expect(reasonOf(overrides)).toBe(expected);
  });

  it("reports the first failing rule (keys are checked before the subject)", () => {
    expect(reasonOf({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: undefined, VAPID_SUBJECT: "nope" })).toBe("VAPID_PUBLIC_KEY_MISSING");
  });

  it("every published error code is reachable", () => {
    const seen = new Set([
      reasonOf({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: undefined }),
      reasonOf({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: "BAAAA" }),
      reasonOf({ VAPID_PRIVATE_KEY: undefined }),
      reasonOf({ VAPID_PRIVATE_KEY: "short" }),
      reasonOf({ VAPID_SUBJECT: undefined }),
      reasonOf({ VAPID_SUBJECT: "a b" }),
      reasonOf({ VAPID_SUBJECT: "x" }),
      reasonOf({ VAPID_SUBJECT: "mailto:a@b.example" }),
    ]);
    expect([...seen].sort()).toEqual([...VAPID_CONFIG_ERRORS].sort());
  });
});

describe("getVapidConfig -- never exposes configured values in a failure", () => {
  it("a failure result contains only the symbolic reason", () => {
    const secretSubject = "mailto:secret-person@secret-domain.example";
    const failures = [
      getVapidConfig(env({ VAPID_SUBJECT: secretSubject })),
      getVapidConfig(env({ VAPID_SUBJECT: "secret words here" })),
      getVapidConfig(env({ VAPID_PRIVATE_KEY: "secret-but-wrong-length" })),
      getVapidConfig(env({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: "secret-public" })),
    ];

    for (const failure of failures) {
      expect(failure.ok).toBe(false);
      const serialized = JSON.stringify(failure);
      expect(serialized).toMatch(/^\{"ok":false,"reason":"VAPID_[A-Z_]+"\}$/);
      for (const leaked of ["secret", "mailto", "example", PUBLIC_KEY, PRIVATE_KEY, "afitbuilders"]) {
        expect(serialized).not.toContain(leaked);
      }
    }
  });
});
