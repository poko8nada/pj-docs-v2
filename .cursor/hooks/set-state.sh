#!/bin/sh
input=$(cat)

conversation_id=$(echo "$input" | grep -o '"conversation_id":"[^"]*"' | cut -d'"' -f4)
file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | cut -d'"' -f4)
workspace=$(echo "$input" | grep -o '"workspace_roots":\["[^"]*"' | cut -d'"' -f4)

state_dir="$workspace/.cursor/hooks/state"
mkdir -p "$state_dir"

echo "$file_path" >> "$state_dir/$conversation_id.txt"
