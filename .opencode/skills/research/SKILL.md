---
name: research
description: "USE WHEN the user asks an ad-hoc lookup or comparison question during Open Discussion — 'Xって何', 'Yを調べて', 'AとBを比較して', 'Zのベストプラクティスは', or any question needing external / current information. Output is in chat. Topics are free; pick the right tool based on the question."
compatibility: opencode
---

# research

Casual investigation for ad-hoc questions during Open Discussion. The agent answers in chat — no tool, no harness verification.

## Flow

### Step 1: Understand the question

State the question back to the user in one sentence. If ambiguous (e.g., "Which X did you mean?"), confirm before investigating.

### Step 2: Choose the tool

Pick the right tool for the question:

- **`websearch`** — for current articles, blog posts, recent developments, opinions. Use for "what's the latest" questions.
- **`webfetch`** — for reading a specific URL the user provides or one found via websearch.
- **`context7_query-docs`** — for library / framework / API documentation. Use when the user asks about a specific library or framework.

When multiple could apply, start with `websearch` for discovery, then `webfetch` for a specific page, then `context7_query-docs` for library-specific deep dive.

### Step 3: Investigate

Call the chosen tool(s). For each call:

- Be specific in the query
- Note the source URL / library ID for citation
- If the result is insufficient, try a different query or different tool

### Step 4: Summarize in chat

Post the answer directly in chat:

- Direct answer to the question (1-3 sentences)
- Supporting details (relevant code, examples, or context)
- Source citation: `Source: [URL]` or `Source: [Context7 library]`

## Anti-patterns

- **Producing a structured report** — Output stays in chat.
- **Calling multiple tools redundantly** — pick the right one. If `websearch` already gives a clear answer, don't also call `webfetch` on the same page.
- **Over-asking the user** — be a useful colleague. Investigate first, ask if you must.
- **Saving findings to a file** — output is in chat. Saving happens only when the user requests it.
