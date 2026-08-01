# Documents

## Apply when

Use when writing or modifying document prose or structure. Issue / README substance → `issue` / `readme` skills.

## Owns

- Document outline, emphasis, lists, tables, and local cross-references.
- Placement of local notes and document structure near the feature it describes.

## Does not own

- Goal / Discover / Build or Issue content.
- README substance, product policy, code conventions, or UI markup.

## Handoff

- Use `issue` or `readme` for owned content in those document types.
- Use `markup` for semantic HTML and `conventions` for cross-cutting placement or naming.

## Premise

- Emphasis is scarce — bold is a signal, not decoration.
- Dense tables hide structure; prefer headings and lists when rows grow.

## Placement

- Keep document source next to what it describes when it is local notes; product docs follow repo layout (`README` at root, templates under skills).
- Do not put Goal / Discover / Build / README substance into ad-hoc markdown — `issue` / `readme` skills own the content.

## Writing

- Bold (`**…**`) — at most one per paragraph (a list item counts as its own paragraph). Bold is scarce, not forbidden: keep one signal when readers must not skip a constraint, boundary, or cross-ref.
- Structural labels (`**Default:**`, `**Exit:**`, `**Harness:**`) — preserve structure with headings (or an equivalent outline), not bold lead-ins.
- When cleaning label-bold, do not strip other emphasis; remove decoration, keep sparse signals.
- Tables — small/medium width, **total cell characters per row < 100**. For multi-row content, use headings or nested bullet points. If a table is in a provided template, follow the template but keep it compact.
