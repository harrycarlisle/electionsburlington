from __future__ import annotations

from providers.verification.packet import ResearchPacketProvider

SLOW_NEWS_PRIORITY = [
    "Breaking Burlington",
    "Major Burlington original",
    "New Burlington reporting",
    "Useful Burlington evergreen",
    "Strong Halton/Hamilton/Oakville story",
    "Major Toronto/Ontario story with Burlington relevance",
    "Video-discovered independently reported explainer",
    "Hidden Burlington/history/development backlog",
    "Worth Watching",
]


def research_packet(video: dict, concept: dict, coverage: dict, claims: list[dict], transcript: dict) -> dict:
    return {
        "workingHeadline": concept.get("headline") or "",
        "curiosityHook": concept.get("hook") or "",
        "whyBurlingtonReadersCare": concept.get("localRelevance") or video.get("relevanceReasons"),
        "videoSources": [{
            "creator": video.get("channel"),
            "title": video.get("title"),
            "url": video.get("videoUrl"),
            "publishedAt": video.get("publishedAt"),
            "views": video.get("views"),
            "velocity": video.get("viewsPerHour"),
        }],
        "supportingVideos": video.get("supportingVideos") or [],
        "creditNote": f"If this becomes a story, credit {video.get('channel') or 'the creator'} and link the original video. The video is a lead, not verification.",
        "keyClaims": ResearchPacketProvider().verify(claims),
        "primarySourcesToFind": concept.get("sources") or [],
        "governmentSources": _gov_sources(concept, video),
        "mapsDataPossibilities": concept.get("visual") or "original map or Burlington News illustration",
        "potentialVisuals": [
            concept.get("visual") or "original Burlington News illustration",
            "Do not screenshot the creator's video for a hero image.",
        ],
        "questionsStillUnanswered": [
            concept.get("centralQuestion") or "",
            "Which official document can independently confirm the central number or ownership claim?",
            "What can Burlington News add that the video does not already show?",
        ],
        "recommendedNextStep": coverage.get("recommendation") or "research packet only",
        "transcriptStatus": transcript.get("status") or "TRANSCRIPT UNAVAILABLE",
        "transcriptSource": transcript.get("source") or "none",
        "doNot": [
            "Do not paraphrase the transcript into an article.",
            "Do not auto-publish.",
            "Do not treat the creator as the primary source unless the article attributes a firsthand discovery.",
        ],
    }


def _gov_sources(concept: dict, video: dict) -> list[str]:
    region = video.get("region") or ""
    sources = []
    if region in {"burlington", "halton"}:
        sources.extend(["City of Burlington", "Halton Region"])
    if region in {"toronto", "gta"} or "toronto" in (concept.get("headline") or "").lower():
        sources.extend(["City of Toronto", "Metrolinx"])
    if "ontario" in (concept.get("headline") or "").lower() or region == "ontario":
        sources.append("Government of Ontario")
    return sources or ["Identify the responsible municipality or provincial agency"]


def worth_watching_item(video: dict, concept: dict) -> dict:
    return {
        "format": "worth_watching",
        "title": video.get("title"),
        "explanation": concept.get("hook") or "The video is stronger than a derivative article.",
        "embed": f"https://www.youtube.com/embed/{video.get('videoId')}" if video.get("videoId") else "",
        "creator": video.get("channel"),
        "url": video.get("videoUrl"),
        "public": False,
        "note": "Optional future homepage item. Official YouTube embed only. Do not auto-add.",
    }
