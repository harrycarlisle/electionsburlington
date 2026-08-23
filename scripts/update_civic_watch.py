#!/usr/bin/env python3
"""Collect a small, source-linked Burlington civic news watch using only stdlib.

The script does not infer sentiment or rewrite political claims. It records new source
links and titles so the public brief can be reviewed against primary/local sources.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ARCHIVE = DATA / "archive"

SOURCES = [
    {
        "name": "City of Burlington Election",
        "url": "https://myvote.burlington.ca/for-voters/list-of-candidates/",
        "type": "official",
    },
    {
        "name": "City of Burlington News",
        "url": "https://www.burlington.ca/en/news-and-notices/news-and-notices.aspx",
        "type": "official",
    },
    {
        "name": "BurlingtonToday Election",
        "url": "https://www.burlingtontoday.com/2026-municipal-election-news",
        "type": "reporting",
    },
    {
        "name": "BurlingtonToday Local News",
        "url": "https://www.burlingtontoday.com/local-news",
        "type": "reporting",
    },
]

KEYWORDS = (
    "election", "candidate", "mayor", "council", "councillor", "budget", "tax",
    "housing", "development", "traffic", "transit", "ward", "data centre",
    "data center", "planning", "regional council", "property tax",
)

USER_AGENT = "BurlingtonElectionGuide/1.0 (+https://electionsburlington.ca/)"


class LinkParser(HTMLParser):
    def __init__(self, base: str):
        super().__init__()
        self.base = base
        self.current_href: str | None = None
        self.current_text: list[str] = []
        self.links: list[dict[str, str]] = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self.current_href = urllib.parse.urljoin(self.base, href)
            self.current_text = []

    def handle_data(self, data):
        if self.current_href:
            self.current_text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self.current_href:
            text = re.sub(r"\s+", " ", html.unescape(" ".join(self.current_text))).strip()
            if text:
                self.links.append({"title": text, "url": self.current_href})
            self.current_href = None
            self.current_text = []


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=25) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def relevant(title: str, url: str) -> bool:
    hay = f"{title} {url}".lower()
    return any(k in hay for k in KEYWORDS)


def clean_links(source: dict[str, str], body: str) -> list[dict[str, str]]:
    parser = LinkParser(source["url"])
    parser.feed(body)
    seen = set()
    items = []
    for link in parser.links:
        title = link["title"].strip(" -–—|•")
        url = link["url"]
        if len(title) < 12 or len(title) > 180 or not relevant(title, url):
            continue
        key = (title.lower(), url.split("#")[0])
        if key in seen:
            continue
        seen.add(key)
        items.append({
            "title": title,
            "url": url,
            "source": source["name"],
            "sourceType": source["type"],
        })
    return items[:30]


def main() -> None:
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    collected: list[dict[str, str]] = []
    source_status = []

    for source in SOURCES:
        try:
            body = fetch(source["url"])
            links = clean_links(source, body)
            collected.extend(links)
            source_status.append({"source": source["name"], "ok": True, "found": len(links)})
        except Exception as exc:  # source outages should not break the whole monitor
            source_status.append({"source": source["name"], "ok": False, "error": str(exc)[:180]})

    deduped = []
    seen_urls = set()
    for item in collected:
        key = item["url"].split("#")[0].rstrip("/")
        if key in seen_urls:
            continue
        seen_urls.add(key)
        deduped.append(item)

    payload = {
        "checkedAt": now.isoformat().replace("+00:00", "Z"),
        "method": "Rule-based source monitor. Titles and links are collected; no sentiment score or political conclusion is generated.",
        "sources": source_status,
        "items": deduped[:60],
    }

    DATA.mkdir(parents=True, exist_ok=True)
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    (DATA / "source-monitor.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    day = now.date().isoformat()
    (ARCHIVE / f"{day}.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    brief_path = DATA / "daily-brief.json"
    if brief_path.exists():
        brief = json.loads(brief_path.read_text(encoding="utf-8"))
        brief["sourcesCheckedAt"] = payload["checkedAt"]
        brief_path.write_text(json.dumps(brief, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
