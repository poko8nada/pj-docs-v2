#!/usr/bin/env python3
"""
Load the list of already-downloaded pakutaso image URLs.
Outputs ---SEEN--- JSON to stdout.
"""
import json
import os

SEEN_FILE = os.path.join(os.path.dirname(__file__), "../data/seen.json")


def load_seen():
    if not os.path.exists(SEEN_FILE):
        seen = []
    else:
        with open(SEEN_FILE, "r", encoding="utf-8") as f:
            seen = json.load(f)
    print("---SEEN---")
    print(json.dumps(seen, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    load_seen()
