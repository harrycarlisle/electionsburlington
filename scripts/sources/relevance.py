"""Geographic and agency relevance filters for discovery items."""

from __future__ import annotations

import re
from typing import Any

BURLINGTON = (
    "burlington", "aldershot", "brant street", "guelph line", "walkers line",
    "appleby line", "burloak", "plains road", "new street", "upper middle",
    "fairview", "spencer smith", "millcroft", "mount nemo", "lowville",
    "tyandaga", "orchard", "roseland", "tansley", "alton",
)
HALTON = ("halton", "oakville", "milton", "halton hills")
CORRIDOR = (
    "qew", "highway 403", "hwy 403", "403", "407", "lakeshore west",
    "skyway", "go transit", "metrolinx", "burlington go", "appleby go",
)
MAJOR_CANADA = (
    "national emergency", "prime minister", "state of emergency",
    "nationwide", "canada-wide", "federal emergency",
)
IRRELEVANT_CITIES = (
    "scarborough", "north york", "etobicoke", "mississauga", "brampton",
    "vaughan", "markham", "richmond hill", "ajax", "pickering",
)


def hay(item: dict[str, Any]) -> str:
    return " ".join(
        str(item.get(key) or "")
        for key in (
            "headline", "shortHeadline", "summary", "rawText", "location",
            "nearestIntersection", "affectedArea", "city", "region", "title",
        )
    ).lower()


def burlington_relevance(item: dict[str, Any]) -> float:
    """Return 0–5. Burlington first; national/world only when extraordinary."""
    text = hay(item)
    city = str(item.get("city") or "").lower()
    if any(term in text for term in BURLINGTON) or city == "burlington":
        return 5.0
    if any(term in text for term in CORRIDOR):
        return 4.2
    if any(term in text for term in HALTON) or city in {"oakville", "milton", "halton hills"}:
        return 3.6
    if "hamilton" in text or city == "hamilton":
        if any(term in text for term in CORRIDOR) or "burlington" in text:
            return 4.0
        return 1.4
    if "toronto" in text or city == "toronto":
        if any(term in text for term in CORRIDOR) or any(term in text for term in MAJOR_CANADA):
            return 3.2
        return 0.6
    if any(term in text for term in MAJOR_CANADA):
        return 3.0
    if re.search(r"\b(ontario|canada|world|global|international)\b", text):
        impact = float(item.get("impactScore") or 0)
        return 2.4 if impact >= 4.6 else 1.0
    return 0.8


def police_relevance(agency: str, item: dict[str, Any]) -> tuple[bool, str]:
    """Whether a regional police item may enter the Burlington discovery pool."""
    text = hay(item)
    name = agency.lower()
    if "halton" in name:
        if any(term in text for term in BURLINGTON) or "burlington" in text:
            return True, "halton-burlington"
        if any(term in text for term in HALTON + CORRIDOR):
            return True, "halton-corridor"
        return True, "halton-default"
    if "hamilton" in name:
        if any(term in text for term in CORRIDOR) or "burlington" in text:
            return True, "hamilton-corridor"
        if re.search(r"\b(evacuat|major fire|homicide|shooting|explosion|hazmat|spill)\b", text):
            return True, "hamilton-major"
        return False, "hamilton-neighbourhood"
    if "toronto" in name or name == "tps":
        if any(term in text for term in CORRIDOR) or any(term in text for term in MAJOR_CANADA):
            return True, "toronto-corridor"
        if any(term in text for term in IRRELEVANT_CITIES) and not any(term in text for term in CORRIDOR):
            return False, "toronto-routine"
        return False, "toronto-routine"
    if "opp" in name or "ontario provincial" in name:
        if any(term in text for term in CORRIDOR + BURLINGTON + HALTON):
            return True, "opp-corridor"
        if re.search(r"\b(provincial emergency|tornado|amber alert|evacuation)\b", text):
            return True, "opp-provincial"
        return False, "opp-distant"
    if any(token in name for token in ("peel", "niagara", "york")):
        if any(term in text for term in CORRIDOR + BURLINGTON):
            return True, "nearby-corridor"
        return False, "nearby-unrelated"
    return False, "unknown-agency"


def extract_location(text: str) -> dict[str, str]:
    raw = str(text or "")
    roads = (
        "Burloak Drive", "Guelph Line", "Brant Street", "Walkers Line",
        "Appleby Line", "Upper Middle Road", "New Street", "Plains Road",
        "Fairview Street", "Dorval Drive", "QEW", "Highway 403", "Highway 407",
    )
    found = [road for road in roads if road.lower() in raw.lower()]
    intersection = ""
    if len(found) >= 2:
        intersection = f"{found[0]} and {found[1]}"
    elif found:
        intersection = found[0]
    city = "Burlington" if "burlington" in raw.lower() else (
        "Oakville" if "oakville" in raw.lower() else (
            "Hamilton" if "hamilton" in raw.lower() else ""
        )
    )
    return {
        "nearestIntersection": intersection,
        "city": city,
        "location": intersection or city,
    }
