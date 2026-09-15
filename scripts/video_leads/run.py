from __future__ import annotations

import datetime as dt
import json
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from providers.transcripts.creator import CreatorTextProvider
from providers.transcripts.official_captions import OfficialCaptionsProvider
from providers.transcripts.rejected import REJECTED_PROVIDERS
from providers.web_video_search.existing import ExistingUrlProvider
from providers.web_video_search.google_cse import GoogleCseVideoProvider
from providers.web_video_search.reddit_mentions import RedditMentionProvider
from providers.youtube.api import YouTubeDataApiProvider
from providers.youtube.oembed import hydrate
from providers.youtube.rss import YouTubeRssProvider
from video_leads.cluster import cluster_videos
from video_leads.concept import CONCEPTS, claim_ledger, extract_concept
from video_leads.coverage import existing_coverage
from video_leads.research import SLOW_NEWS_PRIORITY, research_packet, worth_watching_item
from video_leads.score import channel_baselines, score_video

TZ = ZoneInfo("America/Toronto")
CONFIG_PATH = ROOT / "data" / "editorial" / "video-leads-config.json"
OUT_PATH = ROOT / "data" / "editorial" / "video-leads.json"


def load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def discover(config: dict, now: dt.datetime | None = None) -> tuple[list[dict], dict]:
    now = now or dt.datetime.now(dt.timezone.utc)
    lookback = int(config.get("lookbackDays") or 80)
    rss = YouTubeRssProvider()
    api = YouTubeDataApiProvider()
    videos = []
    notes = {"rssChannels": 0, "rssVideos": 0, "apiSearches": 0, "apiVideos": 0, "apiAvailable": api.available()}
    for channel in config.get("watchlist") or []:
        found = rss.discover(channel, lookback_days=lookback)
        if found:
            notes["rssChannels"] += 1
            notes["rssVideos"] += len(found)
            videos.extend(found)
    if api.available():
        published_after = (now - dt.timedelta(days=min(lookback, 21))).strftime("%Y-%m-%dT00:00:00Z")
        groups = list((config.get("keywords") or {}).values())
        queries = [item for group in groups for item in group][: int(config.get("searchPerRun") or 8)]
        for query in queries:
            found = api.search(query, max_results=int(config.get("maxResultsPerSearch") or 5), published_after=published_after)
            notes["apiSearches"] += 1
            notes["apiVideos"] += len(found)
            videos.extend(found)
    extras = ExistingUrlProvider().discover()
    reddit = RedditMentionProvider().discover()
    google = GoogleCseVideoProvider()
    google_found = google.discover_keywords(config.get("keywords") or {})
    notes["existingUrls"] = len(extras)
    notes["redditMentions"] = len(reddit)
    notes["googleCseVideos"] = len(google_found)
    notes["googleCseAvailable"] = google.available()
    for extra in extras + reddit + google_found:
        videos.append(hydrate(extra))
    uniq = {}
    for video in videos:
        key = video.get("videoId")
        if not key:
            continue
        existing = uniq.get(key)
        if not existing or _richer(video, existing):
            uniq[key] = video
    return list(uniq.values()), notes


def _richer(candidate: dict, existing: dict) -> bool:
    cand = (1 if candidate.get("title") else 0) + (1 if len(candidate.get("description") or "") > 40 else 0) + (1 if candidate.get("views") else 0)
    have = (1 if existing.get("title") else 0) + (1 if len(existing.get("description") or "") > 40 else 0) + (1 if existing.get("views") else 0)
    return cand > have


def attach_transcripts(videos: list[dict], api: YouTubeDataApiProvider) -> None:
    official = OfficialCaptionsProvider(api)
    creator = CreatorTextProvider()
    for video in videos:
        result = creator.fetch_transcript(video)
        if official.can_handle(video):
            listed = official.fetch_transcript(video)
            if listed.status == "caption_track_listed":
                result.status = listed.status
                result.source = listed.source
                result.notes = listed.notes
                result.confidence = max(result.confidence, 0.5)
        video["transcript"] = {
            "status": result.status,
            "source": result.source,
            "confidence": result.confidence,
            "excerpts": result.excerpts,
            "notes": result.notes,
        }


def rank(videos: list[dict], config: dict, now: dt.datetime | None = None) -> list[dict]:
    now = now or dt.datetime.now(dt.timezone.utc)
    baselines = channel_baselines(videos, now)
    weights = config.get("weights") or {}
    ranked = []
    for video in videos:
        key = video.get("channelId") or video.get("channel") or ""
        scored = score_video(video, baselines.get(key, 1.0), now, weights)
        item = {**video, **scored, "overallScore": scored["overall"]}
        ranked.append(item)
    ranked.sort(key=lambda item: item.get("overallScore") or 0, reverse=True)
    return ranked


def build_leads(ranked: list[dict], limit: int = 20) -> list[dict]:
    clustered = cluster_videos(ranked)
    leads = []
    for video in clustered:
        concept = extract_concept(video)
        if concept.get("leadType") == "reject" or not concept.get("headline"):
            continue
        if not _queueable(video, concept):
            continue
        coverage = existing_coverage(concept)
        claims = claim_ledger(video, (video.get("transcript") or {}).get("excerpts") or [])
        packet = research_packet(video, concept, coverage, claims, video.get("transcript") or {})
        lead = {
            "id": f"video:{video.get('clusterId') or video.get('videoId')}",
            "discoveredAt": dt.datetime.now(TZ).isoformat(),
            "videoUrl": video.get("videoUrl"),
            "videoId": video.get("videoId"),
            "title": video.get("title"),
            "channel": video.get("channel"),
            "publishedAt": video.get("publishedAt"),
            "views": video.get("views"),
            "velocity": video.get("viewsPerHour"),
            "topic": concept.get("topic"),
            "region": video.get("region"),
            "localRelevanceScore": video.get("localRelevance"),
            "localRelevance": concept.get("localRelevance") or "; ".join(video.get("relevanceReasons") or []),
            "relevanceReasons": video.get("relevanceReasons"),
            "noveltyScore": video.get("novelty"),
            "articlePotential": video.get("articlePotential"),
            "overallScore": video.get("overallScore"),
            "scoreParts": {
                "localRelevance": video.get("localRelevance"),
                "velocity": video.get("velocity"),
                "novelty": video.get("novelty"),
                "broadAppeal": video.get("broadAppeal"),
                "articlePotential": video.get("articlePotential"),
                "sourceQuality": video.get("sourceQuality"),
            },
            "transcriptSource": (video.get("transcript") or {}).get("source"),
            "transcriptStatus": (video.get("transcript") or {}).get("status"),
            "suggestedHeadline": concept.get("headline"),
            "suggestedAngle": concept.get("angle"),
            "hook": concept.get("hook"),
            "centralQuestion": concept.get("centralQuestion"),
            "leadType": concept.get("leadType"),
            "verificationStatus": "unverified",
            "editorialStatus": "new",
            "autoPublish": False,
            "clusterId": video.get("clusterId"),
            "clusterSize": video.get("clusterSize"),
            "supportingVideos": video.get("supportingVideos") or [],
            "existingCoverage": coverage,
            "claimLedger": claims,
            "researchPacket": packet,
            "seo": {
                "likelyQuery": concept.get("headline"),
                "evergreenPotential": "high" if concept.get("entity") not in {"generic", "reject"} else "medium",
                "questionSearch": bool("?" in (concept.get("headline") or "")),
            },
        }
        if concept.get("leadType") == "worth_watching":
            lead["worthWatching"] = worth_watching_item(video, concept)
            lead["editorialStatus"] = "review"
        if any(existing.get("suggestedHeadline") == lead["suggestedHeadline"] for existing in leads):
            continue
        leads.append(lead)
        if len(leads) >= limit:
            break
    return leads


def _queueable(video: dict, concept: dict) -> bool:
    region = video.get("region") or ""
    relevance = float(video.get("localRelevance") or 0)
    potential = float(video.get("articlePotential") or 0)
    title = f"{video.get('title') or ''} {concept.get('headline') or ''}".lower()
    if re.search(r"\b(treaties made|trade war|retail analyst|midterms)\b", title) and (video.get("region") or "") not in {"burlington", "halton"}:
        return False
    if concept.get("entity") in CONCEPTS:
        return True
    if region in {"burlington", "halton", "oakville", "hamilton"}:
        return potential >= 2.0
    if region in {"toronto", "gta"}:
        return potential >= 2.6 and (relevance >= 2.6 or bool(video.get("relevanceReasons")))
    return potential >= 3.4 and relevance >= 2.8 and bool(video.get("relevanceReasons"))


def build_payload(config: dict | None = None, limit: int = 20) -> dict:
    config = config or load_config()
    videos, notes = discover(config)
    attach_transcripts(videos, YouTubeDataApiProvider())
    ranked = rank(videos, config)
    leads = build_leads(ranked, limit=limit)
    return {
        "generatedAt": dt.datetime.now(TZ).isoformat(),
        "method": "Official YouTube RSS plus optional Data API. Score local relevance, velocity, novelty, appeal, article potential and source quality. Cluster duplicates. Extract a concept, never an article. Never auto-publish.",
        "autoPublish": False,
        "videosScanned": len(videos),
        "qualifiedLeads": len(leads),
        "duplicatesCollapsed": max(0, len(videos) - len(cluster_videos(ranked))),
        "transcriptSuccessRate": _transcript_rate(videos),
        "discovery": notes,
        "providers": [
            "youtube_rss",
            "youtube_data_api" if notes.get("apiAvailable") else "youtube_data_api (inactive, no key)",
            "existing_public_urls",
            "reddit_mentions",
            "google_cse_video" if notes.get("googleCseAvailable") else "google_cse_video (inactive, no key)",
        ],
        "rejectedTranscriptProviders": REJECTED_PROVIDERS,
        "slowNewsDayPriority": SLOW_NEWS_PRIORITY,
        "items": leads,
        "top20": [
            {
                "videoId": item.get("videoId"),
                "title": item.get("title"),
                "channel": item.get("channel"),
                "publishedAt": item.get("publishedAt"),
                "views": item.get("views"),
                "overallScore": item.get("overallScore"),
                "region": item.get("region"),
                "videoUrl": item.get("videoUrl"),
            }
            for item in ranked[:20]
        ],
        "scannedSample": [
            {
                "videoId": item.get("videoId"),
                "title": item.get("title"),
                "channel": item.get("channel"),
                "publishedAt": item.get("publishedAt"),
                "views": item.get("views"),
                "overallScore": item.get("overallScore"),
                "region": item.get("region"),
            }
            for item in ranked[:40]
        ],
    }


def _transcript_rate(videos: list[dict]) -> float:
    if not videos:
        return 0.0
    ok = sum(1 for item in videos if (item.get("transcript") or {}).get("status") not in {"", "TRANSCRIPT UNAVAILABLE"})
    return round(ok / len(videos), 3)


def write_payload(payload: dict, path: Path = OUT_PATH) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    limit = 20
    if "--limit" in args:
        limit = int(args[args.index("--limit") + 1])
    payload = build_payload(limit=limit)
    write_payload(payload)
    print(f"Scanned {payload['videosScanned']} videos. Queued {payload['qualifiedLeads']} leads. autoPublish=false")
    print("TOP 20")
    for index, item in enumerate(payload["items"][:20], start=1):
        print(f"{index:2}. {item.get('overallScore'):>5}  {item.get('suggestedHeadline') or item.get('title')}  [{item.get('channel')}]")
    print("TOP 10 CONCEPTS")
    for index, item in enumerate(payload["items"][:10], start=1):
        print(f"{index:2}. {item.get('suggestedHeadline')}")
        print(f"    {item.get('hook')}")
        print(f"    type={item.get('leadType')} status={item.get('editorialStatus')} coverage={item.get('existingCoverage', {}).get('recommendation')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
