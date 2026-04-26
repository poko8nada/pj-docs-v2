#!/usr/bin/env python3
"""
PAKUTASO 検索結果 HTML から候補（detail URL / サムネ / alt）を取り出す。

`<a href>` を走査し、素材詳細ページらしい URL に絞る（ナビ用 URL は除外）。

テスト: 保存した search.html を stdin に流す
  python3 extract_search_candidates.py < /tmp/pakutaso-search.html
"""
from __future__ import annotations

import json
import re
import sys
from urllib.parse import urlparse

from bs4 import BeautifulSoup

# 例: /20200658153ibus-2.html — 年度っぽい先頭 + 以降 alnum
_DETAIL_PATH = re.compile(r"^/20[0-9]{4,}[0-9a-zA-Z._-]*\.html$", re.IGNORECASE)
_SKIP_IN_HREF = (
    "search.html",
    "/model",
    "/news",
    "/cameraman",
    "/ai/",
    "user.html",
    "user_",
    "js-urlRandom",
)


def _is_likely_material_detail(href: str) -> bool:
    p = (urlparse(href).path or "").strip()
    if not p.endswith(".html"):
        return False
    if p in ("/search.html", "/news.html", "/model.html", "/cameraman.html"):
        return False
    for s in _SKIP_IN_HREF:
        if s in href:
            return False
    return bool(_DETAIL_PATH.match(p))


def extract_candidates_from_html(html: str, *, limit: int = 20) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, str]] = []
    seen: set[str] = set()

    def add_from_anchor(a) -> None:
        href = (a.get("href") or "").strip()
        if not href or "pakutaso.com" not in href:
            return
        if href in seen:
            return
        if not _is_likely_material_detail(href):
            return
        img = a.find("img")
        if not img:
            return
        seen.add(href)
        results.append(
            {
                "detail_url": href,
                "thumbnail_url": (img.get("src") or "").strip(),
                "title": (img.get("alt") or "").strip(),
            }
        )

    for a in soup.find_all("a", href=True):
        add_from_anchor(a)
        if len(results) >= limit:
            break

    return results


def main() -> None:
    html = sys.stdin.read()
    rows = extract_candidates_from_html(html)
    print(json.dumps(rows, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
