---
name: opinion
description: Collect and analyze user opinion comments (UO[n]) left in code or documents. Trigger this skill at any time, in any session type, regardless of the current gate state. This skill covers the full flow from proposal to cleanup — follow every step in order and do not skip ahead.
---

# Opinion

Collect all pending user opinion comments, propose solutions through discussion, implement after approval, then clean up. Follow the steps below strictly — do not proceed to the next step without completing the current one.

## Comment Format

```
UO[{priority}]: {comment}        → pending
```

Priority: `1` = high, `2` = mid, `3` = low

## Flow

```
Step 1: Collect pending comments
Step 2: Analyze and propose
Step 3: Discussion loop — revise until user approves (no code changes)
Step 4: Implement — then STOP and wait for user OK
Step 5: User says OK → mark as [done] → delete → verify
```

---

## Step 1 — Collect

```bash
grep -rn "UO\[" . --exclude-dir={node_modules,.git,dist} | grep -v "\[done\]"
```

Sort results by priority (1 first). If nothing is found, report and stop.

## Step 2 — Analyze & Propose

For each pending comment, read surrounding context and related files. Output all proposals at once before waiting for any response.

```
### No[n] UO[{priority}] — {file}:{line}

**Context**
{brief description of the surrounding code or document}

**Understanding**
{what the user likely means or wants}

**Proposal**
{concrete suggestion for how to address it}
```

## Step 3 — Discussion Loop

```
Present proposals
  → User gives feedback
    → Revise and re-present (no code changes)
      → Repeat until user says to proceed
```

Do not touch any files during this loop.

## Step 4 — Implement

Implement the approved proposals. When done, STOP immediately. Do not mark anything as `[done]`. Do not delete anything. Present the changes and explicitly ask the user for confirmation.

## Step 5 — Cleanup (only after explicit user OK)

After the user confirms OK:

2. Delete all `[done]` comments
3. Verify nothing remains:
   ```bash
   grep -rn "UO\[" . --exclude-dir={node_modules,.git,dist}
   ```
   No results should remain for addressed comments.
