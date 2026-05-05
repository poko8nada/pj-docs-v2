#!/usr/bin/env python3
"""
Save newly downloaded pakutaso image URLs to the seen list.
Pass detail_urls as command-line arguments or via stdin (one per line).
"""
import json
import os
import sys

SEEN_FILE = os.path.join(os.path.dirname(__file__), "../data/seen.json")


def save_seen(new_urls: list[str]):
    os.makedirs(os.path.dirname(SEEN_FILE), exist_ok=True)

    if os.path.exists(SEEN_FILE):
        with open(SEEN_FILE, "r", encoding="utf-8") as f:
            seen = json.load(f)
    else:
        seen = []

    added = 0
    for url in new_urls:
        url = url.strip()
        if url and url not in seen:
            seen.append(url)
            added += 1

    with open(SEEN_FILE, "w", encoding="utf-8") as f:
        json.dump(seen, f, ensure_ascii=False, indent=2)

    print(f"Saved {added} new URL(s). Total seen: {len(seen)}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        urls = sys.argv[1:]
    else:
        urls = sys.stdin.read().splitlines()
    save_seen(urls)
