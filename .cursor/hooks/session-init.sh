#!/bin/bash

INPUT=$(cat)
PROJECT_DIR="${CURSOR_PROJECT_DIR:-$(pwd)}"

# --- README ---
README_CONTENT=""
README_FILE=$(find "$PROJECT_DIR" -maxdepth 1 -type f \
  \( -iname 'README.md' -o -iname 'README.rst' -o -iname 'README.txt' -o -iname 'README' \) \
  | head -1)

if [ -n "$README_FILE" ]; then
  README_CONTENT=$(cat "$README_FILE")
else
  README_CONTENT="README not found."
fi

# --- Project structure ---
STRUCTURE=""
if command -v tree &>/dev/null; then
  STRUCTURE=$(tree "$PROJECT_DIR" -L 4 --gitignore -I '.git|node_modules|dist|.next|__pycache__|*.pyc' 2>/dev/null | head -200)
else
  STRUCTURE=$(find "$PROJECT_DIR" \
    -not -path '*/.git/*' \
    -not -path '*/node_modules/*' \
    -not -path '*/dist/*' \
    -not -path '*/__pycache__/*' \
    -not -name '*.pyc' \
    -maxdepth 5 \
    | sort | head -200)
fi

# --- Key source files (non-binary, under 500 lines each, up to 10 files) ---
SOURCE_CONTENT=""
while IFS= read -r file; do
  lines=$(wc -l < "$file" 2>/dev/null || echo 9999)
  if [ "$lines" -le 500 ]; then
    rel="${file#$PROJECT_DIR/}"
    SOURCE_CONTENT+="
=== $rel ===
$(cat "$file")
"
  fi
done < <(find "$PROJECT_DIR" \
  -not -path '*/.git/*' \
  -not -path '*/node_modules/*' \
  -not -path '*/dist/*' \
  -not -path '*/__pycache__/*' \
  -not -iname 'README.md' \
  -not -iname 'README.rst' \
  -not -iname 'README.txt' \
  -not -iname 'README' \
  -type f \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \
     -o -name '*.py' -o -name '*.go' -o -name '*.rs' \
     -o -name '*.json' -o -name '*.yaml' -o -name '*.yml' \
     -o -name '*.toml' -o -name '*.md' \) \
  | head -30)

# --- GitHub Issues (open, with body) ---
ISSUES_CONTENT=""
if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
  if [ -n "$REPO" ]; then
    ISSUE_LIST=$(gh issue list --repo "$REPO" --state open --limit 50 --json number,title,body,labels,assignees,createdAt 2>/dev/null)
    if [ -n "$ISSUE_LIST" ] && [ "$ISSUE_LIST" != "[]" ]; then
      ISSUES_CONTENT="Repository: $REPO

$(echo "$ISSUE_LIST" | jq -r '.[] | "--- Issue #\(.number): \(.title) ---\nLabels: \([.labels[].name] | join(", "))\nAssignees: \([.assignees[].login] | join(", "))\nCreated: \(.createdAt)\n\(.body)\n"')"
    else
      ISSUES_CONTENT="Repository: $REPO — no open issues."
    fi
  else
    ISSUES_CONTENT="Not a GitHub repository or gh CLI not authenticated."
  fi
else
  ISSUES_CONTENT="gh CLI not available or not authenticated."
fi

# --- Output ---
CONTEXT="== README ==
$README_CONTENT

== PROJECT STRUCTURE ==
$STRUCTURE

== SOURCE FILES ==
$SOURCE_CONTENT

== OPEN GITHUB ISSUES ==
$ISSUES_CONTENT"

printf '%s' "$CONTEXT" | jq -Rs '{"additional_context": .}'
