---
name: feasibility
description: >-
  Soft skill: research tech topics with Official / Practice / Failure sources; write findings/feasibility/.
  Use before locking Stack or Build tech choices, or whenever memory is insufficient.
---

# feasibility

Cited research only. Append-only under `findings/feasibility/`. No GitHub issues.

Each Step is one unit — finish before the next unless user allows a short path. Tools/tiers → `references/sources.md`.

## Steps

1. **Stack awareness** — read manifests; note stack for version-aware queries. Done → stop if slicing.
2. **Topics** — if pre-scoped, one-line confirm; else agree 2–5 specific actionable topics. Vague → stay here.
3. **Investigate** — per topic (or one topic per sitting): three roles (Official / Practice / Failure). See `references/sources.md`.
4. **Output** — post Research MD → “この結果で次に進んでよいですか？”
   - yes → write `findings/feasibility/<dated-slug>.md` + handoff
   - edit → revise; may return to 2/3
   - no → back to Step 2

## Format

```markdown
## Research

### [Topic]

- Claim: …
- Confidence: …

#### Evidence

- Official: …
- Practice: …
- Failure: …
```

Handoff: Topic / Path / Why / Summary / Axes touched.

## Limits

- No memory-only APIs/versions without cite-or-omit.
- No single-source or same-role triple.
- Do not overwrite prior findings without user ask.
- Do not edit issues or product code outside findings.
