---
name: research
description: "Topic-based investigation that anchors every claim in current best practices with 3 independent sources (Official / Practice / Failure) per topic. The skill must be triggered first, then the research tool is called. 1 shot = 1 tool call with a topics array. LV2: 1 shot. LV3: 2 shots + discussion. Required by Execution Gate before plan submission."
compatibility: opencode
---

# research

## Order requirement

You must trigger this skill BEFORE calling the `research` tool. The execution gate enforces this order. If you call the tool without triggering the skill, the gate will block all subsequent actions.

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

For LV3 (2-shot), the same policy applies to each shot. The 2nd shot repeats Step 1 → Step 5 with additional topics.

## Step 1: Propose topics

Topics come from the `setup` skill's discussion. If the user did not identify topics during setup, propose them now.

A topic is:

- A specific question, not a vague area ("How to drag-and-drop with @dnd-kit on a grid" not "DnD")
- Actionable for a `plan` skill — a topic's answer can become a step

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

- `confirm` — proceed to Step 3 (tool call)
- `change` — revise the topic list in chat, then re-ask this question

If the user types "abort" or "cancel" in their response, stop the research entirely.

After confirmation, proceed to Step 3. No additional `question` calls.

## Step 3: Call the research tool (commit to topics)

**One tool call per shot.** This call registers the topics you are about to investigate. It is a commitment, not a result submission. Call it before investigation, not after.

```json
{
  "topics": ["topic A", "topic B", "topic C"]
}
```

The tool records the topics. The execution gate counts tool calls (not topics) — 1 for LV2, 2 for LV3. Each call's `topics` array must contain at least 1 topic.

The topic names in this call must match the topic names the user confirmed in Step 2. The MD output in Step 5 will reference these same names.

## Step 4: Investigate (TodoWrite for tracking)

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

## Step 5: Output Markdown (Show result in chat)

After investigating all topics in the registered array, compile the findings into Markdown and post to chat. The execution gate verifies that an assistant message follows the last tool call.

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

The Markdown is the durable record of the research — do not duplicate the findings in the tool call. The tool only carries `topics`; the MD carries the actual findings.

## LV2: 1-shot

N topics (typically 2-3) → Step 1 (propose in chat) → Step 2 (confirm) → Step 3 (1 tool call) → Step 4 (investigate) → Step 5 (1 MD output). Done.

## LV3: 2-shot + discussion

N topics (typically 3-5) → Step 1 → Step 2 → Step 3 (1st tool call) → Step 4 (1st investigation) → Step 5 (1st MD output) → **user discussion in chat** → Step 1 (additional topics) → Step 2 (confirm additional) → Step 3 (2nd tool call) → Step 4 (2nd investigation) → Step 5 (2nd MD output, appended to 1st).

The discussion between the two shots is the point. Without it, LV3 collapses into LV2 with more topics.

The user reviews the first MD, identifies gaps, and proposes additional topics. The second batch is narrower — typically 1-3 topics that fill specific holes.

## Gate logic

The execution gate counts tool calls (not topics).

- LV2: `toolCount >= 1` (one shot)
- LV3: `toolCount >= 2` (two shots, separated by user discussion)
- Each call's `topics` array must contain at least 1 topic

The gate does not verify the MD output. That is the responsibility of the agent and the `plan` skill which depends on it.

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
- **One tool call per topic** — the topics array is the unit; never call once per topic
- **Empty topics array** — a tool call with no topics is rejected by the gate
- **MD without URLs or digests** — evidence is not evidence without a destination
- **LV3 without discussion** — the second shot is only triggered by user review of the first MD
- **Undated sources** — every source has an access date
- **Vague confidence** — "high"/"low" without basis is not useful
