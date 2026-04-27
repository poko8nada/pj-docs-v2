#!/bin/sh
# add-rules.sh

input=$(cat)

conversation_id=$(echo "$input" | grep -o '"conversation_id":"[^"]*"' | cut -d'"' -f4)
workspace=$(echo "$input" | grep -o '"workspace_roots":\["[^"]*"' | cut -d'"' -f4)
loop_count=$(echo "$input" | grep -o '"loop_count":[0-9]*' | cut -d':' -f2)

if [ "${loop_count:-0}" -ge 3 ]; then
  printf '{}'
  exit 0
fi

state_file="$workspace/.cursor/hooks/state/$conversation_id.txt"

if [ ! -f "$state_file" ]; then
  printf '{}'
  exit 0
fi

files=$(cat "$state_file")
rm "$state_file"

rules_dir="$workspace/.cursor/rules"
collected_rules=""

while IFS= read -r file; do
  case "$file" in
    *.ts|*.tsx)        rule="$rules_dir/typescript.mdc" ;;
    *.md|*.mdx)        rule="$rules_dir/markdown.mdc" ;;
    *.css|*.html)      rule="$rules_dir/tailwindCSS.mdc" ;;
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

message="以下のルールに照らして確認し、違反があれば修正。全て満たしていれば何もしないで完了。

$rule_content

対象ファイル:
$files"

escaped=$(printf '%s' "$message" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/g' | tr -d '\n')

printf '{"followup_message": "%s"}' "$escaped"
