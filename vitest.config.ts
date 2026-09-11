import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal config: Node environment (no DOM needed — Phase E tests exercise
// pure server-side parsing/auth/ingestion logic only), matching this
// project's own "@/*" -> "./*" path alias from tsconfig.json.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // "server-only" throws unconditionally unless resolved under Next's
      // "react-server" export condition (which webpack sets, but Vite/
      // Vitest does not) -- alias straight to its no-op build for tests.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**"],
  },
});
