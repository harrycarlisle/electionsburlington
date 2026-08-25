#!/usr/bin/env python3
"""Load the machine-readable Burlington News editorial policy.

Scripts should read weights, gates and auto-publish rules from
`data/editorial-policy.json` instead of hardcoding a second copy.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "data" / "editorial-policy.json"

DEFAULT_WEIGHTS = {
    "interest": 0.20,
    "relevance": 0.19,
    "novelty": 0.13,
    "familiarity": 0.10,
    "consequence": 0.12,
    "sourceConfidence": 0.08,
    "originality": 0.06,
    "visualStrength": 0.07,
    "breadth": 0.05,
}

DEFAULT_RADAR_WEIGHTS = {
    "interest": 0.17,
    "relevance": 0.17,
    "novelty": 0.10,
    "familiarity": 0.08,
    "consequence": 0.13,
    "freshness": 0.14,
    "sourceConfidence": 0.08,
    "originality": 0.06,
    "visualStrength": 0.04,
    "rotation": 0.03,
}


@lru_cache(maxsize=1)
def load_policy() -> dict:
    try:
        return json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def signal_weights(kind: str = "homepage") -> dict[str, float]:
    policy = load_policy()
    if kind == "radar":
        return dict(policy.get("radarWeights") or DEFAULT_RADAR_WEIGHTS)
    if kind == "queue":
        return dict(policy.get("queueWeights") or policy.get("signals") or DEFAULT_WEIGHTS)
    return dict(policy.get("homepageWeights") or policy.get("signals") or DEFAULT_WEIGHTS)


def auto_publish_rules() -> dict:
    return dict(load_policy().get("autoPublish") or {})


def blocked_terms() -> tuple[str, ...]:
    rules = auto_publish_rules()
    terms = list(rules.get("blockedTerms") or [])
    terms.extend(rules.get("blockedTopics") or [])
    extras = (
        "alleged", "accused", "charged", "endorse", "vote for", "fraud",
        "corrupt", "sexual", "murder", "unverified allegation",
    )
    return tuple(sorted({term.lower() for term in (*terms, *extras) if term}))


def allowed_tiers() -> set[str]:
    rules = auto_publish_rules()
    return {str(item).lower() for item in rules.get("allowedVerificationTiers") or ("primary", "official", "reported", "corroborated")}


def is_low_risk(item: dict) -> bool:
    rules = auto_publish_rules()
    tier = str(item.get("verificationTier") or item.get("verification") or "").lower()
    text = " ".join(str(item.get(key) or "") for key in ("headline", "summary", "storyGoal", "why", "tag")).lower()
    if tier not in allowed_tiers():
        return False
    if any(term in text for term in blocked_terms()):
        return False
    if rules.get("requireSourceUrl", True) and not item.get("url"):
        return False
    if rules.get("requireStoryGoal", True) and not (item.get("storyGoal") or item.get("why") or item.get("summary")):
        return False
    if rules.get("requireImageRights", False) and not item.get("imageRights"):
        return False
    return True
