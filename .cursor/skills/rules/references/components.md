# Components

## Apply when

Use when changing UI composition, presentation, interaction contracts, or styles. Semantic document markup → also read `markup`.

## Owns

- Component composition, public component APIs, presentation, styling, and UI accessibility contracts.
- Ownership of shared component state and the boundaries between parent and child controls.

## Does not own

- Page outline, landmarks, element semantics, or form markup rules.
- UI state values or transitions (read `ui-state`); domain logic, network I/O, or persistence.

## Handoff

- Read `markup` for semantic HTML structure.
- Read `ui-state` for interaction state and `logic`, `api`, or `data` for domain and boundary concerns.

## Premise

- UI is structure + presentation; keep domain rules out of leaves when possible.
- Related controls belong together — prefer **compound components** (parent owns shared state/context; children are `Tabs` / `Tabs.List` / `Tabs.Panel` style) over prop-drilling siblings or global UI state.
- Accessibility is part of the component contract, not a polish pass. Prefer correct HTML (`markup`) before ARIA patches.

## Placement

- Colocate component, styles, and small presentational helpers in the same feature folder.
- Tokens live in CSS (`@theme inline`); do not reintroduce `tailwind.config.js`.

## Writing

- No `@apply` — utility classes stay at the call site. No bracket variables in class names unless a custom value is required.
- Mobile-first: use Tailwind breakpoint prefixes (`sm:`, `md:`, `lg:`).
- Interactive elements need accessible names (`aria-label` or visible text). Use semantic elements — no `div` for buttons or links.
- Compound sets: expose a clear parent API; children read shared context from the parent, not from ad-hoc props passed through every layer.
