# Spec Template

Use this template for the Spec issue body. The Spec is the root of every downstream phase (Design, Build, Refine). It is persistent: 1 Spec per project or version.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- The Spec captures product design — Goal, Scope, Architecture. It is the root of every downstream phase.
- Update only when Goal, Scope, or Architecture shifts. Everything else goes in comments.
- Comments on the Spec record phase lifecycle events (Design created, Build created, etc.) — not progress.
- The Spec is the source of truth. When code drifts, fix the Spec first.

### Success Criteria

- All six sections present, zero blocking Open Questions for v1, every Stack row has a Reason.

### Common Failure Modes

- Spec absorbs implementation details. Non-goals that are really goals. Stack reasons that restate the obvious.
- Code and Spec drift, silently maintained on both sides.

<!-- FOR AGENT — do not edit. Operating instructions. -->

---

## What is this product?

## Features

- 
- 

## Non-goals

- 
- 

## Stack

| Area | Choice | Reason |
| ---- | ------ | ------ |
|      |        |        |

## Roadmap

- **v1**: 
- **v2**: 

## Open Questions

- [ ] 
- [ ] 
```
