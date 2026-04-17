#!/bin/bash

LOG_DIR="$HOME/.cursor/hooks-logs"
LOG="$LOG_DIR/$(date '+%Y-%m-%d').log"

INPUT=$(cat)

FILE=$(echo "$INPUT" | jq -r '.file_path // empty' 2>/dev/null || echo "")
WORKSPACE_ROOTS=$(echo "$INPUT" | jq -r '.workspace_roots[]? // empty' | head -n 1)

echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] START" >> "$LOG"
echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] Edited file: $FILE" >> "$LOG"
echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] workspace_root: $WORKSPACE_ROOTS" >> "$LOG"
echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] pwd before: $(pwd)" >> "$LOG"

# 確実にプロジェクトルートに移動（これが一番安定）
if [ -n "$WORKSPACE_ROOTS" ]; then
  cd "$WORKSPACE_ROOTS" || true
  echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] cd to workspace_root done" >> "$LOG"
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] pwd after: $(pwd)" >> "$LOG"
echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] pnpm path: $(which pnpm)" >> "$LOG"

# TS/JS 以外は即終了
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *)
    echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] Skipped (not TypeScript/JavaScript)" >> "$LOG"
    exit 0
    ;;
esac

# PATH 強化 + pnpm exec（これが一番安定）
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/share/pnpm:./node_modules/.bin:$PATH"

echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] Running oxlint --fix with pnpm exec..." >> "$LOG"
pnpm exec oxlint --fix "$FILE" >/dev/null 2>&1 && \
  echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] ✓ oxlint --fix completed" >> "$LOG" || \
  echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] ⚠ oxlint failed (exit code $?)" >> "$LOG"

echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] Running oxfmt with pnpm exec..." >> "$LOG"
pnpm exec oxfmt "$FILE" >/dev/null 2>&1 && \
  echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] ✓ oxfmt completed" >> "$LOG" || \
  echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] ⚠ oxfmt failed (exit code $?)" >> "$LOG"

echo "$(date '+%Y-%m-%d %H:%M:%S') [POST-LINT] END" >> "$LOG"
exit 0
