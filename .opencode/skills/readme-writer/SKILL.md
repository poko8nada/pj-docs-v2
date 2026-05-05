---
name: readme-writer
description: Generate or improve a README.md for any project. Use this skill when the user asks to write, create, generate, or improve a README. Also trigger when the user says things like "add a README", "my README needs work", "help me document my project", or when starting a new project that lacks documentation. The output is a polished README with shields.io badges, a Concept & Goals section near the top, and standard user-facing sections.
---

# README Writer

Generates or improves a `README.md` that serves two audiences simultaneously:

1. **Users** — people who want to use or install the project
2. **Developers & AI agents** — people (or AI) actively building the project who need context on intent, constraints, and decisions

---

## Two Modes

### Mode A: Generate from scratch

User provides project name, description, or codebase. Claude infers as much as possible and asks only what's truly missing.

### Mode B: Improve existing README

User provides an existing README. Claude preserves good content, fills gaps, restructures if needed, and ensures all required sections are present.

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
## Concept & Goals
### Goals
### Non-goals
### Operational assumptions   ← include if deploy config is non-standard or multi-environment
## Stack
## App Architecture
## Contributing
## License
```

### Optional sections (include when applicable)

| Section             | When to include                                                                  |
| ------------------- | -------------------------------------------------------------------------------- |
| `Content Workflow`  | Project has a design-memo directory (e.g. `content/`)                            |
| `Configuration`     | Project has env, vars or config files users need (e.g. `wrangler.jsonc`, `.env`) |
| `Open Questions`    | Undecided items tracked in the README rather than in Issues                      |
| `API Reference`     | Project is a library or SDK with a public interface                              |
| `Table of Contents` | README is long enough to need navigation                                         |

Place optional sections after `App Architecture` and before `Contributing`.

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

### Concept & Goals

This is the philosophical center of the README — not a developer footnote. Place it after `## Usage`, before `## Stack`.

```markdown
## Concept & Goals

### Goals

- What this project is trying to achieve and why it exists
- What "done" looks like / north star
- Key principles that guide decisions

### Non-goals

- What this project explicitly does NOT do
- Scope boundaries — things that might seem related but are out of scope

### Operational assumptions

- How the project is deployed and run in practice
- Environment or infrastructure assumptions that affect decisions
- Include this subsection only if the setup is non-standard or multi-environment
```

**Tone guidance:**

- Write like a dev memo, not a press release
- Short phrases > full sentences
- Non-goals are as important as Goals — be specific

---

### Stack

A flat section listing technology choices with one-line rationale.

```markdown
## Stack

- **Runtime**: Node 20 — LTS, team familiarity
- **Styling**: Tailwind CSS 4 + DaisyUI — token-based theming, minimal custom CSS
- **Deploy**: Wrangler / GitHub Pages — static output, no server required
```

Or as a table if there are many entries:

```markdown
## Stack

| Area    | Choice  | Notes                           |
| ------- | ------- | ------------------------------- |
| Runtime | Node 20 | LTS, team familiarity           |
| DB      | SQLite  | Simple, no infra needed for now |
| Auth    | Clerk   | Fastest to integrate            |
```

---

### App Architecture

Always include. Explain the directory structure and the key design decisions behind it. Use a code block for the tree and prose or bullet points for the explanation.

```markdown
## App Architecture

Brief explanation of the overall structure and the key split (e.g. components vs sections, routes vs layouts).

- `app/components/` — capability-named building blocks, no route or content dependency
- `app/sections/` — page-level role compositions; each folder's `index.ts` is its catalog
- `app/routes/` — thin: imports from sections and composes them

\`\`\`text
app/
├── components/
│ └── ...
├── sections/
│ ├── frame/
│ └── home/
└── routes/
└── ...
\`\`\`
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

- Detect language/framework from file extensions, imports, or user description → suggest appropriate badges and stack entries
- Infer project status from user tone ("just starting", "in production") → set status badge accordingly
- If the user mentions a GitHub URL → suggest dynamic GitHub badges
- If the user says "AI agent" or "Claude" will use this → emphasize Concept & Goals and App Architecture
- If the project has a `content/` or similar memo directory → add Content Workflow section

Ask only when you can't infer:

- License type (default to **MIT** if no signal)
- Version number (default to `0.1.0` if not mentioned)
- Whether it's open source (affects Contributing section depth)

---

## Output Format

- Output the complete README as a markdown code block
- Offer to save it as a file
- After the README, add a short note: "Let me know what to adjust — especially Concept & Goals and App Architecture, since those are the most project-specific parts."
