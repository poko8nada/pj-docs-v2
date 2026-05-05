---
name: image-search
description: Search and download Japanese stock photos from PAKUTASO using browser-use. Use when asked to run /image-search, find Japanese free images, or download photos to ./assets. Claude evaluates image quality before downloading.
---

# Image Search Skill

Browser-use version of `image-search`.

## Authority

- The fundamental browser behavior rules for this skill come from the base `browser-use` skill under `~/.cursor/skills/browser-use/SKILL.md`.
- This skill must follow those base rules first, then apply the pakutaso-specific rules below.
- If there is any conflict, prefer the stricter / lower-memory rule.

## Prerequisites

1. Confirm browser-use is available:

```bash
browser-use doctor
```

2. Ensure output directory exists (create if missing):

```bash
mkdir -p ./assets
```

3. Start from a clean browser-use slate:

```bash
browser-use close --all
browser-use sessions
```

## Core Browser-use Rules

1. **One session for the entire run**
   - Use a single named session `pakutaso` throughout.
   - Do not create one session per keyword or per image.
   - Do not create a new session to "start fresh" mid-run — reuse the same one.

2. **Do not spam `open` — this eats memory**
   - `open` spawns a new window inside the session and keeps the old one alive.
   - Use `open` only to start the search page, and then for each shortlisted detail page.
   - Do **not** `open` every candidate's detail page. Run Phase 2 (AI judgment) first using thumbnails only, then `open` only the selected images.
   - Use `back` to return from a detail page instead of `open`-ing the search page again.
   - If you notice memory pressure or many windows accumulating, run `browser-use close --all` immediately and restart the session.

3. **`state` indices are ephemeral**
   - After every `open`, `back`, `click`, or any page change, always re-run `browser-use state`.
   - Never trust an old index after the page has changed.

4. **Ad handling is mandatory on every page transition**
   - After every `open` or `back`, check for ad overlays before doing anything else.
   - See **Ad Handling** section below.

5. **Close and verify at the end**

```bash
browser-use close --all
browser-use sessions
```

6. **Clean up leftover subprocesses**

```bash
pgrep -f "browser-use-user-data-dir" || true
pkill -f "browser-use-user-data-dir" 2>/dev/null || true
```

---

## Ad Handling (apply after every page transition)

After every `open` or `back`, always run `state` first:

```bash
browser-use --headed --session "pakutaso" state
```

If state reveals any of the following, it is an ad overlay — dismiss it:

- A close button labeled ×, ✕, close, skip, 閉じる, 後で, or similar
- A full-screen or semi-transparent overlay obscuring the main content
- A modal element unrelated to the photo content

Dismiss it:

```bash
browser-use --headed --session "pakutaso" click <index>
```

Then re-run `state` to confirm the overlay is gone. Repeat until the main content is visible. If no overlay is present, proceed immediately without clicking.

---

## Phase 0: Setup

```bash
mkdir -p ./assets
browser-use close --all
browser-use sessions
```

Load the seen-image list to skip already-downloaded images:

```bash
python3 .cursor/skills/image-search/scripts/load_seen.py
```

Outputs `---SEEN---` JSON. Store `seen_urls` in memory for Phase 3.

---

## Phase 1: Search

### URL structure

No form interaction is needed. Construct the search URL directly and open it:

```
https://www.pakutaso.com/search.html?search={keyword}
```

Multiple keywords use `+` (URL-encoded space):

```
https://www.pakutaso.com/search.html?search=東京+夜景
```

Open it:

```bash
browser-use --headed --session "pakutaso" open "https://www.pakutaso.com/search.html?search={keyword}"
```

Apply **Ad Handling** immediately after open.

### Extract candidates from search results

**Working directory:** Run `browser-use` from the **project repository root** so the helper script path resolves.

**Extraction strategy:** The helper walks all `<a href>` links, keeps entries that look like PAKUTASO **material detail** pages (e.g. `https://www.pakutaso.com/20200658153ibus-2.html`) with a child `<img>`, and skips nav-only URLs (`/search`, `/model`, `/news`, `/ai/`, etc.). It does not rely on per-card class names, which change over time.

After the page loads cleanly, run:

```bash
browser-use --headed --session "pakutaso" python "
import importlib.util
import pathlib
p = pathlib.Path('.cursor/skills/image-search/scripts/extract_search_candidates.py').resolve()
s = importlib.util.spec_from_file_location('extract_search_candidates', p)
m = importlib.util.module_from_spec(s)
s.loader.exec_module(m)
for r in m.extract_candidates_from_html(browser.html):
    print(r['detail_url'], '|||', r['thumbnail_url'], '|||', r['title'])
"
```

Helper implementation (for edits and unit checks): `.cursor/skills/image-search/scripts/extract_search_candidates.py` — optional: save the search result HTML to a file and pipe it for a quick check:

```bash
python3 .cursor/skills/image-search/scripts/extract_search_candidates.py < /path/to/saved-search.html
```

Collect up to **20 candidates** per search. If output is still empty, re-run `state` on the search page, then inspect `browser.html` (or saved HTML) and adjust `_is_likely_material_detail` in `extract_search_candidates.py` — keep this skill and the script in sync.

### Phase 1 output

```
---CANDIDATES---
[{"detail_url": "...", "thumbnail_url": "...", "title": "..."}, ...]
```

---

## Phase 2: AI Quality Judgment

Claude evaluates each candidate using the thumbnail URL and title **without opening the detail page**.

Evaluation criteria:

- **Relevance**: Does the subject clearly match the search keyword?
- **Composition**: Is the framing natural and well-balanced?
- **Exposure**: Not too dark, not blown out.
- **Sharpness**: No obvious blur or motion artifacts.
- **Naturalness**: For people photos, are expressions and poses natural and not stiff?
- **Usability**: Is it suitable for web or print use (not a watermarked or cropped preview)?

Select the **top 3 images** by default, or the number specified by the user.

Exclude any `detail_url` already present in `---SEEN---`.

Output:

```
---SELECTED---
[{"detail_url": "...", "thumbnail_url": "...", "title": "..."}, ...]
```

---

## Phase 3: Download

For each image in `---SELECTED---`:

### 3-1. Open detail page

```bash
browser-use --headed --session "pakutaso" open "{detail_url}"
```

Apply **Ad Handling** immediately after open.

### 3-2. Extract L-size download URL

The download button has a fixed class `-downloadL`. Extract its `href` with:

```bash
browser-use --headed --session "pakutaso" python "
from bs4 import BeautifulSoup
soup = BeautifulSoup(browser.html, 'html.parser')
a = soup.select_one('a.-downloadL')
if a:
    print(a['href'])
else:
    print('NOT_FOUND')
"
```

Expected URL format:

```
https://user0514.cdnw.net/shared/img/thumb/{filename}.jpg?&download=1
```

If `NOT_FOUND`, log a warning and skip this image.

### 3-3. Download via curl

Extract the filename from the URL (the part before `?`):

```bash
# Example URL: https://user0514.cdnw.net/shared/img/thumb/sorasanPAR55748.jpg?&download=1
# Filename: sorasanPAR55748.jpg

curl -L -o "./assets/{filename}" "{download_url}"
```

Verify the file was saved:

```bash
ls -lh ./assets/{filename}
```

### 3-4. Return to search results

```bash
browser-use --headed --session "pakutaso" back
```

Apply **Ad Handling** after `back`.

---

## Phase 4: Cleanup

```bash
browser-use close --all
browser-use sessions
```

Clean up orphaned processes:

```bash
pgrep -f "browser-use-user-data-dir" || true
pkill -f "browser-use-user-data-dir" 2>/dev/null || true
```

Re-verify: `browser-use sessions` → `No active sessions`, and `pgrep -f "browser-use-user-data-dir"` → no matches.

---

## Output format

Report downloaded images:

```
- ![{title}](./assets/{filename})
  - {detail_url}
  - {one-line description of what is in the photo}
```

---

## Seen-image tracking

After a successful run, record downloaded `detail_url` values (arguments **or** stdin, one URL per line):

```bash
python3 .cursor/skills/image-search/scripts/save_seen.py "https://www.pakutaso.com/....html" "https://..."
# or: printf '%s\n' "url1" "url2" | python3 .cursor/skills/image-search/scripts/save_seen.py
```

This prevents re-downloading the same image in future runs.

---

## Troubleshooting

**Ad overlay blocks interaction**

- Re-run `state` after every page change.
- Look for any element with ×, ✕, 閉じる, skip, 後で in its text or aria-label.
- If the overlay cannot be identified from `state`, use `python(browser.html)` to inspect the DOM.

**`-downloadL` not found**

- The page may not have finished loading. Wait briefly and re-run the python extraction.
- Re-run `state` to check if the download section is visible.

**No candidates**

- Confirm you ran `browser-use` from the **repo root** (the `extract_search_candidates` import path is relative to cwd).
- If a layout change yields zero rows, save the HTML, inspect `a[href]`, and tighten `_is_likely_material_detail` in `extract_search_candidates.py` (e.g. stricter or looser path rules).

**curl download is empty or corrupted**

- Check the URL with `curl -I "{download_url}"` to confirm it returns 200.
- If it returns 302, add `-L` to follow redirects (already included by default).

**Many Python / Chrome processes left after the run**

- Run `pkill -f "browser-use-user-data-dir"` to clean up temp Chrome instances.
- Then check `pgrep -fl browser-use` and terminate obvious zombie processes.
