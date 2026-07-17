---
name: feasibility
description: >-
  Investigate technical topics with 3 sources (Official / Practice / Failure)
  for current best practice. Use before locking technical choices in Spec / Forge / Refine
  (and Design when new stack/UI libraries are introduced). Soft — not a hard gate.
---

# feasibility

Produce **current, cited** answers to technical questions so phase skills can lock Stack / approach without trusting agent memory.

Soft skill: phases should run this by default before locking technical choices; nothing hard-denies if skipped. Do **not** persist to issues here — return Research MD to the caller (caller may use `issue` if needed).

## Core principle

**Agents are basically wrong.** Training knowledge is outdated or miscalibrated. Memory is a last resort, and always labeled when used.

Anchor every non-trivial claim in **current external sources**. When current best practice contradicts intuition, **trust the source**.

## What you own

- Topic list (if caller did not already fix it)
- 3-role investigation per topic (Official / Practice / Failure)
- Research MD in chat + user confirmation

## What you do not own

- Phase entry, mode choice, or whether to Spec/Design/Forge
- Writing the Forge/Refine plan or Spec body — caller does that after confirmation
- Reconciling claims against _this_ repo’s app code — that is `forge`/`refine` plan Step 1
- Product code / `implement`

## When called

**From a phase skill with topics already scoped** (e.g. “lock Stack: X vs Y”): skip Step 1 debate. Confirm the topic list in one short line if useful, then investigate.

**Standalone / topics unclear:** run Step 1 until the list is agreed.

**Design:** only when Design introduces technical choices beyond the Spec (new stack / UI library). Otherwise skip.

## Phase 0 — Stack awareness (always first)

Before investigating, scope the stack from this repo’s manifests (whichever exist):

- `package.json` / lockfile — deps, scripts, version constraints
- Other manifests if relevant (`Cargo.toml`, `go.mod`, `pyproject.toml`, etc.)

Use the stack to decide **what to investigate and what to skip**. Prefer version-aware queries.

## Step 1 — Propose topics (if needed)

Propose 2–5 candidate topics in chat.

A topic is:

- A specific question, not a vague area (“How to drag-and-drop with @dnd-kit on a grid” not “DnD”)
- Actionable — the answer can become a decision or a plan step

Discuss until agreed. The 3-source rule is enforced in Step 2. If investigation cannot find 3 roles, the topic was too vague — revise and re-investigate.

## Step 2 — Investigate

For each topic, run **three roles**. Optional: track with TodoWrite (`Topic A: Official` / Practice / Failure, …).

### Role 1 — Official: what the spec says

- **Source:** official docs, language spec, RFC, library reference, maintainer guides
- **Tools:** Context7 MCP (`resolve-library-id` → `query-docs`) first; if missing, MCP `web_search_exa` then `WebFetch` for the official URL (on Exa 429, fall back to built-in `WebSearch`)
- **Question:** “What does the canonical authority say?”

### Role 2 — Practice: how it’s used in the wild

- **Source:** engineering blogs of major projects, recognized maintainers, conference talks, open-source codebases
- **Tools:** MCP `web_search_exa` to discover, built-in `WebFetch` to read (on Exa 429, fall back to `WebSearch`)
- **Question:** “How do production projects actually do this?”

### Role 3 — Failure: what goes wrong

- **Source:** issue trackers, postmortems, gotcha / pitfall writeups
- **Tools:** MCP `web_search_exa` with “issue”, “bug”, “gotcha”, “pitfall”; built-in `WebFetch` to read (on Exa 429, fall back to `WebSearch`)
- **Question:** “What are the known failure modes?”

One source is not evidence. Three sources with **different roles** is the minimum.

## Step 3 — Output & confirm

Compile findings into Markdown and post to chat. Labels below are English; render in the user’s language (typically Japanese). Topic names must match Step 1.

```markdown
## Research

### [Topic A]

- Claim: ...
- Confidence: ...

#### Evidence

- Official: `[title](URL)` or Context7 library id — digest
- Practice: [title](URL) — digest
- Failure: [title](URL) — digest

### [Topic B]

...
```

Confirm in chat (no special tool): short summary + “この結果で次に進んでよいですか？”

- **yes** → return to caller with the Research MD
- **edit** → revise topics or dig deeper; re-confirm
- **no** → back to Step 1 with reasons

## Source tiering

- **L1:** Official docs, RFCs, specs; Context7 library docs; library source (`node_modules/<lib>/` or upstream repo `src/`)
- **L2:** Major-project eng blogs, recognized maintainers, peer-reviewed; official repo issues with maintainer replies
- **L3:** Major tech media, conference talks; community blogs
- **L4 (confirm via L1–L3):** Q&A, social, unverified blogs

## Anti-patterns

- Skipping Phase 0
- Using this repo’s app/`src` as a _research_ source for ecosystem truth (caller reconciles with code later)
- Memory-only APIs/versions — cite or omit
- Single-source topics, or three sources of the same role
- Vague topics (“improve performance”)
- Evidence without URL/digest or access date
- Vague confidence (“high”) with no basis
- Writing Spec/Forge/Refine issue bodies from here — hand persistence to `issue` via the caller
