---
name: readme
description: >-
  Generate or improve root README.md for external audiences.
  Use when creating, rewriting, or cleaning README.md. Internal planning stays in Goal/Discover/Build issues.
---

# readme

Root `README.md` only (unless user names another path).

## Steps

1. Inspect existing README + manifests. Recommend Mode A (scratch) or B (improve), sections, and any move to issues. Agree before Write.
2. Before edit → `rules` + matching ref.
3. Relocating internal planning → `issue` only after user agrees.
4. Confirm what changed / moved / deferred.

### Structure (fixed order)

```text
# Project Name
[badges]
## Overview
## Getting Started
### Prerequisites
### Installation
## Usage
## Contributing
## License
```

Optional after Usage: Configuration / API Reference / Table of Contents / Content Workflow — only when applicable.

### Copy

- Overview: 2–4 sentences. Prerequisites: versions when known. Installation/Usage: copy-pasteable. License: one line.
- Badges: 3–6 factual (shields.io). Infer from repo; ask only when material and missing (license default MIT, version `0.1.0`).

## Limits

- Do not put Concept/Goals, Stack rationale, Architecture, Roadmap, or harness internals in README.
- Do not expand into product/harness redesign under README work.
- Mode B: remove internal blocks the user agreed to move.

Hand off: `rules` / `issue`.
