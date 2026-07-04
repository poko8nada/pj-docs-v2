---
name: issue
description: "Manage substantial work using Spec-based flow. One Spec holds the product design. Design, Build, Refine issues are created sequentially, each referencing the previous phase's content and the current codebase. Use when the work spans multiple sessions or units, or when the user asks to create an issue. Skip for single-unit, session-bound work."
---

# issue

Manage issues using a Spec-based flow. One Spec holds the product design for a feature area. Design, Build, Refine issues are created sequentially, each referencing the previous phase's content and the current codebase.

## Before creating any issue

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
- **Phase issues** — Design, Build, Refine issues are created just-in-time and closed after completion. Each phase references the previous phase's issue content, all comments, and the current codebase.
- **Comments** — The living work log. Spec comments record lifecycle events. Phase issue comments record updates and progress.
- Issues serve as session-to-session memory. Always reference the issue number in commits and PR descriptions.
- **Update Spec body** — Only when Goal / Scope / Architecture changes. After updating, record the change and its reason in a comment.

## Flow

```
Spec (1 per product/version)
  ↓ (Spec body + all comments)
Design → Design complete (close issue)
  ↓ (Design Issue body + all comments + codebase)
Build → Build complete (close issue)
  ↓ (Build Issue body + all comments + codebase)
Refine → Refine complete (close issue)
  ↓
Next Spec
```

## Comment Rules (required)

Every lifecycle event must produce a comment. The comment is the work log.

| Event           | Target       | Comment format                            |
| --------------- | ------------ | ----------------------------------------- |
| Spec created    | -            | (no comment — creation body is enough)    |
| Spec updated    | Spec         | `## 更新: <what changed>\n<why>`          |
| Design created  | Spec         | `## Design作成: <title>\n<what>`          |
| Design updated  | Design Issue | `## 更新: <what changed>\n<why>`          |
| Design progress | Design Issue | `## 進捗: <current state>`                |
| Design complete | Spec         | `## Design完了: <title>\n<what was done>` |
| Build created   | Spec         | `## Build作成: <title>\n<what>`           |
| Build updated   | Build Issue  | `## 更新: <what changed>\n<why>`          |
| Build progress  | Build Issue  | `## 進捗: <current state>`                |
| Build complete  | Spec         | `## Build完了: <title>\n<what was done>`  |
| Refine created  | Spec         | `## Refine作成: <title>\n<what>`          |
| Refine updated  | Refine Issue | `## 更新: <what changed>\n<why>`          |
| Refine progress | Refine Issue | `## 進捗: <current state>`                |
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

- Phase templates: `references/spec-template.md`, `references/design-template.md`, `references/build-template.md`, `references/refine-template.md`
- Commands: `references/commands.md`
