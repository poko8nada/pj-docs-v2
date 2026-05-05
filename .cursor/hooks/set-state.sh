#!/bin/sh
# set-state.sh

input=$(cat)
file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | cut -d'"' -f4)

state_dir="$CURSOR_PROJECT_DIR/.cursor/hooks/state"
mkdir -p "$state_dir"

echo "$file_path" >> "$state_dir/pending.txt"
