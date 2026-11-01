import { describe, it, expect } from "vitest";
import { config } from "./proxy";

// Regression test for a real bug: /api/mcp/hermes was being redirected to
// /login by this matcher (it has no staff session -- same reasoning as
// api/hermes, api/webhooks, api/cron) because it wasn't excluded, caught
// live by a smoke test against the running dev server. The matcher string
// here is a raw regex (Next.js's "matcher" config accepts one), so it can
// be tested directly without booting the proxy itself.
describe("proxy matcher", () => {
  // Anchored to the start, matching how Next.js actually evaluates this
  // pattern against a pathname (position 0) -- an unanchored .test() finds
  // a false match at a LATER "/" in the path (e.g. the "/leads" in
  // "/api/hermes/leads"), which is exactly what made this test wrongly
  // pass before being anchored.
  const pattern = new RegExp("^" + config.matcher[0]);

  it.each(["/api/mcp/hermes", "/api/hermes/leads", "/api/webhooks/whatsapp", "/api/cron/stage-timer", "/manifest.webmanifest", "/sw.js", "/_next/static/chunk.js", "/logo.png"])(
    "excludes %s from session handling",
    (path) => {
      expect(pattern.test(path)).toBe(false);
    },
  );

  it.each(["/leads", "/dashboard", "/api/ai/lead-assistant", "/settings/ai-agent"])("still matches %s for session handling", (path) => {
    expect(pattern.test(path)).toBe(true);
  });
});
