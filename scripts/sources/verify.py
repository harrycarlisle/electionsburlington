"""Corroborate community leads against official items. Never quote Reddit as fact."""

from __future__ import annotations

import datetime as dt
import re
from typing import Any

from .cause import enrich_cause
from .model import clean_text
from .relevance import hay
from .score import parse_time

STOP = {
    "the", "a", "an", "and", "or", "to", "of", "for", "in", "on", "at", "is",
    "are", "with", "from", "this", "that", "near", "after", "over",
}


def tokens(text: str) -> set[str]:
    return {
        part for part in re.findall(r"[a-z0-9]+", str(text or "").lower())
        if len(part) > 2 and part not in STOP
    }


def similar(a: dict[str, Any], b: dict[str, Any]) -> float:
    ta, tb = tokens(hay(a)), tokens(hay(b))
    if not ta or not tb:
        return 0.0
    overlap = len(ta & tb) / max(1, min(len(ta), len(tb)))
    loc_a = tokens(f"{a.get('location') or ''} {a.get('nearestIntersection') or ''}")
    loc_b = tokens(f"{b.get('location') or ''} {b.get('nearestIntersection') or ''}")
    loc = 0.2 if loc_a and loc_b and loc_a & loc_b else 0.0
    return overlap + loc


def close_in_time(a: dict[str, Any], b: dict[str, Any], hours: float = 6.0) -> bool:
    ta = parse_time(a.get("publishedAt") or a.get("updatedAt") or a.get("discoveredAt"))
    tb = parse_time(b.get("publishedAt") or b.get("updatedAt") or b.get("discoveredAt"))
    if not ta or not tb:
        return True
    return abs((ta - tb).total_seconds()) <= hours * 3600


def corroborate(lead: dict[str, Any], officials: list[dict[str, Any]]) -> dict[str, Any]:
    """Upgrade a community lead only when an official/newsroom item matches."""
    best = None
    best_score = 0.0
    for item in officials:
        if str(item.get("sourceType") or "").lower() in {"community", "social"}:
            continue
        if float(item.get("confidenceScore") or 0) < 3.8 and str(item.get("sourceType") or "") not in {"official", "reporting", "newsroom", "primary"}:
            continue
        score = similar(lead, item)
        if score >= 0.45 and close_in_time(lead, item):
            if score > best_score:
                best, best_score = item, score
    if not best:
        lead = dict(lead)
        lead["verificationStatus"] = lead.get("verificationStatus") or "community_lead"
        lead["confidenceScore"] = min(float(lead.get("confidenceScore") or 2.0), 2.0)
        lead["label"] = lead.get("label") or "UNVERIFIED"
        lead["cause"] = ""
        return lead

    merged = dict(best)
    merged["id"] = lead.get("id") or best.get("id")
    merged["relatedSources"] = list(best.get("relatedSources") or []) + [{
        "sourceName": lead.get("sourceName"),
        "sourceUrl": lead.get("sourceUrl"),
        "sourceType": lead.get("sourceType"),
        "role": "discovery",
    }]
    merged["verificationStatus"] = "corroborated"
    merged["confidenceScore"] = max(float(best.get("confidenceScore") or 4.0), 4.0)
    merged["label"] = ""
    # Official wording wins. Community chatter never supplies the cause.
    merged = enrich_cause(merged)
    if not merged.get("headline"):
        merged["headline"] = best.get("headline")
    return merged


def cluster_updates(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One real-world event becomes one update with supporting sources."""
    clusters: list[dict[str, Any]] = []
    for item in sorted(items, key=lambda row: float(row.get("confidenceScore") or 0), reverse=True):
        placed = False
        for cluster in clusters:
            if similar(cluster, item) >= 0.5 and close_in_time(cluster, item, 8):
                sources = list(cluster.get("relatedSources") or [])
                sources.append({
                    "sourceName": item.get("sourceName"),
                    "sourceUrl": item.get("sourceUrl"),
                    "sourceType": item.get("sourceType"),
                })
                cluster["relatedSources"] = sources
                if float(item.get("confidenceScore") or 0) > float(cluster.get("confidenceScore") or 0):
                    keep_sources = cluster["relatedSources"]
                    cluster.update(item)
                    cluster["relatedSources"] = keep_sources
                placed = True
                break
        if not placed:
            row = dict(item)
            row.setdefault("relatedSources", [])
            clusters.append(row)
    return clusters


def rewrite_verified_headline(item: dict[str, Any]) -> dict[str, Any]:
    """Prefer a clear Burlington News summary over quoting a community post."""
    if str(item.get("verificationStatus") or "") != "corroborated":
        return item
    location = clean_text(item.get("nearestIntersection") or item.get("location") or "")
    source = clean_text(item.get("sourceName") or "Official sources")
    event = str(item.get("eventType") or item.get("category") or "update").lower()
    if location and "police" in event:
        item["headline"] = f"{source} responding near {location}."
        item["shortHeadline"] = f"Police activity near {location}"
    return item
