---
name: readme
description: >-
  Generate or improve root README.md for external audiences (Overview, Getting Started,
  Usage, Contributing, License). Use when the user asks to create, rewrite, or clean up
  README.md. Internal planning belongs in Goal / Discover / Build issues — not in the README.
---

# readme

Write or improve root `README.md` for people who install or use the project.

Internal planning (Concept & Goals, Stack rationale, Architecture, Roadmap) belongs in GitHub `[Goal]` / `[Discover]` / `[Build]` issues — not in the README. If the current README has that material, propose moving it to the right issue via `issue` skill (work phase).

## What you own

- README structure and external-facing copy
- Badges, section order, optional sections when applicable
- Propose moving internal planning out of README into Goal / Discover / Build issues

## What you do not own

- Goal / Discover / Build body writing — `issue` + phase skills
- Product or harness code — `rules` (after work-phase handshake)
- Creating Goal / Discover / Build issues just to park README leftovers — only when the user agrees

## On entry

Inspect the existing `README.md` (and `package.json` / manifests for inference). Recommend **Mode A or B**, which sections change, and what (if anything) should move to Goal / Discover / Build issues. Agree before Write.

Revise until the user agrees. Do not Write `README.md` on a vague “improve the readme”.

## Modes

### Mode A — Generate from scratch

Infer from the repo and user brief. Ask only what you cannot infer (license default **MIT**, version default `0.1.0`).

### Mode B — Improve existing

Preserve good content. Fill gaps, fix order, drop or relocate internal planning. Keep the user’s voice when it is already clear.

## Structure

### Fixed sections (always, this order)

```text
# Project Name

[badges row]

## Overview
## Getting Started
### Prerequisites
### Installation
## Usage
## Contributing
## License
```

### Optional sections (after Usage, before Contributing)

| Section             | When                                                       |
| ------------------- | ---------------------------------------------------------- |
| `Configuration`     | Env / config files users must touch (`.env.example`, etc.) |
| `API Reference`     | Library / SDK with a public surface                        |
| `Table of Contents` | README is long enough to need it                           |
| `Content Workflow`  | Project has a design-memo / `content/` style directory     |

## Section guidelines

### Badges (shields.io)

3–6 relevant badges. Prefer factual ones (version, license, runtime, language). For GitHub remotes, optional dynamic badges (`last-commit`, `issues`).

### Copy

- **Overview**: 2–4 sentences — what it does, who it is for
- **Prerequisites**: specific versions when known
- **Installation**: copy-pasteable commands in code blocks
- **Usage**: at least one working example or command list
- **Contributing**: short unless this is a public OSS project
- **License**: one line

### Do not put in README

- Concept & Goals, Stack & Key Decisions, Architecture, Roadmap, agent/harness internals
- Point readers to Goal / Discover / Build issues / `AGENTS.md` only when truly needed for contributors — prefer Contributing stay thin

## Inference

From the repo when possible:

- Language / package manager / scripts → badges and Usage
- `package.json` `version` / `license` → badge defaults
- Git remote → GitHub dynamic badges

Ask only when missing and material.

## Flow

1. Agree Mode + scope with the user.
2. Before editing `README.md`, ensure a work phase (`/chore` is enough for README-only) and Read `.cursor/skills/rules/SKILL.md`, then follow `rules`.
3. If relocating internal sections to Goal / Discover / Build issues, use `issue` skill after the user agrees — do not invent an issue rewrite without approval.
4. Confirm: list what changed and what was moved or deferred.

## Hard limits

- Do not expand into product features or harness redesign under the guise of README work.
- Do not leave Developer Notes / Stack blocks in README after Mode B if the user agreed to move them.
- Root `README.md` only unless the user explicitly names another path.

Hand off to `rules` / `issue` by name — do not copy their contents here.
