---
name: image-search
description: Search and download Japanese stock photos from pro.foto.ne.jp (.foto project) using `cmux browser *`. Use when asked to run /image-search, find Japanese free images, or download photos to ./assets. Claude evaluates image quality before downloading.
---

# Image Search Skill

cmux-browser version of `image-search`. Source: **pro.foto.ne.jp** (.foto project family).

## Authority

- The fundamental browser behavior rules for this skill come from the base `cmux-browser` skill.
- This skill must follow those base rules first, then apply the foto-project-specific rules below.
- If there is any conflict, prefer the stricter / lower-memory rule.

## Prerequisites

```bash
mkdir -p ./assets
```

## Why pro.foto.ne.jp

- No registration required. Commercial use OK. No attribution required.
- Images are served directly from `pro.foto.ne.jp` — no external CDN, no bot protection.
- `curl` downloads work out of the box (200 OK, no cookies needed).
- Sister sites with the same URL structure: `model.foto.ne.jp` (people), `food.foto.ne.jp` (food).

## URL Structure

```
# Category listing (search)
https://pro.foto.ne.jp/free/products_list.php/cPath/{cPath}

# Detail page
https://pro.foto.ne.jp/free/product_info.php/products_id/{id}

# Full-size image (direct, no auth)
https://pro.foto.ne.jp/free/img/images_big/{filename}.jpg

# Download endpoint (direct, no auth)
https://pro.foto.ne.jp/free/download_img.php/id/{id}
```

### Category structure (two-level navigation)

The site uses two-level categories. Start from the top-level page (`f_{n}.html`), then drill into subcategories. **Top-level cPaths alone (e.g. `21_25`) return 404** — always use a subcategory cPath.

#### Top-level pages → subcategories

**`/f_25.html` — 風景・自然・景色 (Nature / Scenery)**

| cPath      | Subcategory      |
| ---------- | ---------------- |
| `21_25_33` | 海・海岸・砂浜   |
| `21_25_34` | 空・雲           |
| `21_25_35` | 夕日・朝日・夜空 |
| `21_25_36` | 河川・湖・池     |
| `21_25_37` | 大地・山・丘     |
| `21_25_38` | 雪・氷           |
| `21_25_39` | 水・水面・水中   |
| `21_25_40` | 花火             |

**`/f_26.html` — 植物・樹木・花 (Plants / Trees / Flowers)**

| cPath       | Subcategory        |
| ----------- | ------------------ |
| `21_26_51`  | 樹木・森林         |
| `21_26_52`  | 枝・葉             |
| `21_26_53`  | 桜・さくら         |
| `21_26_129` | 梅・桃             |
| `21_26_128` | 紅葉・黄葉         |
| `21_26_56`  | 草花・自然花       |
| `21_26_57`  | 花束・切花・ブーケ |
| `21_26_54`  | 花のある風景       |
| `21_26_58`  | その他植物イメージ |

**`/f_27.html` — 建物・街・建築 (Buildings / Architecture)**

| cPath       | Subcategory            |
| ----------- | ---------------------- |
| `21_27_59`  | ビル・高層建造物       |
| `21_27_60`  | 夜景・イルミネーション |
| `21_27_61`  | 空撮・眺望・展望       |
| `21_27_62`  | 住宅・民家             |
| `21_27_64`  | 室内・インテリア       |
| `21_27_126` | 神社・寺・教会・学校   |
| `21_27_130` | 公園・庭園・遊園地     |
| `21_27_65`  | 橋・橋梁               |
| `21_27_66`  | その他建造物イメージ   |

**`/f_28.html` — 人物・動物 (People / Animals)**

| cPath      | Subcategory        |
| ---------- | ------------------ |
| `21_28_67` | 赤ちゃん・子供     |
| `21_28_68` | 男性               |
| `21_28_69` | 女性               |
| `21_28_70` | 犬・イヌ           |
| `21_28_71` | 猫・ネコ           |
| `21_28_72` | 魚・魚群           |
| `21_28_73` | マンタ・エイ       |
| `21_28_75` | サンゴ・珊瑚礁     |
| `21_28_76` | 亀・カメ           |
| `21_28_77` | 馬・サラブレッド   |
| `21_28_78` | 鳥・鳥類           |
| `21_28_79` | 虫・昆虫類         |
| `21_28_80` | その他人物イメージ |
| `21_28_81` | その他動物イメージ |

For people-heavy searches, `model.foto.ne.jp` has finer category breakdowns.

**`/f_29.html` — 交通・乗り物 (Vehicles / Transport)**

| cPath      | Subcategory          |
| ---------- | -------------------- |
| `21_29_82` | 道路・トンネル・標識 |
| `21_29_83` | 車・自動車           |
| `21_29_84` | 電車・汽車・線路     |
| `21_29_85` | バイク・二輪車       |
| `21_29_86` | 船舶・ヨット         |
| `21_29_87` | 飛行機・航空機       |

**`/f_30.html` — 食べ物・飲み物・料理 (Food / Drinks)**

| cPath      | Subcategory        |
| ---------- | ------------------ |
| `21_30_89` | 果物・野菜         |
| `21_30_90` | ドリンク・飲料     |
| `21_30_91` | お菓子・デザート   |
| `21_30_92` | 和食料理           |
| `21_30_93` | 洋食料理           |
| `21_30_94` | 食器・キッチン用品 |
| `21_30_95` | その他食材イメージ |

**`/f_31.html` — スポーツ・レジャー (Sports / Leisure)**

| cPath       | Subcategory          |
| ----------- | -------------------- |
| `21_31_96`  | ビーチ・リゾート     |
| `21_31_97`  | プール・プールサイド |
| `21_31_98`  | ゴルフ・ゴルフ場     |
| `21_31_99`  | 野球・サッカー・球技 |
| `21_31_100` | ウォータースポーツ   |
| `21_31_102` | その他スポーツ       |

**`/f_32.html` — オブジェクト (Objects / Miscellaneous)**

| cPath       | Subcategory            |
| ----------- | ---------------------- |
| `21_32_103` | ビジネス・IT・デジタル |
| `21_32_104` | バックグラウンド・背景 |
| `21_32_105` | クリスマス             |
| `21_32_106` | お正月・年賀           |
| `21_32_108` | 文房具・事務用品       |
| `21_32_110` | 照明・ランプ           |
| `21_32_111` | 造形・造型             |
| `21_32_107` | おもちゃ・ぬいぐるみ   |
| `21_32_112` | 楽器・オーディオ       |
| `21_32_113` | ディスプレイ           |
| `21_32_114` | その他オブジェクト     |

#### Searching with keywords

If no subcategory matches the keyword exactly, pick the closest top-level page, navigate to its subcategory list, and select the best-matching subcategory cPath.

---

## Core cmux-browser Rules

1. **One surface for search, one surface per detail page**
   - Open the search page once and store it as `$SEARCH_SURFACE`.
   - Open detail pages only when needed (filename can often be inferred from the thumbnail URL).

2. **`snapshot` refs are ephemeral**
   - Always re-run `snapshot --interactive` after any page change.

3. **Apply Ad Handling after every page transition** (follow base skill procedure).

---

## Surface ID extraction

```bash
SEARCH_SURFACE=$(cmux --json browser open "https://..." \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['surface_ref'])")
```

---

## Phase 0: Setup

```bash
mkdir -p ./assets
```

Load the seen-image list to skip already-downloaded images:

```bash
python3 .opencode/skills/image-search/scripts/load_seen.py
```

Outputs `---SEEN---` JSON. Store `seen_urls` in memory for Phase 2.

---

## Phase 1: Search

### Step 1: Pick the subcategory cPath

Match the search keyword to the closest subcategory from the table above. If the exact cPath is clear, skip to Step 2. If unsure, navigate to the top-level `f_{n}.html` page and extract subcategory links to find the best match:

```bash
cmux browser $SEARCH_SURFACE navigate "https://pro.foto.ne.jp/f_{n}.html"
cmux browser $SEARCH_SURFACE wait --load-state complete --timeout-ms 10000
cmux browser $SEARCH_SURFACE get html body | python3 -c "
import sys
from bs4 import BeautifulSoup
html = sys.stdin.read()
soup = BeautifulSoup(html, 'html.parser')
for a in soup.find_all('a', href=True):
    href = a['href']
    if 'cPath' in href and 'products_list' in href:
        cpath = href.split('cPath/')[-1]
        text = a.get_text(strip=True)
        if text:
            print(f'{cpath}\t{text}')
"
```

### Step 2: Open the subcategory listing

Use the subcategory `cPath` (never a top-level cPath like `21_25` alone — those return 404):

```bash
SEARCH_SURFACE=$(cmux --json browser open \
  "https://pro.foto.ne.jp/free/products_list.php/cPath/{sub_cPath}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['surface_ref'])")
cmux browser $SEARCH_SURFACE wait --load-state complete --timeout-ms 10000
```

### Step 3: Extract candidates

Get the page HTML and parse product links:

```bash
cmux browser $SEARCH_SURFACE get html body | python3 -c "
import sys, re
from bs4 import BeautifulSoup
html = sys.stdin.read()
soup = BeautifulSoup(html, 'html.parser')
for a in soup.select('a[href*=\"product_info.php\"]'):
    href = a.get('href', '')
    img = a.find('img')
    if not href or not img:
        continue
    m = re.search(r'products_id/(\d+)', href)
    if not m:
        continue
    pid = m.group(1)
    title = img.get('alt', '') or a.get_text(strip=True)
    src = img.get('src', '')
    print(pid, '|||', src, '|||', title)
"
```

Collect up to **20 candidates** per search.

### Phase 1 output

```
---CANDIDATES---
[{"products_id": "300467", "thumbnail_url": "https://pro.foto.ne.jp/free/img/...", "title": "..."}, ...]
```

---

## Phase 2: AI Quality Judgment

Evaluate each candidate using the thumbnail URL and title only — **no need to open detail pages**.

Evaluation criteria:

- **Relevance**: Does the subject clearly match the search keyword?
- **Composition**: Is the framing natural and well-balanced?
- **Exposure**: Not too dark, not blown out.
- **Sharpness**: No obvious blur or motion artifacts.
- **Naturalness**: For people photos, are expressions and poses natural?
- **Usability**: Suitable for web or print use?

Select the **top 3 images** by default, or the number specified by the user.

Exclude any `products_id` whose detail URL is already in `---SEEN---`.

### Phase 2 output

```
---SELECTED---
[{"products_id": "300467", "thumbnail_url": "...", "title": "..."}, ...]
```

---

## Phase 3: Download

For each image in `---SELECTED---`:

### 3-1. Resolve the filename

**Primary method: infer from thumbnail URL.** The thumbnail path pattern is:
`img/images_thumb/{filename-base}.jpg` → full-size is `img/images_big/{filename-base}.jpg`.

Example: thumbnail `img/images_thumb/kis0148-009.jpg` yields filename `kis0148-009.jpg`.

**Fallback: open the detail page.** The `og:image` meta tag is sometimes missing or stale across page transitions in WKWebView. If the thumbnail URL does not clearly contain the filename, open the detail page and look for the first `<img>` tag with `images_big` in its `src`:

```bash
DETAIL_SURFACE=$(cmux --json browser open \
  "https://pro.foto.ne.jp/free/product_info.php/products_id/{products_id}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['surface_ref'])")

cmux browser $DETAIL_SURFACE wait --load-state complete --timeout-ms 10000
cmux browser $DETAIL_SURFACE get html body | python3 -c "
import sys
from bs4 import BeautifulSoup
html = sys.stdin.read()
soup = BeautifulSoup(html, 'html.parser')
for img in soup.find_all('img'):
    src = img.get('src', '')
    if 'images_big' in src:
        print(src.split('/')[-1])
        break
"
```

### 3-2. Download with curl

```bash
# Direct image URL — no cookies, no session required
curl -L -o "./assets/{filename}" \
  "https://pro.foto.ne.jp/free/img/images_big/{filename}"
```

Alternatively, use the download endpoint:

```bash
curl -L -o "./assets/{filename}" \
  "https://pro.foto.ne.jp/free/download_img.php/id/{products_id}"
```

Verify the file:

```bash
ls -lh "./assets/{filename}"
```

### 3-3. Check orientation (if needed)

pro.foto images mix portrait and landscape within the same subcategory. There is no way to filter by orientation before downloading — the thumbnail URL suffix (e.g. `-009`) does not reliably indicate orientation.

Use `sips` to check dimensions after download:

```bash
sips -g pixelWidth -g pixelHeight "./assets/{filename}"
```

If the image is the wrong orientation, discard it and try the next candidate. Keep the original selection list expanded to account for orientation filtering.

---

## Phase 4: Cleanup

pro.foto.ne.jp serves images directly with no external CDN, so no process cleanup is needed.

---

## Output format

```
- ![{title}](./assets/{filename})
  - https://pro.foto.ne.jp/free/product_info.php/products_id/{products_id}
  - {one-line description of what is in the photo}
```

---

## Seen-image tracking

After a successful run, record downloaded images:

```bash
python3 .opencode/skills/image-search/scripts/save_seen.py \
  "https://pro.foto.ne.jp/free/product_info.php/products_id/{products_id}"
```

---

## Troubleshooting

**No candidates extracted**

- The `cPath` may be incorrect. Get the category page HTML with `cmux browser $SEARCH_SURFACE get html body` and identify the correct `cPath` from the navigation links.
- Top-level cPaths like `21_25` or `21_26` alone return 404. Always use a full subcategory cPath (e.g. `21_25_37`).

**Pagination returns the same results**

- The `/page/N` parameter is unreliable — the site often returns the same 20 products regardless of the page number. To get different results, change the sort order:
  - `{cPath}` / `sort/0d` — default (recommended order)
  - `{cPath}/sort/1d` — new arrivals first
  - `{cPath}/sort/1a` — oldest first (useful for discovering different images)

**Keyword search not available on pro.foto**

- `products_list.php?keyword=...` returns 404. Only category/subcategory browsing is supported on pro.foto.ne.jp.
- The search form on the page redirects to `stock.foto` (paid stock marketplace), not pro.foto.

**curl fails (non-200)**

- Run `curl -I "https://pro.foto.ne.jp/free/img/images_big/{filename}"` to inspect headers.
- If the filename is wrong, re-open the detail page and look for `<img src="...images_big/...">` as described in Phase 3-1.

**Filename not found**

- The `og:image` meta tag on detail pages is often missing in WKWebView. Use the thumbnail URL inference method first (Phase 3-1 primary method).

**Page shows wrong content after navigate**

- WKWebView may serve cached content. Always verify the URL with `cmux browser $SURFACE get url` after navigation. If content is stale, try adding a query parameter or navigating through the top-level page.

**Image is wrong orientation**

- The site mixes portrait and landscape within the same subcategory. Select more candidates than needed in Phase 2, then filter by orientation in Phase 3-3 using `sips`.
