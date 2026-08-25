#!/usr/bin/env python3
"""Build the weekly Burlington election-source review archive."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import urllib.request

SOURCES = {
    "Meed Ward campaign": "https://votemarianne.ca/",
    "Lisa Kearns campaign": "https://lisakearns.ca/",
    "Rory Nisan campaign": "https://rorynisan.ca/",
    "Official candidate list": "https://myvote.burlington.ca/for-voters/list-of-candidates/",
    "Official voting information": "https://myvote.burlington.ca/for-voters/how-to-vote/",
    "City budget portal": "https://www.burlington.ca/en/council-and-city-administration/budget.aspx",
    "Burlington council records": "https://burlingtonpublishing.escribemeetings.com/",
    "3110 South Service Road": "https://www.burlington.ca/en/news/current-development-projects/3110_South_Service_Rd.aspx",
    "BurlingtonToday election coverage": "https://www.burlingtontoday.com/2026-municipal-election-news/",
    "Burlington subreddit": "https://www.reddit.com/r/BurlingtonON/new.json?limit=100",
}

UA = {"User-Agent": "BurlingtonNews/2.0 (+https://burlingtonnews.ca/)"}


def main() -> int:
    Path("monitoring/archive").mkdir(parents=True, exist_ok=True)
    state_path = Path("monitoring/source-state.json")
    old = json.loads(state_path.read_text()) if state_path.exists() else {}
    new: dict[str, dict] = {}
    rows = []
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")

    for name, url in SOURCES.items():
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=25) as response:
                body = response.read()
            digest = hashlib.sha256(body).hexdigest()
            previous = old.get(name, {}).get("sha256")
            changed = previous not in (None, digest)
            is_new = previous is None
            new[name] = {
                "url": url,
                "sha256": digest,
                "checked_at": now.isoformat(),
                "bytes": len(body),
            }
            rows.append((name, url, changed, is_new, len(body), None))
        except Exception as exc:
            rows.append((name, url, None, False, None, str(exc)))
            if name in old:
                new[name] = old[name]

    state_path.write_text(json.dumps(new, indent=2, sort_keys=True))

    report = [
        f"# Burlington Election Watch — {today}",
        "",
        "This weekly automated pass detects changes in public source pages and creates a review queue. It does **not** automatically publish political claims, candidate ratings, sentiment scores, allegations, positives or criticisms to the live site.",
        "",
        "The purpose of this archive is to build a long-term, source-backed record while keeping verified facts, campaign claims, reporting and public opinion separate.",
        "",
        "## Source changes",
    ]
    changed_names = []
    for name, url, changed, is_new, _, error in rows:
        if error:
            status = "Fetch failed — review manually"
        elif is_new:
            status = "New source baseline saved"
        elif changed:
            status = "CHANGED — review"
            changed_names.append(name)
        else:
            status = "No detected change"
        report.append(f"- **{name}:** {status} — {url}")

    report += [
        "",
        "## Human review checklist",
        "- Review every changed source before adding or changing a claim on the public site.",
        "- Check City of Burlington agendas, minutes, recorded votes, budget documents and development records for actions that actually occurred.",
        "- Check candidate websites and direct statements for platform changes, but label these as candidate claims unless independently verifiable.",
        "- Check reputable local reporting for context, disputes, criticism, praise, delays, reversals and completed commitments.",
        "- Review public discussion only for recurring themes worth investigating. Treat Reddit and other social posts as anecdotal, never polling or proof.",
        "- Record both favourable and critical evidence when it meets the same sourcing threshold.",
        "- Distinguish proposed, approved, funded, started and completed projects. Do not describe a proposal as an accomplishment.",
        "- Preserve dates and source links so claims can be reconstructed during future elections.",
        "- Never infer intent, corruption, conflicts of interest or misconduct from association alone.",
        "- Never auto-change candidate positions, factual claims or sentiment labels without human review.",
        "",
        "## Suggested record fields for reviewed items",
        "- Date / person or institution / topic / what happened / status (proposed, voted, funded, started, completed, reversed) / source type / source URL / supporting or critical context / reviewer note.",
        "",
        "## Changed sources requiring review",
    ]
    report += [f"- {name}" for name in changed_names] if changed_names else ["- None detected this week."]
    report.append("")

    rendered = "\n".join(report)
    Path("monitoring/latest.md").write_text(rendered)
    Path(f"monitoring/archive/{today}.md").write_text(rendered)

    event = {
        "date": today,
        "checked_at": now.isoformat(),
        "changed_sources": changed_names,
        "source_count": len(rows),
        "fetch_failures": [name for name, _, _, _, _, error in rows if error],
    }
    with Path("monitoring/history.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
