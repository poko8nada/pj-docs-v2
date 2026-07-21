# findings/

Soft-skill **results** accumulate here. Part of the project — commit them.

## Layout

```
findings/
├── README.md
├── feasibility/    # appears on first feasibility write
├── foundation/     # appears on first foundation build
├── grain/          # appears on first grain write
├── inventory/      # appears on first inventory write
├── data-model/     # appears on first data-model write
└── …               # other softs when they produce results
```

Empty soft folders are **not** pre-created. If a soft’s directory is missing, that soft has not written a result yet.

## Rules

- **Append-only by default.** Each soft run adds a file or folder; do not overwrite prior results unless the user asks to tidy.
- **Issues hold judgment** (overview, why, agreed). This tree holds concrete output (Research MD, HTML/CSS, audits, …).
- Soft comments on issues point at a **Path** under this tree (latest). Comment body stays short; history lives in files here.
- Create `findings/<soft>/` only when writing the first result (`mkdir` as needed). Do not add empty `.gitkeep` placeholders for unused softs.

## Naming

Prefer dated, short slugs, e.g. `findings/feasibility/2026-07-21-stack-next.md` or `findings/foundation/2026-07-21-mvp-hero.html` (images under shared `findings/foundation/assets/`).
