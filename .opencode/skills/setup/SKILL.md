---
name: setup
description: "Prepare a session by aligning Goal and Gate with the user through discussion, then call the setup tool. The skill must be triggered first. Trigger at session start, when the user switches topic, or when context is unclear."
compatibility: opencode
---

# setup

Prepare the session. Align Goal and Gate with the user through discussion, then commit the result via the `setup` custom tool.

## Three concepts

These three concepts drive the entire session and reappear throughout the skill:

- **Goal = the desired end state.** A clear statement of "what we want to be" — outcome-focused, one sentence, not how.
- **Gate = the evaluation function.** A clear statement of "what defines done" — observable, binary, verifiable.
- **Discussion = Goal + Gate + research materials.** A single conversation that produces all three at once. Splitting them into separate rounds wastes time and loses context.

The rest of this skill is a structured form of that one discussion.

## Order requirement

You must trigger this skill BEFORE calling the `setup` tool. The execution gate enforces this order. If you call the tool without triggering the skill, the gate will block all subsequent actions.

## Load context

Before defining the Goal and Gate, check:

- Is the working tree clean? If not, stash or commit as needed.
- Are there uncommitted changes? If so, ask the user what to do with them.
- Is the branch correct? If not, confirm with the user before switching.
- Check if issue context has been injected.

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

Discussion is the heart of the session. It produces three things simultaneously: a finalized Goal, a Gate, and the research materials needed to make both concrete.

Use the `todowrite` tool to publish a checklist of discussion points at the start of Step 2. The user reads the checklist to follow along and confirm or correct each point before the agent moves on.

The checklist (initial):

- [ ] Identify related issue (`gh issue list` then `gh issue view <number> --comments` if one exists)
- [ ] Decide issue status: reference existing / declare intent to create / none
- [ ] Clarify topic details (scope, edge cases, what is in / out)
- [ ] Define Gate criteria (observable, binary, verifiable)
- [ ] Determine research scope (what to investigate before plan)
- [ ] Enumerate relevant execution skills (see below)

### Enumerate relevant execution skills

Surface the execution skills that may fire later in this session, excluding `setup`, `research`, and `plan` (those are the flow skills, not execution skills):

## Step 3: Per-item agreement (one `question` per item)

After the discussion is complete, confirm each item separately. Use the `question` tool exactly once per item, in this fixed order:

1. **Goal** — "Use Goal: [final Goal, 1 sentence]?"
2. **Gate** — "Use Gate: [final Gate, verifiable]?"
3. **Issue** — "Use Issue: [reference #N: <url> | create | none]?"
4. **Skills** — "Use Skills: [comma-separated list of execution skills]?"

Each question has two options:

- `confirm` — proceed with this value, move to the next item
- `change` — revise this value (discuss the new value in chat, then re-ask this question)

If the user types "abort" or "cancel" in any response, stop the setup entirely.

The Goal and Gate must be:

- **Goal**: one sentence, outcome-focused
- **Gate**: observable, one sentence, binary (pass / fail)

Example Gate options:

- "`pnpm typecheck && pnpm lint && pnpm test:run` all pass with the new recognizer wired in"
- "Local dev server shows correct output, Function works on browser stable"
- "Issue is closed and the change is deployed to the preview URL"

After all 4 items are confirmed, proceed to call the setup tool. No additional `question` call is needed — the per-item confirmations are the final agreement.

## Call the setup tool

After all 4 items are confirmed, call the `setup` tool with the agreed values. Field names must match the markdown block in the "Show result in chat" section so the agent has a single source of truth:

```json
{
  "topic": "[agreed topic]",
  "goal": "[agreed Goal]",
  "gate": "[agreed Gate]",
  "issue": {
    "action": "reference",
    "number": 2,
    "url": "https://github.com/..."
  },
  "skills": ["implement", "readme"]
}
```

- `skills` carries the execution skills the user agreed to in Step 2. Omit (or set to `null`) if the user picked none.
- For the `"create"` and `"none"` issue cases, set `issue` to `null` (or omit it).
- The execution gate verifies the tool's return value. Both the skill trigger AND the verified tool return are required to pass the gate.

## Show result in chat (REQUIRED)

After calling the `setup` tool, render its return value in chat. The tool returns JSON with fields `{topic, goal, gate, issue, skills, timestamp}` — use `result.*` directly. Do not re-type the values from memory; the tool output is the single source of truth. The execution gate verifies that an assistant message follows the tool call.

```markdown
# [{result.topic}]

**Goal:** {result.goal}
**Gate:** {result.gate}
**Issue:** {render result.issue as one of: `reference #N: <url>` | `create` | `none`}
**Skill:** {render result.skills as a comma-separated list, or `none` if null/empty}
```

If you skip this step, the gate will block all subsequent actions.

## Hand off

After the setup is complete, choose the next step based on the work's complexity:

- **Trivial work (typo, single-line, 1-file change)** — Proceed directly to implementation with the `/implement` skill. The user can also say "l1" (or "LV1") to force this path.
- **Non-trivial work (multi-file, structural change)** — Continue with `/research` and `/plan` skills. The user can say "l2" (or "LV2") for 1 research shot or "l3" (or "LV3") for 3 research shots.

Default to non-trivial unless the change is genuinely one-off. The `research` and `plan` skills are cheap to invoke and prevent rework.
