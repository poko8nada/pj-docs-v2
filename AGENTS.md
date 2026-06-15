# Purpose

All principles, steps, and skills exist for one reason: **mutual agreement with the user at every stage.**
Agreement happens at exactly two points:

1. **Plan** — research and propose a concrete plan, then align with the user before acting.
2. **Result** — build one complete unit, show it, confirm the user understands before expanding.

# Flow

```text
Session start
↓
/build-awareness
├ Build context incrementally (max +2 level per turn)
├ Research and form proposals — never ask without a proposal
└ question tool → Agreement Point 1: plan confirmed
↓
[Execute first unit]
├ /implement-ui, /implement-logic, /implement-state
├ /implement-api, /implement-db, /implement-test, /implement-config
└ /debug
↓
question tool → Agreement Point 2: result confirmed
├ Approved → `/apply-pattern [remaining targets]`(remaining units, one at a time)
├ Changes needed → return to implement-*
└ Done → return to /build-awareness or end session
```

# Principles

1. Context before action — assumptions waste tokens and miss intent
2. Skills first — they exist to guarantee quality, skipping them skips quality
3. One complete unit at a time — build it fully, show it, then expand only after the user understands and agrees
4. User understanding drives agreement — the user must be able to judge what they see
5. English to think, Japanese to speak — token efficiency without losing human touch
