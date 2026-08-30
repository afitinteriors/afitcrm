#!/usr/bin/env bash
# git-and-schema-safety — PreToolUse hook for afit-lead-crm.
#
# Mechanical safeguard only. Does NOT enforce phase boundaries, UI-vs-backend
# ordering, or scope discipline — those stay behavioral (CLAUDE.md §21/§27/
# §28/§29). This hook has exactly one job: never let a git commit/push/
# destructive-git or a Supabase schema/lifecycle-mutating MCP call go through
# silently. It never hard-blocks — it asks, so a genuinely user-approved
# operation can still proceed through Claude Code's normal permission flow.
#
# Runs on every Bash call and on five specific Supabase MCP tool names
# (see settings.json matcher). No LLM calls, no repo scans, no tests run —
# just Node's built-in JSON parsing + grep against this one tool call's own
# input. Uses `node` (already required by this project) instead of `jq`,
# which isn't installed on this machine (confirmed by pipe-testing first).
set -euo pipefail

input="$(cat)"

get_field() {
  # $1 = dotted path into the parsed input JSON, e.g. "tool_input.command"
  node -e '
    let data = "";
    process.stdin.on("data", (d) => { data += d; });
    process.stdin.on("end", () => {
      let obj;
      try { obj = JSON.parse(data); } catch { obj = {}; }
      let v = obj;
      for (const k of process.argv[1].split(".")) {
        v = v && typeof v === "object" ? v[k] : undefined;
      }
      process.stdout.write(typeof v === "string" ? v : "");
    });
  ' "$1" <<<"$input"
}

ask() {
  local reason="$1"
  node -e '
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: process.argv[1],
      },
    }) + "\n");
  ' "$reason"
  exit 0
}

tool_name="$(get_field tool_name)"

case "$tool_name" in
  Bash)
    command="$(get_field tool_input.command)"
    if printf '%s' "$command" | grep -Eiq '(^|[;&|]| )(git)[[:space:]]+(commit|push|reset[[:space:]]+--hard|clean[[:space:]]+-f)'; then
      ask "Protected git operation (commit / push / reset --hard / clean -f). Confirm this was explicitly requested before proceeding."
    fi
    ;;
  mcp__claude_ai_Supabase__apply_migration|mcp__claude_ai_Supabase__pause_project|mcp__claude_ai_Supabase__delete_branch|mcp__claude_ai_Supabase__reset_branch)
    ask "Protected Supabase operation ($tool_name). Confirm this was explicitly requested and approved."
    ;;
  mcp__claude_ai_Supabase__execute_sql)
    query="$(get_field tool_input.query)"
    if printf '%s' "$query" | grep -Eiq '\b(CREATE|ALTER|DROP|TRUNCATE)\b'; then
      ask "execute_sql looks like a schema/DDL mutation. Confirm this was explicitly requested and approved."
    fi
    ;;
esac

exit 0
