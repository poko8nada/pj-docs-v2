---
description: Save a pre-compaction memo. Replaces the default compaction prompt with a MECE structure on the next compaction to preserve important state.
---

Before compacting the session, use the `precompact_save` tool to capture important state.

Call the tool with the `content` parameter filled in with the 4 sections below (**all sections must be filled**):

## 1. Adopted Decisions

Only list decisions that were **actually implemented** in this session. If a previous decision was overwritten, only write the final version. Do not list alternatives that were considered but rejected.

## 2. Rejected Approaches

For each rejected approach, describe what was tried, why it was rejected, and what was used instead. This prevents re-proposing after compaction.

## 3. Phase Boundaries

Current phase (open_discussion / design / build / refine / chore). Explicit constraints agreed with the user (e.g., "verify before deploy", "destructive operations require confirmation"). Current run mode.

## 4. Session State

- Current phase
- Run mode (normal / all, and whether scope confirmation is pending)
- Issue skill remaining turns
- Next action to take (agreed with the user)

Invocation: `precompact_save({ content: "<markdown of the 4 sections above>" })`

Do not use `write`. The tool saves the note to plugin memory and replaces the default compaction prompt template with a MECE structure that integrates the 4 sections.

Note: The MECE template is always used even without /precompact (with [ADOPTED]/[REJECTED] tags and forbidden patterns for "next action"). However, explicitly running /precompact gives the LLM a head start and captures decisions/rejections verbatim.
