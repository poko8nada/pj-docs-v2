---
name: inventory
description: >-
  Soft skill: produce the full file/module inventory for a Build — every path to create or touch, not a session fragment and not a slice schedule.
  Use from /work on Build when the product tree must be listed before coding. Soft — not a hard gate.
  Writes findings/inventory/ and returns Topic / Path / Why / Summary / Axes touched to the caller.
---

# inventory

Produce the **full file / module inventory** for this Build: every path to create or touch for the product (as defined by Roadmap / MVP or the open Build), grouped so ownership is obvious.

Not a session-sized fragment. Not a product Plan. Not a slice order of capabilities — the caller sequences implementation afterward. This skill’s own **Steps** below are what the caller may slice (one Step per sitting).

Soft skill — nothing hard-denies if skipped. Write concrete output under `findings/inventory/` (create that directory on first write if missing). Return a short handoff block to the caller. Do **not** create or edit GitHub issues from here.

## How the caller slices this skill

Each **Step** below is one verifiable unit. The caller should agree and finish a Step before the next (same idea as other vertical slices). Do not merge Step 2–4 into one silent pass unless the user explicitly allows a short path.

## File tree (canonical)

Inventories must follow these placement rules.

### Premise

- Think in **feature folders**, not scattered flat files. Keep together what changes together: UI/code, **logic**, small helpers, and **tests**.
- Distance makes refactors and grep worse. Grep-ability and clear ownership beat clever indirection.
- If the layout feels messy or a new concern has no home, **propose a folder (or move) to the user before** dumping another file in a catch-all place. Do not silently invent deep trees — ask.

### Placement

- Default: **one concern → one folder**; put code, logic modules, small helpers, and their tests side by side in that folder. Never a separate top-level `__tests__` directory.
- Promote to a real shared folder only when **two or more** features need the same module; otherwise keep it local.
- **File** names in English; names state the role (`parseInvoice.ts`, `InvoiceRow.tsx`), not vague catch-alls (`helpers.ts`, `utils2.ts`).

### When to list a test file

Same “when” as Build Test policy — **whether a test path appears in the inventory**, not what assertions it contains.

**Include** a colocated `*.test.ts` / `*.test.tsx` next to the module when the inventory lists **New or substantially changed domain / pure logic** (parsers, transitions, calculations, `Result` mapping, and similar). Same feature folder as the logic file.

**Omit** a test path when the row is only:

- CSS / visual-only
- Config-only
- Trivial getters / thin pass-through mappings
- External plugin internals (stub at the boundary later; inventory the boundary mapping if you own it)

Do not invent a later “tests-only” section of the inventory. If logic is listed, its test path is listed in the same feature group when Include applies.

## What you own

- Build-wide scope for this inventory (what product / MVP this full list covers)
- Reconcile with the **existing** repo tree
- Full proposed paths: New / Edit / Delete, one-line role each, grouped by feature folder
- Test paths per **When to list a test file** above
- Writing confirmed inventory under `findings/inventory/` (append-only)
- Handoff fields for the caller

## What you do not own

- Whether this session should run — the caller decides
- GitHub issue bodies or comments
- Implementation or capability slice order — the caller does that after this inventory exists
- Product code edits outside `findings/inventory/`
- Test assertion design (angles, commands) — only whether the test **file** is listed

## When called

Usually from a Build-focused hands-on session when the full tree must be known before coding. Agree that this run produces the **whole** inventory for the Build (not “just today’s feature”) unless the user explicitly narrows it.

## Steps

### Step 1 — Lock Build scope for the inventory

Agree in chat what “full” means for this run: which Build / MVP (or equivalent) this inventory covers, and what is explicitly out (e.g. Next-only work).

**Done when:** User agrees the Build-wide boundary. Stop here if the caller is slicing Steps.

### Step 2 — Reconcile with the codebase

`Glob` / `Grep` / `Read` the existing tree. Note match / contradict / silent against the intended product. Do not draft the full path list yet.

**Done when:** Short reconcile notes are agreed (or explicitly “greenfield — nothing to match”). Stop here if slicing.

### Step 3 — Draft the full inventory

Using **File tree (canonical)** and **When to list a test file**, draft **every** path for the agreed Build. Group by feature folder. Shared only with a why (2+ features).

Show in chat. **yes** / **edit** / **no**.

**Done when:** User agrees the draft list (still may be chat-only). Stop here if slicing.

### Step 4 — Persist and hand off

On **yes** to the draft: ensure `findings/inventory/` exists, write `findings/inventory/<dated-slug>.md`, return handoff.

**Done when:** Findings file written and handoff returned. This skill’s work is complete.

## Output shape (findings MD)

```markdown
## Scope

… (Build / MVP boundary from Step 1)

## Reconcile

- Matches: …
- Contradicts: … (keep code / change inventory — state which)
- Silent: …

## Inventory

### <feature-folder>

- `src/features/invoice/InvoiceRow.tsx` — New — …
- `src/features/invoice/parseInvoice.ts` — New — …
- `src/features/invoice/parseInvoice.test.ts` — New — …

### Shared (only if 2+ features need it)

- `path` — New — role — why shared: …
```

Prefer nested bullets under each folder. Do not use wide path tables.

No slice-order section.

## Handoff (return to caller)

```markdown
- Topic: …
- Path: findings/inventory/<dated-slug>.md
- Why:
  - …
- Summary: … # optional; at most 3 lines
- Axes touched: … # optional; e.g. Roadmap
```

## Anti-patterns

- Session-sized fragment presented as the Build inventory
- Surface-only matrices that never name files
- Flat dumps instead of feature folders; top-level `__tests__`
- Inventing a shared layer for a single feature
- Silent deep trees without asking
- Listing New logic without its colocated test when Include applies
- Embedding implementation slice order
- Editing GitHub issues from this skill
- Overwriting prior `findings/inventory/` files without user request
- Skipping `findings/inventory/` create on first write
- Running Step 2–4 without Step 1 agreement when the caller expects sliced Steps

## Close

Done after Step 4. Earlier Steps are complete only for that Step’s Done when.
