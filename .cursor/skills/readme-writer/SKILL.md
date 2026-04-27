---
name: readme-writer
description: Generate or improve a README.md for any project. Use this skill when the user asks to write, create, generate, or improve a README. Also trigger when the user says things like "add a README", "my README needs work", "help me document my project", or when starting a new project that lacks documentation. The output is a polished README with shields.io badges, a developer/AI-agent-oriented section at the top, and standard user-facing sections below.
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

User provides an existing README. Claude preserves good content, fills gaps, restructures if needed, and adds the developer section + badges.

---

## README Structure

Generate sections in this order:

```
# Project Name

[badges row]

[one-line description]

## Developer Notes           ← developer/AI-agent section (top)
### Concept & Goals
### Stack & Key Decisions

## Table of Contents         ← optional, only if README is long

## Overview                  ← user-facing starts here
## Getting Started
### Prerequisites
### Installation
## Usage
## Configuration            ← if applicable
## Contributing             ← if applicable
## License
```

---

## Section Guidelines

### Badges (shields.io)

Always include a badges row using [shields.io](https://shields.io/). Choose badges relevant to the project. Common ones:

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

Pick only relevant badges — don't pad. 3–6 is usually right.

---

### Developer Notes section

This is the key addition that makes this README useful for the developer and AI agents. Keep it **brief and scannable** — this is a memo, not formal documentation.

```markdown
## Developer Notes

> This section is for developers and AI agents working on the project.

### Concept & Goals

- What this project is trying to do and why it exists
- What "done" looks like / north star
- What it is NOT trying to do (scope boundaries)

### Stack & Key Decisions

| Area    | Choice  | Notes                                                |
| ------- | ------- | ---------------------------------------------------- |
| Runtime | Node 20 | LTS, team familiarity                                |
| DB      | SQLite  | Simple, no infra needed for now                      |
| Auth    | Clerk   | Fastest to integrate, revisit if self-hosting needed |
```

**Tone guidance:**

- Write like a dev memo, not a press release
- Short phrases > full sentences
- Decisions should have a one-line "why" — enough to understand the tradeoff
- If the user doesn't have decisions to document yet, add placeholders and note they can fill in later

---

### User-facing sections

Follow standard README conventions:

- **Overview**: 2–4 sentences. What it does, who it's for.
- **Getting Started / Prerequisites**: Be specific about versions.
- **Installation**: Copy-pasteable commands. Use code blocks.
- **Usage**: At least one working example.
- **Configuration**: Table of env vars if applicable.
- **Contributing**: Keep short unless this is an OSS project.
- **License**: One line + badge.

---

## Inference Rules

When generating from scratch or improving, infer what you can from context:

- Detect language/framework from file extensions, imports, or user description → suggest appropriate badges and stack table entries
- Infer project status from user tone ("just starting", "in production") → set status badge accordingly
- If the user mentions a GitHub URL, suggest dynamic GitHub badges
- If the user says "AI agent" or "Claude" will use this → emphasize Developer Notes section

Ask only when you can't infer:

- License type (default to MIT if no signal)
- Version number (default to 0.1.0 if not mentioned)
- Whether it's open source (affects Contributing section depth)

---

## Output Format

- Output the complete README as a markdown code block
- Also offer to save it as a file if the user is likely to want that
- After the README, add a brief note like: "Let me know what to adjust — especially the Developer Notes section, since that's the most personal part."
