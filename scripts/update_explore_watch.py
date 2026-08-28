#!/usr/bin/env python3
"""Monitor Burlington-area event sources and write structured review candidates.

This remains a discovery layer. Listings are published only after their date, place,
access details and image rights are verified in the curated Explore event files.
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
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data" / "explore-sources.json"
OUTPUT = ROOT / "data" / "explore-watch.json"
TERMS = {
    "event", "events", "festival", "concert", "market", "movie", "movies",
    "eclipse", "aurora", "meteor", "winter", "fall", "fair", "family",
    "art", "arts", "culture", "dance", "music", "outdoor", "workshop",
    "tour", "food", "tree", "planting", "cleanup", "clean up",
    "neighbourhood", "pokemon", "ultimate", "final"
}


class Document(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.base = ""
        self.current_link: dict[str, str] | None = None
        self.links: list[dict[str, str]] = []
        self.in_jsonld = False
        self.jsonld_buffer: list[str] = []
        self.jsonld_blocks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "base" and values.get("href"):
            self.base = values["href"] or ""
        if tag == "a" and values.get("href"):
            self.current_link = {"href": values["href"] or "", "title": ""}
        if tag == "script" and "ld+json" in str(values.get("type", "")).lower():
            self.in_jsonld = True
            self.jsonld_buffer = []

    def handle_data(self, data: str) -> None:
        if self.current_link is not None:
            self.current_link["title"] += data
        if self.in_jsonld:
            self.jsonld_buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.current_link is not None:
            self.links.append(self.current_link)
            self.current_link = None
        if tag == "script" and self.in_jsonld:
            block = "".join(self.jsonld_buffer).strip()
            if block:
                self.jsonld_blocks.append(block)
            self.in_jsonld = False
            self.jsonld_buffer = []


def fetch(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "BurlingtonNewsExploreWatch/2.0 (+https://burlingtonnews.ca/)",
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"
        }
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read(3_500_000).decode(response.headers.get_content_charset() or "utf-8", "replace")


def clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", html.unescape(str(value or ""))).strip(" |")


def parse_datetime(value: object) -> dt.datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = dt.datetime.combine(dt.date.fromisoformat(text[:10]), dt.time.min)
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def flatten_jsonld(value: Any) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(value, dict):
        found.append(value)
        graph = value.get("@graph")
        if graph is not None:
            found.extend(flatten_jsonld(graph))
    elif isinstance(value, list):
        for item in value:
            found.extend(flatten_jsonld(item))
    return found


def location_text(value: object) -> str:
    if isinstance(value, str):
        return clean_text(value)
    if not isinstance(value, dict):
        return ""
    name = clean_text(value.get("name"))
    address = value.get("address")
    if isinstance(address, str):
        address_text = clean_text(address)
    elif isinstance(address, dict):
        address_text = ", ".join(
            clean_text(address.get(key))
            for key in ("streetAddress", "addressLocality", "addressRegion")
            if clean_text(address.get(key))
        )
    else:
        address_text = ""
    return ", ".join(part for part in (name, address_text) if part)


def schema_candidates(source: dict[str, object], document: Document) -> list[dict[str, object]]:
    now = dt.datetime.now(dt.timezone.utc)
    rows: list[dict[str, object]] = []
    source_url = str(source["url"])
    discovery_only = "discovery only" in str(source.get("status", "")).lower()

    for block in document.jsonld_blocks:
        try:
            payload = json.loads(block)
        except Exception:
            continue
        for item in flatten_jsonld(payload):
            types = item.get("@type", "")
            if isinstance(types, str):
                types = [types]
            if not any(str(kind).lower() == "event" for kind in types or []):
                continue
            title = clean_text(item.get("name"))
            if len(title) < 5:
                continue
            start = parse_datetime(item.get("startDate"))
            end = parse_datetime(item.get("endDate")) or (start + dt.timedelta(hours=3) if start else None)
            if end and end < now - dt.timedelta(hours=2):
                continue
            url = urllib.parse.urljoin(document.base or source_url, str(item.get("url") or source_url))
            rows.append({
                "title": title[:180],
                "url": url.split("#", 1)[0],
                "source": str(source["name"]),
                "scope": str(source["scope"]),
                "priority": int(source.get("priority", 3)),
                "discoveryOnly": discovery_only,
                "startsAt": start.isoformat() if start else "",
                "endsAt": end.isoformat() if end else "",
                "location": location_text(item.get("location")),
                "description": clean_text(item.get("description"))[:360],
                "candidateType": "structured-event"
            })
    return rows


def link_candidates(source: dict[str, object], document: Document) -> list[dict[str, object]]:
    found: list[dict[str, object]] = []
    seen: set[str] = set()
    source_url = str(source["url"])
    requested = {str(item).lower() for item in source.get("topics", [])}
    discovery_only = "discovery only" in str(source.get("status", "")).lower()
    for link in document.links:
        title = clean_text(link["title"])
        url = urllib.parse.urljoin(document.base or source_url, link["href"])
        haystack = f"{title} {url}".lower()
        if len(title) < 8 or not any(term in haystack for term in TERMS | requested):
            continue
        clean_url = url.split("#", 1)[0]
        if clean_url in seen or urllib.parse.urlparse(clean_url).scheme not in {"http", "https"}:
            continue
        seen.add(clean_url)
        found.append({
            "title": title[:180],
            "url": clean_url,
            "source": str(source["name"]),
            "scope": str(source["scope"]),
            "priority": int(source.get("priority", 3)),
            "discoveryOnly": discovery_only,
            "startsAt": "",
            "endsAt": "",
            "location": "",
            "description": "",
            "candidateType": "link"
        })
    return found[:35]


def candidates(source: dict[str, object], body: str) -> list[dict[str, object]]:
    document = Document()
    document.feed(body)
    combined = schema_candidates(source, document) + link_candidates(source, document)
    deduped: dict[str, dict[str, object]] = {}
    for row in combined:
        key = str(row.get("url") or row.get("title")).lower()
        previous = deduped.get(key)
        if previous is None or row.get("candidateType") == "structured-event":
            deduped[key] = row
    return list(deduped.values())[:45]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="validate configured sources without network access")
    args = parser.parse_args()
    config = json.loads(SOURCES.read_text())
    rows: list[dict[str, object]] = []
    status: list[dict[str, object]] = []

    if not args.offline:
        for source in config["sources"]:
            try:
                body = fetch(str(source["url"]))
                discovered = candidates(source, body)
                rows.extend(discovered)
                status.append({
                    "name": source["name"],
                    "url": source["url"],
                    "scope": source["scope"],
                    "ok": True,
                    "candidates": len(discovered)
                })
            except Exception as error:
                status.append({
                    "name": source["name"],
                    "url": source["url"],
                    "scope": source["scope"],
                    "ok": False,
                    "error": str(error)[:180]
                })

    rows.sort(key=lambda row: (
        1 if row.get("discoveryOnly") else 0,
        -int(row.get("priority", 3)),
        str(row.get("startsAt") or "9999"),
        str(row.get("title") or "")
    ))
    payload = {
        "checkedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "publicationGate": "Candidates only. Verify the organizer, date, end time, exact location, access details and image rights before adding to the live Explore feed.",
        "regionPolicy": config.get("regionPolicy", {}),
        "sources": status if not args.offline else config["sources"],
        "candidates": rows[:350]
    }
    if args.offline:
        print(f"Validated {len(config['sources'])} Explore sources")
        return
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
