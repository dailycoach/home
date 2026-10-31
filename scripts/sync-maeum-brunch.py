#!/usr/bin/env python3
"""Refresh the public Maeum Library article index from DAILYCOACHING on Brunchstory."""

from __future__ import annotations

import html
import json
import re
import sys
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET


RSS_URL = "https://brunch.co.kr/rss/@@1e5M"
AUTHOR_URL = "https://brunch.co.kr/@dailycoach"
AUTHOR_NAME = "DAILYCOACHING"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "maeum-library/assets/brunch-posts.json"
MAX_POSTS = 20
MAX_SUMMARY = 170


def text_of(item: ET.Element, name: str) -> str:
    node = item.find(name)
    return html.unescape("".join(node.itertext()).strip()) if node is not None else ""


def is_brunch_article(value: str) -> bool:
    parsed = urlparse(value)
    return (
        parsed.scheme == "https"
        and parsed.hostname == "brunch.co.kr"
        and bool(re.fullmatch(r"/@@1e5M/\d+", parsed.path))
    )


def clean_summary(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"(?is)<(script|style)\b[^>]*>.*?</\1>", " ", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value[:MAX_SUMMARY].rstrip() + ("…" if len(value) > MAX_SUMMARY else "")


def publication_date(value: str) -> str | None:
    try:
        date = parsedate_to_datetime(value)
        if date.tzinfo is None:
            date = date.replace(tzinfo=timezone.utc)
        return date.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError, IndexError):
        return None


def parse_rss(xml_text: str) -> list[dict[str, str]]:
    root = ET.fromstring(xml_text)
    posts: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in root.findall(".//item"):
        link = text_of(item, "link")
        title = text_of(item, "title")
        date = publication_date(text_of(item, "pubDate"))
        if not title or not date or not is_brunch_article(link) or link in seen:
            continue
        seen.add(link)
        posts.append({
            "title": title,
            "link": link,
            "summary": clean_summary(text_of(item, "description")),
            "publishedAt": date,
        })
    posts.sort(key=lambda item: item["publishedAt"], reverse=True)
    return posts[:MAX_POSTS]


def fetch_rss() -> str:
    request = Request(
        RSS_URL,
        headers={
            "Accept": "application/rss+xml, application/xml, text/xml;q=0.9",
            "User-Agent": "DAILYCOACHING-MaeumLibrary/3.0 (+https://daily-coach-ing.com/maeum-library/)",
        },
    )
    with urlopen(request, timeout=15) as response:
        if getattr(response, "status", 200) != 200:
            raise RuntimeError(f"Brunch RSS HTTP {response.status}")
        raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise RuntimeError("Brunch RSS exceeded size limit")
        return raw.decode("utf-8-sig")


def main() -> int:
    posts = parse_rss(fetch_rss())
    if not posts:
        raise RuntimeError("Brunch RSS contained no valid posts; keeping prior snapshot")

    previous = None
    if OUTPUT_PATH.exists():
        try:
            previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            pass

    if previous and previous.get("items") == posts and previous.get("authorUrl") == AUTHOR_URL:
        print("Brunch feed unchanged; no file update needed")
        return 0

    payload = {
        "authorName": AUTHOR_NAME,
        "authorUrl": AUTHOR_URL,
        "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "items": posts,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(posts)} Brunch posts")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
