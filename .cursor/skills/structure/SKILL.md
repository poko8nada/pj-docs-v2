---
name: structure
description: >
  Reads pre_survey.md and README.md ## Concept & Goals to generate a site structure (structure.md).
  Automatically runs in redesign mode with diff analysis if content/investigate_<domain>.md exists.
  Use when: "create site structure", "make structure.md", "plan the page layout".
  Output: content/structure.md
---

# Structure

This skill derives the **minimum viable site structure** from research and interview memos,
filtered through this project's philosophy, and outputs it as `content/structure.md`.

The judgment axis is always `README.md ## Concept & Goals`.
Research findings and existing site content are raw material — the philosophy decides what stays.

---

## Critical Rules

1. **Philosophy first**
   - "It exists on the current site" is not a reason to keep it
   - "The client wants it" is not a reason to include it if it conflicts with the philosophy — note it as an open question instead
   - Every decision must trace back to a specific line in `README.md ## Concept & Goals`

2. **Keep the structure minimal**
   - Default to the fewest sections that still serve the user
   - Merge pages where possible rather than defaulting to one page per topic

3. **No component names in output**
   - `structure.md` uses `role` only — the semantic purpose of a section
   - Component selection happens in a separate implementation phase

4. **Auto-detect mode**
   - `content/investigate_*.md` exists → **redesign mode**
   - Does not exist → **new-build mode**

---

## Phase 0: File Check & Mode Detection

### Step 1: Check required files

```bash
ls content/
```

| File                       | Required / Optional | Purpose                                              |
| -------------------------- | ------------------- | ---------------------------------------------------- |
| `README.md`                | Required            | Project philosophy - read `## Concept & Goals`       |
| `content/pre_survey.md`    | Required            | Market, competitor, and client data                  |
| `content/interview.md`     | Optional            | Client interview notes                               |
| `content/investigate_*.md` | Optional            | Existing site investigation - triggers redesign mode |

If `pre_survey.md` is missing, stop and ask the user to run the pre-survey skill first.

### Step 2: Confirm mode

```bash
ls content/investigate_*.md 2>/dev/null && echo "REDESIGN" || echo "NEW BUILD"
```

Branch all subsequent phases based on the detected mode.

---

## Phase 1: Load the Philosophy

```bash
cat README.md
```

Extract and hold as internal reference from `## Concept & Goals`:

- **Goals** — what this project is trying to achieve
- **Non-goals** — what is explicitly out of scope
- **Operational assumptions** — static delivery, no CMS, etc.

Every decision from this point on must be grounded in this content.

---

## Phase 2: Load Inputs

### Read pre_survey.md

```bash
cat content/pre_survey.md
```

Extract:

- Client's industry and target audience
- Services and information the client provides
- Positive / negative keywords from reviews
- Competitor site structure patterns
- Project direction (new build / redesign) and rationale
- Design and copy direction hypothesis
- Differentiation strategy

### Read interview.md (if present)

```bash
cat content/interview.md 2>/dev/null || echo "NOT FOUND"
```

If present, cross-reference with pre_survey to surface client priorities and intent.

---

## Phase 3: Existing Site Analysis (redesign mode only)

```bash
cat content/investigate_*.md
```

Extract:

- Current page list and URL structure
- Section layout and roles per page
- Detected features (CMS, dynamic content, third-party integrations)

### Diff judgment rules

For each existing page or section, assign one of three verdicts:

| Verdict     | Condition                                                               |
| ----------- | ----------------------------------------------------------------------- |
| `keep`      | Aligns with the philosophy and works as static HTML                     |
| `drop`      | Requires a CMS, high-frequency updates, or falls under Non-goals        |
| `transform` | The purpose is valid but the form needs to change to fit the philosophy |

**Typical `drop` cases:**

- Blog or news archives (require frequent updates)
- Member login / my-page
- Dynamic search
- Stale case study or news listing pages

**Typical `transform` cases:**

- Dynamic contact form → static page + embedded external form service
- CMS-managed service listing → static HTML services page
- Multiple thin pages → consolidated into one

---

## Phase 4: Derive the Structure

### List page candidates

Using pre_survey, interview, and diff analysis (redesign), list candidate pages.

For each candidate, ask:

> **Is this information something this client must hold as official primary source?
> Is this the shortest path for a user to find it without friction?**

### Define section roles

Assign a `role` to each section on each page.
A role is not a component name — it is the **semantic purpose** the section serves on the page.

**Example roles (name them to fit the project, not fixed):**

| role          | meaning                                           |
| ------------- | ------------------------------------------------- |
| `lead`        | The brand's core message. Headline + hero visual  |
| `explanation` | Overview of the service or business               |
| `strengths`   | Why choose this client - key differentiators      |
| `facts`       | Location, hours, access - factual reference info  |
| `conversion`  | CTA driving the user to the next action           |
| `context`     | Intro that frames the purpose of the page         |
| `listing`     | Services, works, or items enumerated              |
| `form-area`   | Contact form (external embed or backend API)      |
| `trust`       | Awards, press, testimonials - credibility signals |

### Validate page and section count

- Merge pages that can be combined without losing user access to information
- Re-examine every section: "does this role genuinely need to exist?"
- Contact should almost always be a standalone page (external form or backend API assumed)

---

## Phase 5: Output structure.md

### Output path

```
content/structure.md
```

### Format rules

- Page structure in a YAML code block
- Design rationale and diff summary (redesign mode) in Markdown prose
- No component names — `role` only

### Template (new-build mode)

````markdown
---
updated: YYYY-MM-DD
mode: new-build
source:
  - content/pre_survey.md
  - content/interview.md # only if present
---

# Site Structure

## Design rationale

{ 2–3 paragraphs explaining why this page count and section order.
Trace each decision back to the philosophy in README.md ## Concept & Goals. }

## Structure

```yaml
frame:
  header: { standard / compact / minimal }
  footer: { standard / minimal }

pages:
  - route: /
    label: home
    sections:
      - role: lead
        note: { key point this section communicates }
      - role: explanation
        note: {}
      - role: conversion
        note: {}

  - route: /about
    label: about
    sections:
      - role: context
        note: {}
      - role: strengths
        note: {}

  - route: /contact
    label: contact
    sections:
      - role: context
        note: {}
      - role: form-area
        note: { expected form service or backend API }
```

## Open questions

- { anything deferred and why }
````

### Template addition (redesign mode only)

Add a `## Diff summary` section before `## Open questions`:

```markdown
## Diff summary

### Drop

| Page / Section         | Reason                                         |
| ---------------------- | ---------------------------------------------- |
| { existing page name } | { which Goal or Non-goal this conflicts with } |

### Transform

| Existing                    | New                 | Reason |
| --------------------------- | ------------------- | ------ |
| { existing page / section } | { new role / page } | { }    |

### Keep

| Page / Section | Notes |
| -------------- | ----- |
| { }            | { }   |
```

### Pre-output checklist

- [ ] Every decision references `README.md ## Concept & Goals`
- [ ] Anything matching Non-goals is excluded from the structure
- [ ] Section count is genuinely minimal
- [ ] No component names appear in any `role` field
- [ ] Redesign mode: every row in the diff summary has a reason
- [ ] Open questions records anything deferred
- [ ] File written to `content/structure.md`

---

## Troubleshooting

**pre_survey.md is missing**
→ Stop. Ask the user to run the pre-survey skill first.

**Multiple investigate\_\*.md files exist**
→ Ask the user which one to use before proceeding.

**Client wants a blog**
→ This falls under Non-goals (no high-frequency content updates built in).
Record it in Open questions and exclude it from the structure.
Note it as out of scope if needed.

**Hard to decide whether to merge pages**
→ Ask: "If combined into one page, can the user still find everything without friction?"
If yes, merge.
