---
name: feasibility
description: "Pre-plan technical-feasibility investigation. Anchors every claim in current best practices with 3 independent sources (Official / Practice / Failure) per topic. Required by the execution gate before plan submission."
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

This skill uses a strict tool policy to keep the flow natural and the user in control:

- **`question` tool — Step 2 only.** Use it exactly once per shot to confirm the topic list. Do not use it to advance the proposal.
- **`todowrite` tool — Step 4 only.** Use it to publish a per-topic × per-role investigation checklist. The user reads the checklist to follow progress.
- **Chat text — Step 1 and natural dialogue.** Propose topic candidates and discuss in plain prose. The user responds in chat.

## Step 1: Propose topics

Topics come from discussion. If the user did not identify topic, propose them now.

A topic is:

- A specific question, not a vague area ("How to drag-and-drop with @dnd-kit on a grid" not "DnD")
- Actionable — a topic's answer can become a step

Propose 2-5 candidate topics in chat (not via the `question` tool). The user picks, edits, or proposes alternatives in chat. The 3-source rule (Official / Practice / Failure) is enforced during Step 4, not at topic selection. If investigation cannot find 3 sources, the topic was too vague — revise it and re-investigate.

## Step 2: Confirm topics

Use the `question` tool exactly once to confirm the agreed topic list.

The question prompt should embed the final topic list:

```
Use these topics?
- [topic A]
- [topic B]
- [topic C]
```

Options:

- `confirm` — proceed to Step 3
- `change` — revise the topic list in chat, then re-ask this question

If the user types "abort" or "cancel" in their response, stop the research entirely.

After confirmation, proceed to Step 3. No additional `question` calls.

## Step 3: Investigate (TodoWrite for tracking)

For each topic in the registered array, perform **3 investigations** with different roles.

Use `todowrite` to publish a checklist of investigation items at the start of Step 4. The user reads the checklist to follow progress:

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

## Step 4: Output Markdown (Show result in chat)

After investigating all topics in the registered array, compile the findings into Markdown and post to chat.

The MD structure is fixed. The labels below are in English; the agent translates them to the user's language (typically Japanese) when rendering the MD to chat. The topic names must match the topics confirmed in Step 2 and committed in Step 3.

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
