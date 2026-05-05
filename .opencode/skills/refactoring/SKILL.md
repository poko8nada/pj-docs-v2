---
name: refactoring
description: Refactor code at the right scope and depth — from function-level cleanup to architectural restructuring. Use this skill when the user asks to refactor, clean up, restructure, or improve existing code.
---

This skill guides refactoring work across four levels, from preparation through architectural restructuring. The level determines the scope of change, the amount of planning required, and whether tests are a prerequisite.

Refactoring means improving code structure without changing behavior. Every level must preserve existing behavior. If a change would alter behavior, it is a feature — not a refactor.

---

## Step 0: Determine the Level

**If the user explicitly specifies a level** (e.g., "lv1", "lv3", "just rename things", "restructure the architecture"), use that level and proceed.

**If the user does not specify**, ask before doing anything else:

> "What level of refactoring are you looking for?
>
> - **Lv0** — Preparation only: assess the code and commit a clean baseline.
> - **Lv1** — Function/file scope: naming, dead code, complexity within a file.
> - **Lv2** — Feature/section scope: restructure across related files. I'll show a plan first.
> - **Lv3** — Architecture scope: redesign module boundaries and system structure. Requires tests. I'll show a plan first."

Do not write any code until the level is confirmed.

---

## Lv0 — Preparation

**Goal**: Establish a clean, committed baseline before any structural change.

**Steps**:

1. Read the target code and assess its current state.
2. Identify which level(s) of refactoring are relevant and worth doing.
3. Note any obvious quick wins, risks, or missing tests.
4. Commit the current working code as-is before touching anything.

**Commit message format**: `chore: baseline commit before refactoring`

Lv0 is the prerequisite for all other levels. Without a committed baseline, there is no safe way to revert if something goes wrong — especially at Lv2 and Lv3 where multiple files are touched.

---

## Lv1 — Function / File Scope

**Goal**: Improve clarity and reduce complexity within a single function or file. No changes outside the file's boundary.

**What you may change**:

- Variable, function, and parameter names (clearer, more intention-revealing)
- Dead code and unused imports
- Deeply nested conditionals (flatten, early return, guard clauses)
- Magic numbers and strings (extract as named constants)
- Long functions (extract sub-functions within the same file)
- Comments that explain _what_ instead of _why_ (rewrite or remove)

**What you must NOT change**:

- Public APIs or exported interfaces
- Behavior visible to callers
- File boundaries (no moving code to other files)

**No planning step required** — assess and execute directly. Tests are not required, but if they exist, they must pass before and after.

### Priority within Lv1

Use this to decide what to tackle first:

| Priority | Act          | Examples                                                        |
| -------- | ------------ | --------------------------------------------------------------- |
| Critical | Fix now      | >3 levels of nesting, knowledge duplicated inside same function |
| High     | This session | Magic numbers, unclear names, functions >30 lines               |
| Nice     | Later        | Minor naming polish, single-use helpers                         |
| Skip     | Leave it     | Already clean - don't touch                                     |

---

## Lv2 — Feature / Section Scope

**Goal**: Restructure across a related group of files (a feature, a domain, a section of the codebase). Module boundaries themselves do not change — only what lives inside them and how it is organized.

**What you may change**:

- Extracting shared logic into a common module within the feature
- Splitting oversized files into focused ones
- Reorganizing responsibilities across files in the same section
- Removing duplication across files (see DRY below)
- Renaming files or directories within the feature boundary

**What you must NOT change**:

- The interfaces between this feature and the rest of the system
- Module-level boundaries (don't merge or split top-level modules)
- Behavior visible to other features

### Show Plan First (Required)

Before writing any code, present a refactoring plan and wait for approval:

> "Here's what I'm proposing for this refactor:
>
> - [What will move and where]
> - [What will be extracted or merged]
> - [What stays the same]
> - [Files affected]
>
> Shall I proceed?"

Do not write code until the user confirms.

### Priority within Lv2

| Priority | Act          | Examples                                                                     |
| -------- | ------------ | ---------------------------------------------------------------------------- |
| Critical | Fix now      | Same business logic duplicated across files, deeply tangled responsibilities |
| High     | This session | Oversized files with multiple unrelated concerns, unclear module ownership   |
| Nice     | Later        | Minor reorganization with no clarity gain                                    |
| Skip     | Leave it     | Structure works well enough for current scale                                |

---

## Lv3 — Architecture Scope

**Goal**: Redesign module boundaries, system structure, or cross-cutting concerns. This is the highest-risk level and requires both tests and explicit user approval before proceeding.

### Test Check (Required First)

Before anything else, check whether meaningful tests exist for the code being restructured.

**If tests exist**: proceed to planning.

**If tests are absent or thin**: stop and respond:

> "Lv3 refactoring restructures module boundaries and can silently change behavior without a test suite to catch regressions. I'd recommend writing tests first before restructuring at this scope. Want me to help identify what to test?"

Do not proceed with Lv3 without tests.

### Show Plan First (Required)

After confirming tests exist, present a full architectural plan before writing any code:

> "Here's the architectural direction I'm proposing:
>
> - [Current structure and its problems]
> - [Proposed structure and its benefits]
> - [Modules that will be created, merged, or removed]
> - [Interfaces that will change and how]
> - [Migration approach — incremental or all-at-once]
> - [Risk areas]
>
> Shall I proceed?"

Wait for explicit approval before writing code.

### What Lv3 covers

- Splitting or merging top-level modules
- Introducing or removing architectural layers (e.g., service layer, repository pattern)
- Redefining public APIs between modules
- Moving shared infrastructure (utilities, types, config) to a new home
- Resolving circular dependencies at the module level

### Priority within Lv3

| Priority | Act          | Examples                                                                 |
| -------- | ------------ | ------------------------------------------------------------------------ |
| Critical | Fix now      | Circular dependencies, business logic leaking into infrastructure layers |
| High     | This session | God modules, unclear ownership of domain concepts                        |
| Nice     | Later        | Cosmetic reorganization with low impact                                  |
| Skip     | Leave it     | Current structure is good enough for the scale                           |

---

## DRY = Knowledge, Not Code

Before abstracting anything at any level, ask: is this the same _concept_ or just the same _shape_?

**Abstract when**:

- The same business concept appears in multiple places
- Both instances would change together if requirements changed
- It is obvious why they belong together

**Keep separate when**:

- Two pieces of code look similar but represent different concepts
- They would evolve independently
- Coupling them would obscure intent

Shared structure is not a reason to abstract. Shared meaning is.

---

## When NOT to Refactor

Do not refactor when:

- The code already works and is clear enough — leave it alone
- No concrete problem is being solved (speculative refactoring)
- The change would alter behavior — that is a feature, write a test for it first
- The only reason to extract code is to make it unit-testable — if the consuming function already has behavioral tests covering it, extraction for testability alone adds structure without adding clarity. Extract for readability, DRY (same knowledge used in multiple places), or separation of concerns — never for testability alone.
- The code is in the middle of active feature work — finish the feature first, then refactor

---

## Commit Messages

```
refactor: extract order validation into dedicated module
refactor: simplify nested conditionals in payment flow
refactor: rename ambiguous parameter names in user service
chore: baseline commit before refactoring
```

**Format**: `refactor: <what changed and why it's clearer now>`

Refactoring commits must not be mixed with feature or bug fix commits. Keep the history readable.
