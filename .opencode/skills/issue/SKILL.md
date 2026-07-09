---
name: issue
description: "Create, update, transition, or close Spec / Design / Build / Refine issues. Use when the user starts a new phase, switches between phases, or finalizes an existing one. Do not use for ad-hoc tasks outside the Spec flow."
---

# issue

Manage issues using a Spec-based flow. One Spec holds the product design for a feature area. Design, Build, Refine issues are created sequentially, each referencing the previous phase's content and the current codebase.

On creation, the body holds the format only (empty); it is updated as work proceeds to reflect the current state.

## Before creating any issue

All gh CLI operations (create, comment, edit, close, list, view) are performed via the **gh-cli** skill — delegate to it for the actual commands.

Always establish shared understanding first. Present in one message:

**Context** (max 2 sentences)
{current project phase, existing issues and their status, what's been completed}

**Understanding** (max 3 sentences)
{what issue is needed, why now, which phase (Spec/Design/Build/Refine) it belongs to}

**Proposal** (max 2 sentences)
{issue type, suggested title following the convention below, key content points}

Discuss with the user. Revise based on their feedback. Repeat until aligned. Only after agreement, read the corresponding template from References and create the issue.

## Principles

- **Spec** — The product design for one feature area. Holds the abstract Goal, Scope, Architecture, and decisions. Rarely changes; only updated when Goal / Scope / Architecture shifts.
  - Update Spec body — Only when Goal / Scope / Architecture changes. After updating, record the change and its reason in a comment.
- **Phase issues** — Design, Build, Refine issues are created just-in-time and closed after completion. Each phase references the previous phase's issue content, all comments, and the current codebase.
- **Body is the source of truth** — The body (including the spec sections) is updated as work proceeds. It must reflect the current state, not a snapshot of an old state. Drift between body and code is a failure mode.
- **Comments** — The living work log. Spec comments record lifecycle events. Phase issue comments record updates.
- Issues serve as session-to-session memory. Always reference the issue number in commits and PR descriptions.

## Comment Rules (required)

Every lifecycle event must produce a comment. The comment is the work log.

| Event           | Target       | Comment format                            |
| --------------- | ------------ | ----------------------------------------- |
| Spec created    | -            | (no comment — creation body is enough)    |
| Spec updated    | Spec         | `## 更新: <what changed>\n<why>`          |
| Design created  | Spec         | `## Design作成: <title>\n<what>`          |
| Design updated  | Design Issue | `## 更新: <what changed>\n<why>`          |
| Design complete | Spec         | `## Design完了: <title>\n<what was done>` |
| Build created   | Spec         | `## Build作成: <title>\n<what>`           |
| Build updated   | Build Issue  | `## 更新: <what changed>\n<why>`          |
| Build complete  | Spec         | `## Build完了: <title>\n<what was done>`  |
| Refine created  | Spec         | `## Refine作成: <title>\n<what>`          |
| Refine updated  | Refine Issue | `## 更新: <what changed>\n<why>`          |
| Refine complete | Spec         | `## Refine完了: <title>\n<what was done>` |

When creating a phase issue, the content must reference:

- Previous phase's issue body
- All comments on the previous phase's issue
- Current codebase state

## Title convention

- Spec: `[Spec] <product / feature area name>` (one per project or version)
- Design: `[Design] <what this design achieves>`
- Build: `[Build] <what this build achieves>`
- Refine: `[Refine] <what this refine achieves>`

## References

- Phase templates: `references/spec-template.md`, `references/design-app-template.md`, `references/design-web-template.md`, `references/build-template.md`, `references/refine-template.md`
- Design has two variants — app and web — chosen from project type and stack. Use the matching template.
- gh CLI operations: use the `gh-cli` skill
