# HTML

Apply when writing document markup for the web — static pages or the HTML structure inside UI. React/Tailwind/compound API → `components`; this file is **website document manners**.

## Premise

- HTML is a document outline first — headings, landmarks, and links should make sense with CSS disabled.
- Prefer native elements over `div`/`span` with role theatre. The right tag is the first accessibility win.
- One page, one `<h1>`. Heading levels nest without skipping when the outline is yours to control.

## Placement

- Keep page shell / layout markup with the route or feature folder (colocate with its styles and small helpers — see `shared`).
- Shared chrome (`header`, `nav`, `footer`) lives in one place; do not copy-paste landmark structure per page.

## Writing

- Use landmarks meaningfully: `header`, `nav`, `main`, `footer` (and `aside` when it is truly complementary). Avoid wrapping everything in anonymous `div`s.
- Links go places (`<a href>`); buttons do actions (`<button>`). Do not make clickable `div`s.
- Forms: label every control (`<label for>` or wrapping label). Group related fields with `fieldset` / `legend` when it helps.
- Images that convey meaning need `alt` text; decorative images get empty `alt` (and no redundant caption).
- Interactive custom widgets still need keyboard reachability and an accessible name — prefer a native control when it fits; otherwise see also `components` a11y.
