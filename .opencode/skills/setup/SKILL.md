---
name: setup
description: "Transitions the session from Open Discussion to a defined work plan. Use when the user decides to act, switches session topic, or context becomes unclear. Discusses Goal and Type with the user and commits via the setup tool."
compatibility: opencode
---

# setup

Transitions the session from Open Discussion to a defined work plan. Discusses Goal and Type with the user and commits the result via the `setup` custom tool.

## Two concepts

These two concepts drive the entire session and reappear throughout the skill:

- **Goal = the desired end state.** A clear statement of "what we want to be" — outcome-focused, one sentence, not how.
- **Type = the workflow category.** Determines the skill chain and how the gate validates the work. Agreed together with the Goal.

The rest of this skill is a structured form of that one discussion.

## Session types

The four session types, each with its own skill chain:

| Type           | Use for                        | Skill chain                                   |
| -------------- | ------------------------------ | --------------------------------------------- |
| `build`        | Code implementation            | tech-feasibility -> plan -> implement         |
| `design-align` | Design alignment (UI)          | tech-feasibility -> design-align -> implement |
| `issue-ops`    | Issue management               | issue -> implement                            |
| `light`        | Trivial changes (typo, 1-file) | implement                                     |

Type is agreed with the user during Goal Setting, alongside the Goal. The agent does not choose the type unilaterally.

## Order requirement

You must trigger this skill BEFORE calling the `setup` tool. The execution gate enforces this order. If you call the tool without triggering the skill, the gate will block all subsequent actions.

## Load context

Before defining the Goal and Type, check:

- Is the working tree clean? If not, stash or commit as needed.
- Are there uncommitted changes? If so, ask the user what to do with them.
- Is the branch correct? If not, confirm with the user before switching.

## Tool usage policy

This skill uses a strict tool policy to keep the flow natural and the user in control:

- **`question` tool — Step 3 only.** Use it exactly once for the final consensus prompt. Do not use it to advance discussion.
- **`todowrite` tool — Step 2 only.** Use it to make discussion points visible as a checklist. The user reads the checklist to know where the discussion is and which skills may fire.
- **Chat text — Step 1 and natural dialogue.** Propose candidates, surface details, and confirm understanding in plain prose. The user answers in chat.

## Step 1: Tentative Goal

Propose 2-3 candidate Goal statements in chat (not via the `question` tool). The Goal must be:

- One sentence
- Outcome-focused (what is achieved, not how)
- Aligned with the topic and any injected context

The user picks one, edits it, or proposes a new option in chat. The selected Goal is **tentative** — it will be finalized in Step 3 after discussion.

## Step 2: Discussion

Discussion is the heart of the session. It produces two things simultaneously: a finalized Goal and a Type. Through the discussion, the user and agent agree on the type together.

Use the `todowrite` tool to publish a checklist of discussion points at the start of Step 2. The user reads the checklist to follow along and confirm or correct each point before the agent moves on.

The checklist (initial):

- [ ] Clarify topic details (scope, edge cases, what is in / out)
- [ ] Agree on session type (build / design-align / issue-ops / light)
- [ ] Confirm Goal scope and wording

## Step 3: Per-item agreement (one `question` per item)

After the discussion is complete, confirm each item separately. Use the `question` tool exactly once per item, in this fixed order:

1. **Goal** — "Use Goal: [final Goal, 1 sentence]?"
2. **Type** — "Use Type: [build | design-align | issue-ops | light]?"

Each question has two options:

- `confirm` — proceed with this value, move to the next item
- `change` — revise this value (discuss the new value in chat, then re-ask this question)

If the user types "abort" or "cancel" in any response, stop the setup entirely.

## Call the setup tool

After both items are confirmed, call the `setup` tool with the agreed values. Field names must match the markdown block in the "Show result in chat" section so the agent has a single source of truth:

```json
{
  "goal": "[agreed Goal]",
  "type": "[build | design-align | issue-ops | light]"
}
```

- `type` carries the session type agreed in Step 3. Required.
- The execution gate verifies the tool's return value. Both the skill trigger AND the verified tool return are required to pass the gate.

## Show result in chat (REQUIRED)

After calling the `setup` tool, render its return value in chat. The tool returns JSON with fields `{goal, sessionType, timestamp}` — use `result.*` directly. Do not re-type the values from memory; the tool output is the single source of truth. The execution gate verifies that an assistant message follows the tool call.

```markdown
**Goal:** {result.goal}
**Type:** {result.sessionType}
```

If you skip this step, the gate will block all subsequent actions.
