"""Conservative public-feed fetch. Fail closed. Do not scrape X or private pages."""

from __future__ import annotations

import html
import json
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from typing import Any

USER_AGENT = "BurlingtonNewsDiscovery/1.0 (+https://burlingtonnews.ca/methodology.html)"


class LinkParser(HTMLParser):
    def __init__(self, base: str):
        super().__init__()
        self.base = base
        self.href = None
        self.bits: list[str] = []
        self.links: list[dict[str, str]] = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            href = dict(attrs).get("href")
            if href:
                self.href = urllib.parse.urljoin(self.base, href)
                self.bits = []

    def handle_data(self, data):
        if self.href:
            self.bits.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self.href:
            text = re.sub(r"\s+", " ", html.unescape(" ".join(self.bits))).strip()
            if text:
                self.links.append({"title": text, "url": self.href})
            self.href = None
            self.bits = []


def fetch_text(url: str, timeout: int = 15) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml, text/html, application/json;q=0.9, */*;q=0.8"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def fetch_json(url: str, timeout: int = 15) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def parse_rss(body: str) -> list[dict[str, str]]:
    items = []
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return []
    for node in root.iter():
        tag = node.tag.lower().rsplit("}", 1)[-1]
        if tag != "item" and tag != "entry":
            continue
        title = ""
        link = ""
        summary = ""
        published = ""
        for child in list(node):
            name = child.tag.lower().rsplit("}", 1)[-1]
            if name == "title":
                title = (child.text or "").strip()
            elif name in {"link", "guid"}:
                link = (child.get("href") or child.text or link or "").strip()
            elif name in {"description", "summary", "content"}:
                summary = re.sub(r"<[^>]+>", " ", child.text or "")
            elif name in {"pubdate", "published", "updated", "date"}:
                published = (child.text or "").strip()
        if title and link:
            items.append({"title": html.unescape(title), "url": link, "summary": html.unescape(summary).strip(), "publishedAt": published})
    return items


def parse_links(body: str, base: str) -> list[dict[str, str]]:
    parser = LinkParser(base)
    try:
        parser.feed(body)
    except Exception:
        return []
    return parser.links


def try_feeds(urls: list[str], *, live: bool) -> list[dict[str, str]]:
    if not live:
        return []
    collected: list[dict[str, str]] = []
    for url in urls:
        try:
            body = fetch_text(url)
        except (urllib.error.URLError, TimeoutError, ValueError, OSError):
            continue
        items = parse_rss(body)
        if not items and "<html" in body.lower():
            items = [
                {"title": row["title"], "url": row["url"], "summary": "", "publishedAt": ""}
                for row in parse_links(body, url)
                if 16 <= len(row["title"]) <= 180
            ]
        collected.extend(items[:20])
        if collected:
            break
    return collected
