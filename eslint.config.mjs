import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nested git worktrees (.claude/worktrees/<branch>/) are separate
    // checkouts on disk, not source this project owns -- lint reported
    // warnings for a stale copy of this project's own files there,
    // duplicate of whatever this checkout's lint already covers.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
