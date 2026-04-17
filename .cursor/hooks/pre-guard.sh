#!/bin/bash
set -euo pipefail

LOG_DIR="$HOME/.cursor/hooks-logs"
LOG="$LOG_DIR/$(date '+%Y-%m-%d').log"

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
WORKSPACE_ROOTS=()
while IFS= read -r root; do
  [ -n "$root" ] && WORKSPACE_ROOTS+=("$root")
done < <(echo "$INPUT" | jq -r '.workspace_roots[]? // empty')
if [ "${#WORKSPACE_ROOTS[@]}" -eq 0 ]; then
  WORKSPACE_ROOTS=("$PWD")
fi

PROTECTED="$(
  printf '%s %s %s' \
    '.ox'"lintrc.json" \
    '.ox'"fmtrc.json" \
    'left'"hook.yml"
)"
SENSITIVE_KEYS="TEST DATABASE_URL API_KEY SECRET TOKEN PASSWORD PRIVATE_KEY STRIPE OPENAI ANTHROPIC OPENROUTER"
BLOCKED_COMMANDS="printenv env"

log_line() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [PRE-GUARD] $1" >> "$LOG"
}

deny() {
  local msg="$1"
  echo "{\"allow\":\"deny\",\"user_message\":\"$msg\"}" >&1
  log_line "DENIED - $msg"
  exit 2
}

allow() {
  echo '{"allow":"allow"}' >&1
  log_line "END - ALLOWED"
  exit 0
}

normalize_abs_path() {
  local raw="$1"
  python3 - "$raw" <<'PY'
import os
import sys
p = sys.argv[1]
if not p:
    print("")
    raise SystemExit
p = os.path.expanduser(p)
if os.path.isabs(p):
    print(os.path.realpath(p))
else:
    print(p)
PY
}

ROOTS_NORM=()
for root in "${WORKSPACE_ROOTS[@]}"; do
  ROOTS_NORM+=("$(normalize_abs_path "$root")")
done

# return 0 => outside, return 1 => inside/ignore
is_outside_workspace() {
  local path="$1"
  [ -z "$path" ] && return 1

  if [[ "$path" =~ ^https?:// ]]; then
    return 1
  fi

  case "$path" in
    ../*|*/../*|..)
      return 0
      ;;
  esac

  if [[ ! "$path" =~ ^/ && ! "$path" =~ ^~ ]]; then
    return 1
  fi

  local normalized
  normalized="$(normalize_abs_path "$path")"

  # ~/.cursor
  local cursor_dir
  cursor_dir="$(normalize_abs_path "$HOME/.cursor")"
  case "$normalized" in
    "$cursor_dir"|"$cursor_dir"/*) return 1 ;;
  esac

  for root in "${ROOTS_NORM[@]}"; do
    case "$normalized" in
      "$root"|"$root"/*)
        return 1
        ;;
    esac
  done
  return 0
}

contains_protected() {
  local str="$1"
  for p in $PROTECTED; do
    if echo "$str" | grep -qF "$p"; then
      return 0
    fi
  done
  return 1
}

log_line "START - tool_name=$TOOL_NAME"
log_line "workspace_roots: ${WORKSPACE_ROOTS[*]}"

# Generic path checks for all tools with path-like input.
while IFS=$'\t' read -r key value; do
  [ -z "$value" ] && continue
  if is_outside_workspace "$value"; then
    deny "Access outside project root is prohibited ($key)."
  fi
done < <(
  echo "$INPUT" | jq -r '
    [
      ["path", .tool_input.path?],
      ["file_path", .tool_input.file_path?],
      ["target_directory", .tool_input.target_directory?],
      ["working_directory", .tool_input.working_directory?],
      ["cwd", .tool_input.cwd?],
      ["target_notebook", .tool_input.target_notebook?],
      ["downloadPath", .tool_input.downloadPath?]
    ]
    | .[]
    | select(.[1] != null and (.[1] | type == "string") and (.[1] | length > 0))
    | "\(.[0])\t\(.[1])"
  '
)

case "$TOOL_NAME" in
  Shell)
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
    WORKING_DIR=$(echo "$INPUT" | jq -r '.tool_input.working_directory // .tool_input.cwd // empty' 2>/dev/null || echo "")

    log_line "Shell command: $COMMAND (working_dir=$WORKING_DIR)"

    if [ -n "$WORKING_DIR" ] && is_outside_workspace "$WORKING_DIR"; then
      deny "Access outside project root is prohibited via shell working_directory."
    fi

    if echo "$COMMAND" | grep -qF -- "--no-verify"; then
      deny "--no-verify is prohibited. Fix the code to pass pre-commit hooks."
    fi

    if contains_protected "$COMMAND"; then
      deny "Modifying protected config files via shell is prohibited."
    fi

    for key in $SENSITIVE_KEYS; do
      if echo "$COMMAND" | grep -qF "$key"; then
        deny "Accessing sensitive environment variables is prohibited."
      fi
    done

    for cmd in $BLOCKED_COMMANDS; do
      if echo "$COMMAND" | grep -qwF "$cmd"; then
        deny "Accessing environment variables is prohibited."
      fi
    done

    if echo "$COMMAND" | grep -qE '(^|[[:space:]])\.\.(/|[[:space:]]|$)'; then
      deny "Access outside project root is prohibited via shell."
    fi
    ;;

  Read|Write|Delete|Edit|MultiEdit)
    if contains_protected "$(echo "$INPUT" | jq -c '.tool_input // empty')"; then
      deny "Protected config file cannot be modified or accessed."
    fi
    ;;
esac

allow
