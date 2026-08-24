#!/usr/bin/env python3
"""Monitor official event sources and write candidates for editorial review.

This does not publish listings. Exact dates, places, access details and image rights
remain a human verification gate in data/explore-events.json.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data" / "explore-sources.json"
OUTPUT = ROOT / "data" / "explore-watch.json"
TERMS = {
    "event", "events", "festival", "concert", "market", "movie", "movies",
    "eclipse", "aurora", "meteor", "winter", "fall", "tree", "planting",
    "cleanup", "clean up", "neighbourhood", "pokemon", "ultimate", "final"
}


class Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.base = ""
        self.current: dict[str, str] | None = None
        self.links: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "base" and values.get("href"):
            self.base = values["href"] or ""
        if tag == "a" and values.get("href"):
            self.current = {"href": values["href"] or "", "title": ""}

    def handle_data(self, data: str) -> None:
        if self.current is not None:
            self.current["title"] += data

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.current is not None:
            self.links.append(self.current)
            self.current = None


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "BurlingtonNewsExploreWatch/1.0"})
    with urllib.request.urlopen(request, timeout=16) as response:
        return response.read(2_500_000).decode(response.headers.get_content_charset() or "utf-8", "replace")


def candidates(source: dict[str, object], body: str) -> list[dict[str, str]]:
    parser = Links()
    parser.feed(body)
    found: list[dict[str, str]] = []
    seen: set[str] = set()
    source_url = str(source["url"])
    requested = {str(item).lower() for item in source.get("topics", [])}
    for link in parser.links:
        title = re.sub(r"\s+", " ", html.unescape(link["title"])).strip(" |")
        url = urllib.parse.urljoin(parser.base or source_url, link["href"])
        haystack = f"{title} {url}".lower()
        if len(title) < 8 or not any(term in haystack for term in TERMS | requested):
            continue
        clean_url = url.split("#", 1)[0]
        if clean_url in seen or urllib.parse.urlparse(clean_url).scheme not in {"http", "https"}:
            continue
        seen.add(clean_url)
        found.append({"title": title[:180], "url": clean_url, "source": str(source["name"]), "scope": str(source["scope"])})
    return found[:25]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="validate configured sources without network access")
    args = parser.parse_args()
    config = json.loads(SOURCES.read_text())
    rows = []
    status = []
    if not args.offline:
        for source in config["sources"]:
            try:
                body = fetch(source["url"])
                rows.extend(candidates(source, body))
                status.append({"name": source["name"], "url": source["url"], "ok": True})
            except Exception as error:
                status.append({"name": source["name"], "url": source["url"], "ok": False, "error": str(error)[:180]})
    payload = {
        "checkedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "publicationGate": "Candidates only. Verify dates, location, access and image rights before adding to explore-events.json.",
        "sources": status if not args.offline else config["sources"],
        "candidates": rows
    }
    if args.offline:
        print(f"Validated {len(config['sources'])} Explore sources")
        return
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
