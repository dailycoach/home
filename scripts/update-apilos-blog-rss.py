#!/usr/bin/env python3
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

RSS_URL = "https://rss.blog.naver.com/apilos.xml"
SOURCE_URL = "https://blog.naver.com/apilos"
OUTPUT_PATH = Path("apilos/news/blog.json")
MAX_SUMMARY_LENGTH = 170
LIMIT = 16


def clean_summary(value: str) -> str:
    value = re.sub(r"<img\b[^>]*>", " ", value or "", flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) <= MAX_SUMMARY_LENGTH:
        return value
    return value[:MAX_SUMMARY_LENGTH].rstrip() + "…"


def safe_naver_url(value: str) -> bool:
    try:
        parsed = urlparse(value)
        host = (parsed.hostname or "").lower()
        return parsed.scheme == "https" and (host == "naver.com" or host.endswith(".naver.com"))
    except Exception:
        return False


def text_of(item: ET.Element, tag: str) -> str:
    node = item.find(tag)
    return html.unescape((node.text or "").strip()) if node is not None else ""


def to_timestamp_ms(value: str) -> int:
    try:
        dt = parsedate_to_datetime(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except Exception:
        return 0


def parse_rss(xml_text: str, limit: int = LIMIT) -> list[dict]:
    root = ET.fromstring(xml_text)
    posts: list[dict] = []
    for item in root.findall(".//item"):
        title = text_of(item, "title")
        url = text_of(item, "link")
        summary = clean_summary(text_of(item, "description"))
        category = text_of(item, "category") or "OFFICIAL BLOG"
        published_at = to_timestamp_ms(text_of(item, "pubDate"))
        if not title or not summary or not safe_naver_url(url) or not published_at:
            continue
        posts.append({
            "title": title,
            "summary": summary,
            "url": url,
            "publishedAt": published_at,
            "category": category,
        })
    posts.sort(key=lambda post: post["publishedAt"], reverse=True)
    return posts[: max(1, min(limit, 20))]


def fetch_rss() -> str:
    request = Request(
        RSS_URL,
        headers={
            "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
            "User-Agent": "KwakDonghyunCounsellingSite/2.0 (+https://blog.naver.com/apilos)",
        },
    )
    with urlopen(request, timeout=10) as response:
        if getattr(response, "status", 200) != 200:
            raise RuntimeError(f"Naver Blog RSS request failed with status {response.status}")
        return response.read().decode("utf-8", errors="replace")


def existing_posts() -> list[dict] | None:
    if not OUTPUT_PATH.exists():
        return None
    try:
        return json.loads(OUTPUT_PATH.read_text(encoding="utf-8")).get("posts")
    except Exception:
        return None


def main() -> int:
    posts = parse_rss(fetch_rss(), LIMIT)
    if not posts:
        raise RuntimeError("Naver Blog RSS did not contain usable blog posts")

    if existing_posts() == posts:
        print("APILOS blog RSS unchanged; no file update needed.")
        return 0

    payload = {
        "sourceUrl": SOURCE_URL,
        "rssUrl": RSS_URL,
        "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "posts": posts,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {OUTPUT_PATH} with {len(posts)} posts.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
