# Refine Template

Use this template for the Refine issue body. Reference the Build issue's body and all comments when creating.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Refine improves existing code. The deliverable is a 5-section plan grounded in actual code analysis, locked by explicit user agreement, then a vertical-slice implementation.
- Improvements are prioritized by impact (High / Medium / Low / Risky). Hypothetical cleanups are not targets.
- Slices are vertical, not horizontal — one slice per concern (Extract / Dedup / Simplify, etc.), each verifiable in one sitting. Bundled refactors are forbidden.
- If a refinement changes user-facing behavior, the Spec is updated before the code.

### Success Criteria

- All five plan sections are concrete: file paths, function names, line numbers from Step 1 analysis.
- Improvements ranked by impact tier in the Rationale section.
- Slices split by concern, each with Test + App verification.
- User has approved the plan via `question` before any code is written.

### Common Failure Modes

- Improvements not grounded in actual code — hypothetical cleanups.
- Unprioritized list of improvements. Refactoring "the entire module" or "all auth code".
- New tests added ad-hoc across slices, or no test regression check before/after each slice.
- Treating user agreement as implied.

<!-- FOR AGENT — do not edit. Operating instructions. -->

---

## Goal

<このユニットで何を改善するか>

## Reference

- Build: #<build_number>
- Build outputs: <summary of build deliverables>
- Codebase: <current state after build>

## What

<何を改善するか — コード品質、エラーハンドリング、パフォーマンス等>

## Risks

- <リスク1 — 既存機能が壊れる可能性>
- <リスク2>

## Order

<どの順に改善するか — 垂直スライスで>

## Verify

<どう検証するか — 既存テストが通ること + 改善効果の確認>

---

# Refine Progress

## Stages (by impact tier)

<!-- [Order] セクションの slice を High / Medium / Low / Risky でグルーピング。stage 完了時に [x] に更新する -->

- [ ] **High**:
- [ ] **Medium**:
- [ ] **Low**:
- [ ] **Risky**:

## Notes

<!-- 各 stage 完了時のメモ、out-of-scope / defer / 仕様変更など、次セッションが拾う情報 -->
```
