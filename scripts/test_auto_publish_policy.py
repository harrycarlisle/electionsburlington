#!/usr/bin/env python3
"""Regression checks for unattended Burlington News publishing gates."""
import json
import tempfile
from pathlib import Path

import auto_publish_briefs as publisher
from editorial_policy import is_low_risk


def candidate(**overrides):
    item = {
        "headline": "Burlington opens a new public playground Tuesday",
        "summary": "The City confirmed the opening date and location in an official notice.",
        "storyGoal": "Tell residents when the confirmed public facility opens.",
        "url": "https://www.burlington.ca/example",
        "verificationTier": "primary",
        "editorialScore": 72,
        "radarClass": "Publish Today",
    }
    item.update(overrides)
    return item


def main():
    assert is_low_risk(candidate())
    assert is_low_risk(candidate(headline="Burlington election advance voting opens", verificationTier="primary"))
    assert not is_low_risk(candidate(headline="Burlington election update", verificationTier="reported"))
    assert not is_low_risk(candidate(verificationTier="community"))
    assert not is_low_risk(candidate(headline="Business owner accused of fraud"))
    assert not is_low_risk(candidate(url=""))
    assert not is_low_risk(candidate(editorialScore=42))
    assert not is_low_risk(candidate(radarClass="Probably Ignore"))

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        publisher.ROOT = root
        publisher.QUEUE = root / "editorial-queue.json"
        publisher.LEDGER = root / "auto-published.json"
        publisher.ARTICLES = root / "articles" / "auto"
        first = candidate(date="2026-08-31", source="City of Burlington")
        publisher.QUEUE.write_text(json.dumps({"publishReady": [first]}), encoding="utf-8")
        publisher.main()
        ledger = json.loads(publisher.LEDGER.read_text(encoding="utf-8"))
        assert len(ledger["items"]) == 1
        path = root / ledger["items"][0]["path"].lstrip("/")
        assert path.exists()
        original_path = ledger["items"][0]["path"]

        changed = {**first, "summary": "The City changed the confirmed opening time to 11 a.m."}
        publisher.QUEUE.write_text(json.dumps({"publishReady": [changed]}), encoding="utf-8")
        publisher.main()
        ledger = json.loads(publisher.LEDGER.read_text(encoding="utf-8"))
        assert len(ledger["items"]) == 1
        assert ledger["items"][0]["path"] == original_path
        assert ledger["items"][0]["updateCount"] == 1
        assert "11 a.m." in path.read_text(encoding="utf-8")

        publisher.main()
        ledger = json.loads(publisher.LEDGER.read_text(encoding="utf-8"))
        assert ledger["items"][0]["updateCount"] == 1
    print("automatic publishing policy checks passed")


if __name__ == "__main__":
    main()
