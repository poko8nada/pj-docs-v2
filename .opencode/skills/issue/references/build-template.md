# Build Template

Use this template for the Build issue body. Reference the Design issue's body and all comments when creating.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Build turns a Design into working code. The deliverable is a 5-section plan, locked by explicit user agreement, then a vertical-slice implementation.
- The plan must reconcile research with the actual codebase before any slice is written.
- Slices are vertical, not horizontal — one slice per concern (R / C / U / D, draft → harden), each verifiable in one sitting. Bundled slices are forbidden.
- Reference the [Design] issue body for component structure, Props, and TODOs. Fetch with `gh issue view <design_number> --json body | jq -r '.body'`.

### Success Criteria

- All five plan sections are concrete: file paths, function names, library APIs from Step 1 reconciliation.
- Slices split by concern (R / C / U / D), each with Test + App verification. Test policy decided per slice.
- User has approved the plan via `question` before any code is written.

### Common Failure Modes

- Plan without Step 1 reconciliation — claims that contradict the actual code.
- Bundled slices ("Add X CRUD", "Build the auth feature"). Draft-first, grow slice by slice.
- Ad-hoc tests or no Test policy decision per slice.
- Treating user agreement as implied.

<!-- FOR AGENT — do not edit. Operating instructions. -->

---

## Goal

<このユニットで何を構築するか>

## Reference

- Design: #<design_number>
- Design outputs: <summary of design deliverables>
- Codebase: <relevant files/patterns identified>

## What

<何を実装するか>

## How

<どうやって実装するか>

## Order

<どの順に実装するか — 垂直スライスで叩き台から>

## Verify

<どう検証するか — test pass + ユーザーがアプリ動かして確認>

---

# Build Progress

## Stages

<!-- [Order] セクションの slice 一覧を stage 単位で転記。stage 完了時に [x] に更新する -->

- [ ]

## Notes

<!-- 各 stage 完了時のメモ、out-of-scope / defer / 仕様変更など、次セッションが拾う情報 -->
```
