#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from video_leads.cluster import cluster_videos, entity_key
from video_leads.concept import extract_concept
from video_leads.score import score_video, views_per_hour
from video_leads.research import SLOW_NEWS_PRIORITY

failed = 0

def assert_true(cond, message):
    global failed
    if not cond:
        failed += 1
        print("FAIL", message)

hotel = {
    "title": "I stayed in the hotel inside the Blue Jays stadium",
    "description": "A night at the Rogers Centre Marriott looking onto the field.",
    "channel": "Travel Vlog",
    "publishedAt": "2026-08-26T12:00:00-04:00",
    "views": 200000,
    "likes": 8000,
}
concept = extract_concept(hotel)
assert_true("hotel inside its baseball stadium" in concept["headline"].lower(), concept["headline"])
assert_true("youtuber stays" not in concept["headline"].lower(), "must not be a youtuber-visit headline")
assert_true(concept["leadType"] in {"idea_lead", "worth_watching"}, concept["leadType"])

bad = extract_concept({"title": "Popular YouTuber Visits Toronto", "description": "A fun vlog around downtown."})
assert_true(bad["leadType"] in {"reject", "worth_watching"} or not bad["headline"], f"weak visit concept leaked: {bad}")

path = extract_concept({"title": "Walking the entire PATH", "description": "How far can you walk underneath Toronto?"})
assert_true("underneath Toronto" in path["headline"] or "PATH" in path["headline"], path["headline"])

now = __import__("datetime").datetime.fromisoformat("2026-08-26T15:00:00-04:00")
fast = {"views": 400000, "publishedAt": "2026-08-26T07:00:00-04:00", "likes": 12000, "title": "Why the QEW fails", "description": "Skyway backup"}
slow = {"views": 3000000, "publishedAt": "2026-02-01T12:00:00-04:00", "likes": 40000, "title": "Old Toronto recap", "description": "highlights recap"}
assert_true(views_per_hour(fast, now) > views_per_hour(slow, now), "velocity should beat lifetime views")
fast_score = score_video(fast, baseline=20, now=now)
slow_score = score_video(slow, baseline=20, now=now)
assert_true(fast_score["overall"] > slow_score["overall"], f"{fast_score['overall']} vs {slow_score['overall']}")

assert_true(entity_key("Hotel inside Rogers Centre", "") == entity_key("Blue Jays hotel room tour", "marriott stadium"), "cluster hotel")
grouped = cluster_videos([
    {**hotel, "overallScore": 4, "videoId": "a", "videoUrl": "https://www.youtube.com/watch?v=a"},
    {"title": "Rogers Centre hotel room tour", "description": "marriott stadium", "overallScore": 3, "videoId": "b", "videoUrl": "https://www.youtube.com/watch?v=b"},
])
assert_true(len(grouped) == 1, f"expected one hotel cluster, got {len(grouped)}")
assert_true(grouped[0]["clusterSize"] == 2, grouped[0]["clusterSize"])

assert_true(SLOW_NEWS_PRIORITY[-1] == "Worth Watching", SLOW_NEWS_PRIORITY)
assert_true("Video-discovered independently reported explainer" in SLOW_NEWS_PRIORITY, "slow-news rung missing")

meta = extract_concept({
    "title": "Meta to pay up to $16.7B in social media addiction, safety settlement",
    "description": "Meta has agreed to pay up to $16.68 billion US as part of a settlement. Years ago the company denied the claims.",
    "channel": "CBC News",
})
assert_true(meta.get("entity") not in {"cne-go", "go-transit"}, f"national news stole a local template: {meta}")
assert_true("cne" not in (meta.get("headline") or "").lower(), meta.get("headline"))

sand = extract_concept({
    "title": "Trains have a sand tank?",
    "description": "GO trains carry sand for traction on steel rails.",
    "channel": "Metrolinx",
})
assert_true("sand" in (sand.get("headline") or "").lower(), sand.get("headline"))
assert_true("late" not in (sand.get("headline") or "").lower(), "sand tank must not become a delay explainer")

meta_score = score_video({
    "title": "Meta to pay up to $16.7B in social media addiction, safety settlement",
    "description": "Years ago the company denied the claims in court papers.",
    "channel": "CBC News",
}, baseline=20, now=now)
assert_true("affects Burlington transportation" not in meta_score.get("relevanceReasons", []), meta_score)

from video_leads.coverage import existing_coverage
lake_coverage = existing_coverage({"headline": "Can a U.S. president rename Lake Ontario?", "entity": "lake-ontario-name"}, catalog=[], backlog="lasalle park is in the hidden burlington backlog")
assert_true(lake_coverage.get("backlogHit") == "", lake_coverage)
sand_coverage = existing_coverage(
    {"headline": "Why do GO trains dump sand on the rails?", "entity": "go-sand"},
    catalog=[{"id": "burlington-crime-analysis-2026", "headline": "How bad is crime in Burlington, really?", "url": "articles/crime.html"}],
    backlog="",
)
assert_true(sand_coverage.get("recommendation") == "new concept", sand_coverage)
water_coverage = existing_coverage(
    {"headline": "What is Halton actually trying to change about the water you drink?", "entity": "halton-source-water"},
    catalog=[{"id": "burlington-crime-analysis-2026", "headline": "How bad is crime in Burlington, really?", "subjects": ["halton", "crime"]}],
    backlog="halton police and lasalle park notes",
)
assert_true(water_coverage.get("recommendation") == "new concept", water_coverage)

from video_leads.run import build_leads
leads = build_leads([
    {**fast, **fast_score, "overallScore": fast_score["overall"], "videoId": "qew1", "videoUrl": "https://www.youtube.com/watch?v=qew1", "channel": "RMTransit", "transcript": {"status": "description_only", "source": "creator_text", "excerpts": []}},
], limit=5)
assert_true(leads and leads[0]["autoPublish"] is False, "queue must never auto-publish")
assert_true(leads[0]["editorialStatus"] in {"new", "review"}, leads[0]["editorialStatus"])
assert_true("qew" in (leads[0]["suggestedHeadline"] or "").lower() or "skyway" in (leads[0]["suggestedHeadline"] or "").lower(), leads[0]["suggestedHeadline"])

if failed:
    print(f"{failed} video lead checks failed")
    raise SystemExit(1)
print("video lead checks passed")
