---
name: feasibility
description: >-
  Soft skill: investigate technical topics with 3 sources (Official / Practice / Failure) for current best practice.
  Use from /work before locking Discover Stack or Build technical choices (and whenever a concrete tech question must not rely on agent memory). Soft — not a hard gate.
  Writes findings/feasibility/ and returns Topic / Path / Why / Summary / Axes touched to the caller.
---

# feasibility

Produce **current, cited** answers to technical questions so Stack / approach decisions do not trust agent memory.

Soft skill — nothing hard-denies if skipped. Write concrete Research under `findings/feasibility/` (create that directory on first write if missing). Return a short handoff block to the caller. Do **not** create or edit GitHub issues from here.

## How the caller slices this skill

Each **Step** below is one verifiable unit. Agree and finish a Step before the next. Do not merge later Steps into one silent pass unless the user explicitly allows a short path.

If Step 3 has many topics, the caller may slice **one topic at a time** (still all three roles per topic).

## Core principle

**Agents are basically wrong.** Training knowledge is outdated or miscalibrated. Memory is a last resort, and always labeled when used.

Anchor every non-trivial claim in **current external sources**. When current best practice contradicts intuition, **trust the source**.

## What you own

- Topic list (if the caller did not already fix it)
- 3-role investigation per topic (Official / Practice / Failure)
- Research MD under `findings/feasibility/` (append-only) after user confirmation
- Handoff fields for the caller

## What you do not own

- Whether this session should run — the caller decides
- GitHub issue bodies or comments
- Reconciling claims against this repo’s application code — the caller does that when implementing
- Product or harness file edits outside `findings/feasibility/`

## When called

**Topics already scoped** (e.g. “lock Stack: X vs Y”): after Step 1, skip Step 2 debate — confirm the list in one short line if useful, then Step 3.

**Topics unclear:** run Step 2 until the list is agreed.

## Steps

### Step 1 — Stack awareness

Before investigating, scope the stack from this repo’s manifests (whichever exist):

- `package.json` / lockfile — deps, scripts, version constraints
- Other manifests if relevant (`Cargo.toml`, `go.mod`, `pyproject.toml`, etc.)

Use the stack to decide **what to investigate and what to skip**. Prefer version-aware queries.

**Done when:** Stack context is noted (chat is enough). Stop if slicing.

### Step 2 — Propose topics

Propose 2–5 candidate topics in chat (skip debate only when the caller already fixed the list — then one-line confirm).

A topic is:

- A specific question, not a vague area (“How to drag-and-drop with @dnd-kit on a grid” not “DnD”)
- Actionable — the answer can become a decision

Discuss until agreed. If later investigation cannot find three roles, the topic was too vague — return here.

**Done when:** Topic list agreed. Stop if slicing.

### Step 3 — Investigate

For each agreed topic (or one topic per sitting if the caller slices), run **three roles**. Optional: track with TodoWrite (`Topic A: Official` / Practice / Failure, …).

#### Role 1 — Official: what the spec says

- **Source:** official docs, language spec, RFC, library reference, maintainer guides
- **Tools:** Context7 MCP (`resolve-library-id` → `query-docs`) first; if missing, MCP `web_search_exa` then `WebFetch` for the official URL (on Exa 429, fall back to built-in `WebSearch`)
- **Question:** “What does the canonical authority say?”

#### Role 2 — Practice: how it’s used in the wild

- **Source:** engineering blogs of major projects, recognized maintainers, conference talks, open-source codebases
- **Tools:** MCP `web_search_exa` to discover, built-in `WebFetch` to read (on Exa 429, fall back to `WebSearch`)
- **Question:** “How do production projects actually do this?”

#### Role 3 — Failure: what goes wrong

- **Source:** issue trackers, postmortems, gotcha / pitfall writeups
- **Tools:** MCP `web_search_exa` with “issue”, “bug”, “gotcha”, “pitfall”; built-in `WebFetch` to read (on Exa 429, fall back to `WebSearch`)
- **Question:** “What are the known failure modes?”

One source is not evidence. Three sources with **different roles** is the minimum. Follow **Source tiering** below.

**Done when:** Evidence for the topic(s) in this sitting is gathered. Stop if slicing (more topics remain).

### Step 4 — Output, confirm, persist

Compile findings into Markdown and post to chat. Labels below are English; render in the user’s language (typically Japanese). Topic names must match Step 2.

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

Confirm: short summary + “この結果で次に進んでよいですか？”

- **yes** → ensure `findings/feasibility/` exists, write `findings/feasibility/<dated-slug>.md` (append-only; do not overwrite prior runs unless the user asks to tidy), return handoff
- **edit** → revise topics or dig deeper; re-confirm (may return to Step 2 or 3)
- **no** → back to Step 2 with reasons

**Done when:** Findings file written and handoff returned.

## Handoff (return to caller)

```markdown
- Topic: …
- Path: findings/feasibility/<dated-slug>.md
- Why:
  - …
- Summary: … # optional; at most 3 lines
- Axes touched: … # optional; e.g. Stack
```

## Source tiering

- **L1:** Official docs, RFCs, specs; Context7 library docs; library source (`node_modules/<lib>/` or upstream repo `src/`)
- **L2:** Major-project eng blogs, recognized maintainers, peer-reviewed; official repo issues with maintainer replies
- **L3:** Major tech media, conference talks; community blogs
- **L4 (confirm via L1–L3):** Q&A, social, unverified blogs

## Anti-patterns

- Skipping Step 1
- Using this repo’s app/`src` as a _research_ source for ecosystem truth
- Memory-only APIs/versions — cite or omit
- Single-source topics, or three sources of the same role
- Vague topics (“improve performance”)
- Evidence without URL/digest or access date
- Vague confidence (“high”) with no basis
- Editing GitHub issues from this skill
- Overwriting prior `findings/feasibility/` files without user request
- Skipping `findings/feasibility/` create on first write
- Running later Steps without prior Step agreement when the caller expects sliced Steps
