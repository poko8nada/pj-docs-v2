---
name: feasibility
description: "Investigate technical topics with 3 sources (Official / Practice / Failure) for current best practice. Use when making technical decisions, validating an unfamiliar approach, or filling a knowledge gap. Do not use for non-technical tasks or when the answer is already known."
compatibility: opencode
---

# feasibility

## Core principle: best practices first

**Agents are basically wrong.** Your training knowledge is outdated, version-shifted, or miscalibrated. Internal memory is a last resort, and always clearly labeled when used.

Anchor every non-trivial claim in **current external sources**: official documentation, recent articles (≤6 months for fast-moving fields), and patterns from recognized projects.

When current best practice contradicts your intuition, **trust the source, not the memory**.

## Phase 0: Stack awareness (always do this first)

Before any investigation, read `package.json` to scope what to investigate.

Note:

- `dependencies` and `devDependencies` — which libraries to query
- `scripts` — build/test/lint tools
- version constraints — which version-specific behaviors matter

Use the stack to decide **what to investigate and what to skip**.

## Tool usage policy

- **Chat text — Step 1 & 2.** Present context, propose topics, and discuss in plain prose. The user responds in chat.
- **`todowrite` tool — Step 2 only.** Publish the investigation checklist.
- **`question` tool — Step 3 only.** Final confirmation of research output.

## Step 1: Propose topics

Propose 2-5 candidate topics.

A topic is:

- A specific question, not a vague area ("How to drag-and-drop with @dnd-kit on a grid" not "DnD")
- Actionable — a topic's answer can become a step

Propose in chat (not via the `question` tool). The user picks, edits, or proposes alternatives. Discuss until the topic list is agreed. The 3-source rule (Official / Practice / Failure) is enforced during Step 2, not at topic selection. If investigation cannot find 3 sources, the topic was too vague — revise it and re-investigate.

## Step 2: Investigate (TodoWrite for tracking)

For each topic, perform **3 investigations** with different roles.

Use `todowrite` to publish a checklist at the start of this step:

```
- [ ] Topic A: Official
- [ ] Topic A: Practice
- [ ] Topic A: Failure
- [ ] Topic B: Official
- [ ] Topic B: Practice
- [ ] Topic B: Failure
- [ ] Topic C: Official
- [ ] Topic C: Practice
- [ ] Topic C: Failure
```

Mark each item done as you complete the corresponding investigation.

### Role 1 — Official: what the spec says

- **Source:** official documentation, language spec, RFC, library reference, maintainer-authored guides
- **Tool flow:**
  1. Try `context7_query-docs` first
  2. If found, use the `source` field as the evidence (path identifier is enough)
  3. If not found in context7, fall back to `websearch` + `webfetch` to find the official docs URL
- **Question:** "What does the canonical authority say?"

### Role 2 — Practice: how it's used in the wild

- **Source:** engineering blogs of major projects, recognized maintainers, conference talks, open-source codebases
- **Tool:** `websearch` to discover, `webfetch` to read in full
- **Question:** "How do production projects actually do this?"

### Role 3 — Failure: what goes wrong

- **Source:** issue trackers, postmortems, "gotcha" articles, debugging writeups
- **Tool:** `websearch` with terms like "issue", "bug", "gotcha", "pitfall"; `webfetch` to read in full
- **Question:** "What are the known failure modes and pitfalls?"

A single source is not evidence. 3 sources with different roles is the minimum.

## Step 3: Output & Confirm

After investigating all topics, compile the findings into Markdown and post to chat.

The MD structure is fixed. The labels below are in English; the agent translates them to the user's language (typically Japanese) when rendering the MD to chat. The topic names must match the topics agreed in Step 1.

```markdown
## Research

### [Topic A]

- Claim: ...
- Confidence: ...

#### Evidence

- Official: `[title](URL) or [context7]` — digest
- Practice: [title](URL) — digest
- Failure: [title](URL) — digest

### [Topic B]

...

### [Topic C]

...
```

Use the `question` tool to confirm:「[調査結果の要約]。この結果で次に進んでよいですか？」

- Approved → proceed
- Changes needed → return to Step 1 with revised topics

## Source tiering

- **L1 (Highest)**:
  - Official docs, RFCs, language/framework specifications
  - Library reference (context7)
  - Library source on GitHub (`node_modules/<lib>/` or repo's `src/`)
- **L2 (High)**:
  - Engineering blogs of major projects, recognized maintainers, peer-reviewed papers
  - Official repo issues / discussions (major projects with maintainer responses)
- **L3 (Medium)**:
  - Tech media (major outlets), conference talks
  - Community discussions on third-party blogs
- **L4 (Low — confirm via L1-L3)**:
  - Community Q&A, social media, unverified blogs

## Anti-patterns

- **Skipping Phase 0** — investigate without reading `package.json` wastes time
- **Reading the project's app code** — `app/`, `src/`, `lib/`, etc. are not research sources. The agent may have written them wrong. Use `node_modules/<lib>/` or the library's GitHub repo for canonical implementation.
- **Memory-only answers** — never state APIs/versions from memory. Cite or omit.
- **Single-source topics** — 1 source is not evidence. 3 sources with different roles is the minimum.
- **Same-role repetition** — 3 sources must cover Official / Practice / Failure, not 3 official or 3 failure stories
- **Vague topics** — "improve performance" is not a topic. Be specific.
- **MD without URLs or digests** — evidence is not evidence without a destination
- **Undated sources** — every source has an access date
- **Vague confidence** — "high"/"low" without basis is not useful
