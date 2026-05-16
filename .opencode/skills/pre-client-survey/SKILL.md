---
name: pre-client-survey
description: >
  Conduct a pre-survey for a client and fill in the template.
  Browsing Google Maps directly is mandatory.
  Use when receiving a /pre-client-survey command, or a client name, industry, and area.
  Output as pre_survey.md.
---

# Pre-client-survey

## Critical Rules (Read Before Any Action)

**Violating any of these rules means the results are zero and a redo is guaranteed.**

1. **Always check Google Maps first (mandatory, do not skip)**
   - Google Maps is the most important data source, no exceptions.
   - Open Google Maps in a real browser using `browser-use --headed` with a profile.
   - Substituting web_search or web_fetch for Google Maps is prohibited.
   - Only use supplementary channels after confirming Maps data is insufficient.

2. **Do not take lazy shortcuts**
   - "It takes too long" or "Maps is hard" are not valid reasons to skip it.
   - Attempting to replace Google Maps with web_search or web_fetch will result in a mandatory redo.

3. **Complete all phases in order**
   - Phase 0 → 1 → 2 → 3 → 4 → 5 → 6. Do not change this order.
   - Finish each phase completely before moving to the next.

---

## Prerequisites

1. Confirm browser-use is available:

```bash
browser-use doctor
```

2. List available profiles (to inherit Google account login state):

```bash
browser-use profile list
```

3. Clear any leftover sessions from previous runs:

```bash
browser-use close --all
browser-use sessions
```

---

## Phase 0: Confirm Input (mandatory, do not skip)

Determine the survey target. Obtain the following from the user or command arguments:

- Client name (or trade name)
- Industry (e.g. café, chiropractic clinic, hair salon)
- Area (e.g. Chuo-ku, Fukuoka)

**If any information is missing, ask the user now.** Do not proceed to Phase 1 until all three are confirmed.

---

## Phase 1: Google Maps Research (mandatory, do not skip)

### Step 1: Open Google Maps in headed mode

```bash
browser-use --headed --profile "<profile>" --session "gmaps" open "https://www.google.com/maps/search/{client_name}+{area}"
browser-use --headed --profile "<profile>" --session "gmaps" state
```

### Step 2: Navigate to the client's place page

- Identify the client's listing from search results and open the detail panel.
- **Always re-run `browser-use state` after any page transition.** Never reuse stale indices.

### Step 3: Collect the following data (all required)

| Field                            | Source                     |
| -------------------------------- | -------------------------- |
| Display name                     | Store name on Maps         |
| Address                          | Address field on Maps      |
| Phone number                     | Phone field on Maps        |
| Business hours (per day)         | Hours panel on Maps        |
| Closed days                      | Hours panel or description |
| Official website URL             | Website link on Maps       |
| Average rating                   | Star rating on Maps        |
| Review count                     | Review count on Maps       |
| Review text (10+ recent reviews) | Reviews panel on Maps      |

### Step 4: Extract reviews

Expand the reviews panel and extract text using `python(browser.html)`:

```bash
browser-use --headed --profile "<profile>" --session "gmaps" python "from bs4 import BeautifulSoup; soup = BeautifulSoup(browser.html, 'html.parser'); text = '\n'.join(line.strip() for line in soup.get_text('\n').splitlines() if line.strip()); print(text[:5000])"
```

- Only use supplementary channels (Phase 2) if fewer than 5 reviews are available or extraction fails.
- **If Maps reviews are sufficient, skip Phase 2.**

### Phase 1 Completion Criteria

- All fields in the table above are recorded (explicitly write `N/A` for missing fields — do not leave blanks).
- At least 5 review texts are collected.

---

## Phase 1.5: Client Website Analysis (mandatory if official URL exists, do not skip)

If an official website URL was found in Phase 1, analyze it before moving on.

### Step 1: Fetch the site

```bash
web_fetch <official_website_url>
```

If the site is JavaScript-heavy and web_fetch returns thin content, open it in browser-use:

```bash
browser-use --headed --profile "<profile>" --session "client-site" open "<official_website_url>"
browser-use --headed --profile "<profile>" --session "client-site" python "from bs4 import BeautifulSoup; soup = BeautifulSoup(browser.html, 'html.parser'); print(soup.get_text('\n')[:4000])"
```

### Step 2: Collect the following

| Field                  | What to look for                                              |
| ---------------------- | ------------------------------------------------------------- |
| Overall color scheme   | Primary / accent / background colors                          |
| Typography feel        | Serif / sans-serif, formal / casual                           |
| Visual tone            | Luxury, friendly, clinical, energetic, etc.                   |
| Site structure         | Number of pages, navigation items, what is prominently linked |
| Hero / top messaging   | What is the first thing visitors see and read                 |
| CTA presence           | Is there a clear call-to-action (reservation, contact, etc.)? |
| Mobile responsiveness  | Does it render properly on mobile?                            |
| Content gaps           | Missing info users would want (hours, pricing, access, etc.)  |
| Estimated last updated | Any news, blog, or copyright year clues                       |

### Step 3: Assess — new build or redesign?

Based on the analysis, make a preliminary judgment:

- **New build**: Site does not exist, is severely outdated, or the brand direction needs a complete change.
- **Redesign**: Structure and content are largely usable but visual / UX improvements are needed.

Record this judgment. It will feed into Phase 4.

### Phase 1.5 Completion Criteria

- All fields in the table above are recorded.
- New build vs. redesign preliminary judgment is noted.
- If no official site exists, write `N/A — no existing site` and proceed.

---

## Phase 2: Supplementary Research (only if Maps data is insufficient)

Use supplementary channels only for fields that could not be obtained from Google Maps.

**Supplementary channels (in priority order):**

1. Official website (URL from Phase 1) → `web_fetch`
2. Google search with the name → `web_search`

**Rules when using supplementary channels:**

- Record the source for each piece of supplementary information.
- Do not overwrite Maps data with supplementary data — Maps always takes priority.
- For the registered legal name, refer to the corporate number registry if needed.

---

## Phase 3: Competitor Research (mandatory, do not skip)

### Step 1: Search for competitors on Google Maps

Find up to **3 competitors** in the same industry.

```bash
browser-use --headed --profile "<profile>" --session "gmaps-comp" open "https://www.google.com/maps/search/{industry}+{area}"
browser-use --headed --profile "<profile>" --session "gmaps-comp" state
```

### Step 2: Selection criteria

Choose competitors with variety across the following dimensions:

- 1–2 competitors within the same trade area (near)
- 0–1 strong competitor outside the trade area (far)
- Mix of pricing tiers (upper / middle / lower)

### Step 3: Collect basic info for each competitor

- Name
- Area (near / far)
- Pricing (upper / middle / lower)
- Scale (upper / middle / lower)
- Reason for selection (1–2 sentences)

### Step 4: Analyze each competitor's website

For each competitor that has an official site, fetch and analyze it using the same method as Phase 1.5.

```bash
web_fetch <competitor_url>
```

Open in browser-use if web_fetch returns thin content. For each site, record:

| Field                  | What to look for                             |
| ---------------------- | -------------------------------------------- |
| URL                    | Official site URL                            |
| Color scheme           | Primary / accent colors, overall palette     |
| Visual tone            | Luxury, friendly, clinical, energetic, etc.  |
| Key message / lead     | What they lead with on the homepage          |
| CTA type               | Reservation, inquiry form, LINE, phone, etc. |
| Strengths of the site  | What works well visually or structurally     |
| Weaknesses of the site | What is confusing, missing, or dated         |

### Phase 3 Completion Criteria

- 1–3 competitors selected with selection reason.
- Website analysis recorded for each competitor that has a site.

---

## Phase 4: Hypothesis for Website Project

### Step 1: Analyze review keywords

From the review texts collected in Phase 1:

- **Positive keywords**: Recurring phrases from favorable reviews (e.g. "attentive," "clean," "good value")
- **Negative keywords**: Recurring phrases from critical reviews or complaints

### Step 2: Confirm project direction — new build or redesign?

Combine the Phase 1.5 preliminary judgment with what you learned from competitor sites:

- **New build**: No existing site, severely outdated, or brand direction needs a complete reset.
- **Redesign**: Existing site has usable content/structure but needs visual or UX improvement.

State the conclusion clearly: `New build` or `Redesign`, with a one-sentence rationale.

### Step 3: Write the website hypothesis

Answer each of these for the website project specifically:

- **Target audience**: Who should land on this site, and what are they looking for?
- **Core message**: What single idea should the site communicate above all else?
- **Strengths to highlight**: What does the client do better than competitors — and how should the site show it?
- **Weaknesses to avoid exposing**: What gaps or risks should the site design work around?

### Step 4: Propose design and copy direction

Based on competitor site analysis and the hypothesis above, propose:

- **Design direction**: Visual tone, color mood, layout style (e.g. "warm and minimal, earthy tones, photo-forward")
- **Copy direction**: Tone of voice (e.g. "approachable expert, first-person, short sentences")
- **Elements to align with competitors**: Things competitors do well that should be matched as baseline
- **Elements to differentiate**: Specific choices that will make this site stand out

If you considered and rejected other directions, note them briefly with reasons.

---

## Phase 5: Output the Template (mandatory, do not skip)

### Output path

```
content/pre_survey.md
```

### Rules for filling the template

- Replace every `{ }` placeholder with real data.
- Write `N/A` for any field that could not be obtained — never leave blanks.
- Keep the Markdown structure (headings, tables) identical to the template below.

### Template

Use this exact structure. Fill every `{ }` with real data before writing the file.

```markdown
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Pre-survey

## Scope

- クライアント情報の取得と整理
- 競合情報の取得と整理
- Webサイト制作に向けた仮説立項

---

## Client Information

### Basic

- 表示名: { }
- 登記名: { }
- 所在地: { }
- 住所: { }
- 電話番号: { }
- 営業時間:
  - MON: { }
  - TUE: { }
  - WED: { }
  - THU: { }
  - FRI: { }
  - SAT: { }
  - SUN: { }
- 定休日: { }
- 公式サイト URL: { }
- その他リンク:
  - { }

### Review

- 平均: { }
- レビュー数: { }
- 特徴の要約: { }

#### Recurring Topics (Keywords)

- ポジティブ: { }
- ネガティブ: { }

### Current Website

- プロジェクト方向性: { new build / redesign }
- カラー・雰囲気: { }
- サイト構成: { }
- ヒーロー・トップメッセージ: { }
- CTA: { }
- モバイル対応: { }
- コンテンツの不足: { }
- 総評: { }

---

## Competitor Analysis

| no  | name     | area       | pricing              | scale                |
| --- | -------- | ---------- | -------------------- | -------------------- |
| 0   | {client} | -          | {upper/middle/lower} | {upper/middle/lower} |
| 1   |          | {near/far} | {upper/middle/lower} | {upper/middle/lower} |

### Competitor Websites

1. { name }
   - URL: { }
   - カラー・雰囲気: { }
   - トップメッセージ: { }
   - CTA: { }
   - 強み: { }
   - 弱み: { }

---

## Hypothesis for Website Project

- プロジェクト方向性: { new build / redesign }
- 根拠: { }

### Target & Message

- ターゲット: { }
- サイトで伝えるべきコアメッセージ: { }

### Strengths & Weaknesses

- 強み（サイトで前面に出す）: { }
- 弱み（サイトで露出を避ける）: { }

### Design & Copy Direction

- デザイン方向性: { }
- コピー・トーン: { }

## Differentiation Strategy

- 競合と同じで良い要素
  - { }
- 競合と差別化する要素
  - { }
```

### Pre-output Checklist

- [ ] All `{ }` placeholders are filled
- [ ] Business hours are filled per day of the week
- [ ] Current website section is filled (or marked `N/A — no existing site`)
- [ ] Competitor table has 1–3 rows
- [ ] Competitor website analysis filled for each competitor
- [ ] Project direction (new build / redesign) is stated with rationale
- [ ] Design and copy direction are proposed
- [ ] File is written to `content/`

---

## Phase 6: Cleanup (mandatory, do not skip)

```bash
browser-use close --all
browser-use sessions
```

Confirm the session list shows `No active sessions`.

Clean up leftover subprocesses:

```bash
pgrep -f "browser-use-user-data-dir" || true
pkill -f "browser-use-user-data-dir" 2>/dev/null || true
```

Re-verify: `browser-use sessions` → `No active sessions`, and `pgrep -f "browser-use-user-data-dir"` → no matches.

---

## Troubleshooting

**Client listing not found on Google Maps**
→ Try alternate spellings (katakana ↔ hiragana, trade name vs. legal name). If still not found, ask the user.

**Reviews panel won't open or HTML extraction fails**
→ Re-run `browser-use state` to get fresh indices. Maps pages change frequently — stale indices become invalid quickly.

**Business hours hidden behind a "See hours" button**
→ Click the button to expand, then re-run `state` / `python(browser.html)` to extract.

**Competitor search returns too many unrelated listings**
→ Narrow the search query (e.g. "café Tenjin" → "specialty coffee Tenjin"), or visually identify relevant listings by trade area on the map.
