---
name: readme
description: 'Generate or improve a README.md with external-facing content only — Overview, Getting Started, Usage, Contributing, License. Internal planning (Concept & Goals, Stack, Architecture) belongs in the Spec. Trigger when README.md is created, edited, or restructured.'
---

# readme

Generates or improves a `README.md` for external audiences — people who want to use or install the project.

Internal planning content (Concept & Goals, Stack, App Architecture, Roadmap) belongs in the Spec, not in the README.

---

## Two Modes

### Mode A: Generate from scratch

User provides project name, description, or codebase. Claude infers as much as possible and asks only what's truly missing.

### Mode B: Improve existing README

User provides an existing README. Claude preserves good content, fills gaps, restructures if needed, and ensures all required sections are present. If the README contains internal planning content (Concept & Goals, Stack, Architecture), suggest moving it to the Spec.

---

## README Structure

### Fixed sections (always include, in this order)

```
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

### Optional sections (include when applicable)

| Section             | When to include                                                            |
| ------------------- | -------------------------------------------------------------------------- |
| `Content Workflow`  | Project has a design-memo directory (e.g. `content/`)                      |
| `Configuration`     | Project has env or config files users need (e.g. `wrangler.jsonc`, `.env`) |
| `API Reference`     | Project is a library or SDK with a public interface                        |
| `Table of Contents` | README is long enough to need navigation                                   |

Place optional sections after `Usage` and before `Contributing`.

## Section Guidelines

### Badges (shields.io)

Always include a badges row using [shields.io](https://shields.io/). Pick only relevant badges — 3–6 is usually right.

```markdown
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-active-brightgreen)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js)
![Python](https://img.shields.io/badge/python-3.11-blue?logo=python)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
```

For GitHub-hosted projects, also consider dynamic badges:

```markdown
![GitHub last commit](https://img.shields.io/github/last-commit/user/repo)
![GitHub issues](https://img.shields.io/github/issues/user/repo)
```

---

### User-facing sections

Follow standard README conventions:

- **Overview**: 2–4 sentences. What it does, who it's for.
- **Getting Started / Prerequisites**: Be specific about versions.
- **Installation**: Copy-pasteable commands. Use code blocks.
- **Usage**: At least one working example or command list.
- **Contributing**: Keep short unless this is an OSS project.
- **License**: One line.

---

## Inference Rules

When generating from scratch or improving, infer what you can from context:

- Detect language/framework from file extensions, imports, or user description → suggest appropriate badges
- Infer project status from user tone ("just starting", "in production") → set status badge accordingly
- If the user mentions a GitHub URL → suggest dynamic GitHub badges
- If the project has a `content/` or similar memo directory → add Content Workflow section

Ask only when you can't infer:

- License type (default to **MIT** if no signal)
- Version number (default to `0.1.0` if not mentioned)
- Whether it's open source (affects Contributing section depth)

---

## Output Format

- Output the complete README as a markdown code block
- Offer to save it as a file
