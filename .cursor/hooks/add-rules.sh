#!/bin/sh
# add-rules.sh

state_file="$CURSOR_PROJECT_DIR/.cursor/hooks/state/pending.txt"

if [ ! -f "$state_file" ]; then
  printf '{}'
  exit 0
fi

files=$(cat "$state_file")
rm "$state_file"

rules_dir="$CURSOR_PROJECT_DIR/.cursor/rules"
collected_rules=""

while IFS= read -r file; do
  case "$file" in
    *.ts|*.tsx)        rule="$rules_dir/typescript.mdc" ;;
    *.md|*.mdx)        rule="$rules_dir/markdown.mdc" ;;
    *.css|*.tsx)      rule="$rules_dir/tailwindCSS.mdc" ;;
    *.test.*|*.spec.*) rule="$rules_dir/testing.mdc" ;;
    *)                 rule="" ;;
  esac

  if [ -n "$rule" ] && [ -f "$rule" ]; then
    case "$collected_rules" in
      *"$rule"*) ;;
      *) collected_rules="$collected_rules $rule" ;;
    esac
  fi
done <<EOF
$files
EOF

rule_content=""
for r in $collected_rules; do
  [ -f "$r" ] || continue
  rule_content="$rule_content
### $(basename $r)
$(cat $r)"
done

if [ -z "$rule_content" ]; then
  printf '{}'
  exit 0
fi

message="Review your work against the following rules and make any necessary corrections if you find any violations. If all criteria are met, open the review screen in the difit skill. If localhost:4966 is still running, skip this step.

$rule_content

Target files:
$files"

escaped=$(printf '%s' "$message" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/g' | tr -d '\n')

printf '{"followup_message": "%s"}' "$escaped"
