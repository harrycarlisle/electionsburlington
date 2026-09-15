from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GENERIC = {
    "ontario", "canada", "toronto", "change", "name", "park", "source",
    "water", "sand", "transit", "train", "hotel", "tower", "line",
    "generic", "reject", "news",
}
REGIONS = {"burlington", "halton", "hamilton", "oakville", "toronto", "ontario", "canada", "gta"}


def load_catalog() -> list[dict]:
    path = ROOT / "data" / "story-catalog.json"
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("items") or []
    except Exception:
        return []


def load_backlog() -> str:
    path = ROOT / "editorial" / "hidden-burlington-backlog.md"
    try:
        return path.read_text(encoding="utf-8").lower()
    except Exception:
        return ""


def existing_coverage(concept: dict, catalog: list[dict] | None = None, backlog: str | None = None) -> dict:
    catalog = catalog if catalog is not None else load_catalog()
    backlog = backlog if backlog is not None else load_backlog()
    headline = (concept.get("headline") or "").lower()
    entity = (concept.get("entity") or "").lower()
    matches = []
    for item in catalog:
        hay = f"{item.get('id')} {item.get('headline')} {item.get('deck')} {' '.join(item.get('subjects') or [])}".lower()
        if _entity_overlap(entity, hay) or _overlap(headline, item.get("headline") or ""):
            matches.append({"id": item.get("id"), "headline": item.get("headline"), "url": item.get("url"), "action": "update existing article"})
    backlog_hit = ""
    needles = _entity_needles(entity)
    if entity in {"lasalle-park", "qew-skyway", "burlington-go-stations"}:
        needles.extend(["lasalle", "qew", "go district"])
    for needle in needles:
        if needle and needle in (backlog or ""):
            backlog_hit = needle
            break
    return {
        "existingArticles": matches[:3],
        "backlogHit": backlog_hit,
        "recommendation": "update existing article" if matches else ("research backlog item" if backlog_hit else "new concept"),
    }


def _entity_needles(entity: str) -> list[str]:
    return [
        part for part in entity.replace("-", " ").split()
        if part and part not in GENERIC and part not in REGIONS and len(part) > 3
    ]


def _entity_overlap(entity: str, hay: str) -> bool:
    needles = _entity_needles(entity)
    if not needles:
        return False
    hits = [needle for needle in needles if needle in hay]
    if len(needles) >= 2:
        return len(hits) >= 2
    return bool(hits) and len(needles[0]) >= 6


def _overlap(a: str, b: str) -> bool:
    tokens_a = {token for token in re.findall(r"[a-z0-9]{4,}", a.lower())}
    tokens_b = {token for token in re.findall(r"[a-z0-9]{4,}", b.lower())}
    if not tokens_a or not tokens_b:
        return False
    return len(tokens_a & tokens_b) >= 3
