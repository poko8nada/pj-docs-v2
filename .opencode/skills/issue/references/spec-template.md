# Spec Template

Use this template for the Spec body.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- The Spec captures product design — Goal, Scope, Architecture. It is the root of every downstream phase.
- Update only when Goal, Scope, or Architecture shifts. Everything else goes in comments.
- Comments are the work log — every Design / Build / Refine lifecycle event is recorded here.
- The Spec is the source of truth. When code drifts, fix the Spec first.

### Success Criteria

- All six sections present, zero blocking Open Questions for v1, every Stack row has a Reason.
- The Spec is the only product-truth source for Design / Build / Refine.

### Common Failure Modes

- Spec absorbs implementation details. Non-goals that are really goals. Stack reasons that restate the obvious.
- Code and Spec drift, silently maintained on both sides.

<!-- FOR AGENT — do not edit. Operating instructions. -->

---

## What is this product?

<どんなプロダクトか 1 文で>

## Features

- 機能 1
- 機能 2

## Non-goals

- 対象外 1
- 対象外 2

## Stack

| Area | Choice | Reason |
| ---- | ------ | ------ |
| ...  | ...    | ...    |

## Roadmap

- **v1**: ...
- **v2**: ...

## Open Questions

- [ ] 未解決事項 1
- [ ] 未解決事項 2
```
