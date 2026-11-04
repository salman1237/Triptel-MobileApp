#!/usr/bin/env bash
# PreToolUse hook on Bash. CLAUDE.md asks nicely not to run destructive commands;
# this makes a handful of the worst ones impossible instead of merely discouraged.
# Exit 2 = blocked (the tool call is refused); exit 0 = allowed through.
#
# Uses `node` (not `jq`) to pull tool_input.command out of the stdin JSON -
# jq is not guaranteed to be installed on every machine this runs on, Node is,
# since it's this project's own runtime dependency.
set -euo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | node -e '
let d = "";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(d);
    process.stdout.write(String((j.tool_input && j.tool_input.command) || ""));
  } catch (e) {
    process.stdout.write("");
  }
});
' 2>/dev/null || true)"

if [ -z "$cmd" ]; then
  exit 0
fi

# Each pattern below has already cost someone real work somewhere in this
# project's history (the sibling D:\eSim repo has its own copy of this lesson):
# an agent that can run `rm -rf`, force-push, or hard-reset doesn't need to be
# malicious to erase uncommitted work - just slightly wrong about the directory.
blocked_patterns=(
  'rm[[:space:]]+-rf[[:space:]]+/'
  'rm[[:space:]]+-rf[[:space:]]+\*'
  'rm[[:space:]]+-rf[[:space:]]+~'
  'git[[:space:]]+push[[:space:]]+.*--force'
  'git[[:space:]]+push[[:space:]]+.*-f([[:space:]]|$)'
  'git[[:space:]]+reset[[:space:]]+--hard'
  'git[[:space:]]+clean[[:space:]]+.*-f'
)

for pattern in "${blocked_patterns[@]}"; do
  if printf '%s' "$cmd" | grep -Eiq "$pattern"; then
    printf '{"continue": false, "stopReason": "Blocked by .claude/hooks/block-destructive.sh: command matches a destructive pattern (%s). If this is genuinely needed, run it yourself outside the agent, or narrow the command."}' "$pattern"
    exit 2
  fi
done

exit 0
