from __future__ import annotations

import re

from .match import alias_hit, hay_for_entity

ENTITY_ALIASES = {
    "rogers-centre-hotel": ("rogers centre hotel", "marriott stadium", "hotel inside", "hotel in the stadium", "blue jays hotel"),
    "cn-tower-wind": ("cn tower", "cn tower wind", "how much wind"),
    "path-toronto": ("path toronto", "toronto path", "underground walkway", "walk underneath toronto"),
    "qew-skyway": ("qew", "skyway", "burlington skyway", "burlington bay james"),
    "burlington-go-stations": ("burlington go", "appleby go", "aldershot", "three go stations"),
    "lasalle-park": ("lasalle park", "la salle park"),
    "ontario-abandoned": ("forgotten ontario", "ontario ghost town", "abandoned ontario", "never finished ontario"),
    "go-transit": ("go delay", "late go", "go train late", "on-time performance", "lakeshore west delay"),
    "go-sand": ("sand tank", "sand on the rails", "train sand"),
    "ontario-place": ("ontario place", "ontarioplace"),
    "toronto-islands": ("toronto island", "toronto islands"),
    "gardiner": ("gardiner",),
    "pearson": ("pearson", "yto airport"),
    "greenbelt": ("greenbelt",),
    "data-centre": ("data centre", "data center"),
    "highway-403-lrt": ("highway 403", "hazel mccallion", "elevated guideway"),
    "ontario-name-change": ("change your name in ontario", "legal name change"),
    "lrt-underground": ("prepare for a light rail", "watermains", "under your feet"),
    "railway-move": ("relocate railway", "railway tracks are moved", "how we relocate"),
    "cne-go": ("cne", "canadian national exhibition", "exhibition station"),
    "lake-ontario-name": ("lake ontario", "lake america", "rename lake"),
    "ontario-fighter-jet": ("fighter jet", "supersonic", "ontario park"),
    "halton-source-water": ("source protection", "halton-hamilton"),
}

CONCEPTS = {
    "rogers-centre-hotel": {
        "headline": "Toronto has a hotel inside its baseball stadium. How does that actually work?",
        "hook": "Some rooms look directly onto the field, but game nights come with unusual rules.",
        "angle": "Ownership, room types, game-day restrictions, and how Burlington fans actually get there.",
        "topic": "infrastructure",
        "leadType": "idea_lead",
        "localRelevance": "Burlington residents can reach Rogers Centre from Burlington GO via Union.",
        "sources": ["Marriott Rogers Centre", "Rogers Centre / Maple Leaf Sports & Entertainment", "City of Toronto planning records", "Blue Jays guest policies"],
        "visual": "original stadium/hotel diagram",
    },
    "cn-tower-wind": {
        "headline": "How much wind can the CN Tower actually handle?",
        "hook": "The tower is built to move. The interesting number is how far, and who decides when it closes.",
        "angle": "Engineering limits, public-access closures, and what that means for a skyline people treat as permanent.",
        "topic": "engineering",
        "leadType": "idea_lead",
        "localRelevance": "The CN Tower is the landmark most Burlington residents use to orient downtown Toronto.",
        "sources": ["CN Tower / Maple Leaf Sports & Entertainment or current operator", "original engineering reports", "Environment Canada wind records"],
        "visual": "simple wind-sway diagram",
    },
    "path-toronto": {
        "headline": "How far can you walk underneath Toronto without going outside?",
        "hook": "PATH is not one tunnel. It is a privately connected system with edges most maps hide.",
        "angle": "Measured walking distance, ownership seams, winter usefulness from Union.",
        "topic": "urbanism",
        "leadType": "idea_lead",
        "localRelevance": "GO riders from Burlington already enter PATH at Union Station.",
        "sources": ["City of Toronto PATH map", "property owners along the system", "Union Station operator"],
        "visual": "original PATH distance map from Union",
    },
    "qew-skyway": {
        "headline": "Why can one stretch of the QEW ruin Burlington traffic for hours?",
        "hook": "The Skyway is not just a bridge. It is the valve for an entire west-end commute.",
        "angle": "Capacity, incidents, and why Burlington streets absorb the overflow.",
        "topic": "traffic",
        "leadType": "idea_lead",
        "localRelevance": "A Skyway or QEW blockage immediately changes Fairview, Plains and downtown Burlington.",
        "sources": ["Ontario 511", "MTO Skyway records", "Burlington News Skyway feature", "Halton traffic counts"],
        "visual": "corridor overflow map",
        "existing": "skyway-tunnels",
    },
    "burlington-go-stations": {
        "headline": "Why does Burlington have three GO stations, and which one should you actually use?",
        "hook": "Aldershot, Burlington and Appleby are not interchangeable, especially once parking fills.",
        "angle": "Walk sheds, parking rules, and the Union vs. local-service split.",
        "topic": "transit",
        "leadType": "idea_lead",
        "localRelevance": "This is a daily Burlington choice, not a Toronto explainer.",
        "sources": ["GO / Metrolinx station pages", "Burlington Transit connections", "parking occupancy"],
        "visual": "three-station comparison",
    },
    "lasalle-park": {
        "headline": "Why does Hamilton own LaSalle Park when the park is in Burlington?",
        "hook": "The marina and lawn feel like Burlington. The owner on paper is not.",
        "angle": "Original agreement, what Burlington residents can still use, and who pays.",
        "topic": "history",
        "leadType": "idea_lead",
        "localRelevance": "LaSalle Park is a Burlington waterfront destination with a Hamilton title.",
        "sources": ["original municipal agreement", "current ownership record", "City of Burlington and Hamilton parks pages"],
        "visual": "ownership map of the park edge",
        "existing": "hidden-burlington-lasalle",
    },
    "ontario-abandoned": {
        "headline": "The Ontario project that was built, abandoned and almost forgotten.",
        "hook": "The interesting story is not the ruin. It is the public decision that left it behind.",
        "angle": "Identify the specific site, the original purpose, and the paper trail that ended it.",
        "topic": "history",
        "leadType": "idea_lead",
        "localRelevance": "Ontario leftover infrastructure often sits on corridors Burlington residents already travel.",
        "sources": ["provincial archives", "municipal heritage files", "contemporary newspaper record"],
        "visual": "then-and-now rights-safe pair",
    },
    "highway-403-lrt": {
        "headline": "How do you build a rail line over a live 400-series highway?",
        "hook": "The interesting problem is not the train. It is keeping Highway 403 moving while the guideway lands above it.",
        "angle": "Construction method, traffic management, and what west-GTA drivers should expect.",
        "topic": "infrastructure",
        "leadType": "idea_lead",
        "localRelevance": "Highway 403 is part of the same west-end system that dumps traffic onto the QEW and Burlington streets.",
        "sources": ["Metrolinx Hazel McCallion Line", "MTO Highway 403 notices", "City of Mississauga construction updates"],
        "visual": "simple over-highway guideway diagram",
    },
    "ontario-name-change": {
        "headline": "How do you legally change your name in Ontario?",
        "hook": "The form is public. The delays, costs and exceptions are what people actually get wrong.",
        "angle": "Service explainer from the statute and the ministry process, not a recap of a TV segment.",
        "topic": "law",
        "leadType": "idea_lead",
        "localRelevance": "Name changes are an Ontario process that Burlington residents file the same way as anyone else in the province.",
        "sources": ["Ontario name-change statute and ministry page", "ServiceOntario"],
        "visual": "process diagram",
    },
    "railway-move": {
        "headline": "How do you pick up a working railway and put it somewhere else?",
        "hook": "The track has to keep carrying trains while the corridor is being rebuilt around it.",
        "angle": "Method, weekend closures, and what that means on Lakeshore West.",
        "topic": "infrastructure",
        "leadType": "idea_lead",
        "localRelevance": "Burlington’s GO corridor is rebuilt the same way: trains first, neighbourhoods second.",
        "sources": ["Metrolinx corridor projects", "CN/CP operating rules", "GO weekend-closure notices"],
        "visual": "track-shift diagram",
    },
    "cne-go": {
        "headline": "If you take GO to the CNE, which station actually drops you closest?",
        "hook": "Exhibition Station is the obvious answer. The useful answer includes walking time, crowds and the last train home.",
        "angle": "Station choice from Burlington, crowd crush, and last-train risk.",
        "topic": "transit",
        "leadType": "idea_lead",
        "localRelevance": "CNE is one of the few Toronto events Burlington families routinely take GO to.",
        "sources": ["GO / Exhibition Station", "CNE visitor information", "Metrolinx special-event service"],
        "visual": "walk-shed from Exhibition vs Union",
    },
    "lake-ontario-name": {
        "headline": "Can a U.S. president rename Lake Ontario?",
        "hook": "The lake has an official name on both sides of the border. Changing it is not a tweet.",
        "angle": "Geographic naming law in Canada and the U.S., and why the shoreline cities care.",
        "topic": "law",
        "leadType": "idea_lead",
        "localRelevance": "Burlington sits on Lake Ontario. The name is not a Toronto-only joke.",
        "sources": ["Geographical Names Board of Canada", "U.S. Board on Geographic Names", "Ontario / City of Toronto statements"],
        "visual": "simple binational naming diagram",
    },
    "ontario-fighter-jet": {
        "headline": "Why is there a supersonic fighter jet sitting in an Ontario park?",
        "hook": "The aircraft is the hook. The public-record question is who owns it, who moved it, and whether it stays.",
        "angle": "Identify the park, the aircraft, the transfer, and the municipal decision.",
        "topic": "history",
        "leadType": "idea_lead",
        "localRelevance": "Ontario leftover military hardware often ends up in parks people already drive to.",
        "sources": ["municipality / park operator", "DND or museum transfer record", "local reporting"],
        "visual": "rights-safe still of the aircraft, not a YouTube frame",
    },
    "halton-source-water": {
        "headline": "What is Halton actually trying to change about the water you drink?",
        "hook": "Source protection plans are boring until they decide what can be built near a well or creek.",
        "angle": "Read the proposed updates and translate the land-use consequences.",
        "topic": "environment",
        "leadType": "idea_lead",
        "localRelevance": "Burlington drinking water and creeks sit inside the Halton-Hamilton source protection area.",
        "sources": ["Halton-Hamilton Source Protection Plan", "Conservation Halton", "City of Burlington comments"],
        "visual": "source-protection map of Burlington wells and intakes",
    },
    "lrt-underground": {
        "headline": "What has to move under the street before a light-rail line can open?",
        "hook": "Tracks are the visible part. Water, power and fibre usually have to move first.",
        "angle": "Utility relocation, who pays, and how long the invisible work takes.",
        "topic": "infrastructure",
        "leadType": "idea_lead",
        "localRelevance": "Burlington’s GO major-transit-station areas will face the same buried-utility problem if higher-order transit is built.",
        "sources": ["Metrolinx project documents", "municipal utility companies", "City engineering reports"],
        "visual": "underground utility cross-section",
    },
    "go-sand": {
        "headline": "Why do GO trains dump sand on the rails?",
        "hook": "The tank is not for winter roads. It is how a heavy train keeps grip on steel.",
        "angle": "Traction, stopping distance, and what passengers notice when a train sands the rail.",
        "topic": "transit",
        "leadType": "idea_lead",
        "localRelevance": "Lakeshore West trains through Burlington use the same traction equipment as the rest of the GO network.",
        "sources": ["Metrolinx / GO fleet documentation", "rail operating rules on sanding", "existing Burlington News GO tools"],
        "visual": "simple wheel-and-rail sanding diagram",
    },
    "go-transit": {
        "headline": "What actually decides whether your GO train is late before it reaches Burlington?",
        "hook": "A delay announced at Union is often an earlier decision made miles down the corridor.",
        "angle": "Dispatch, shared freight track, and what passengers can usefully know.",
        "topic": "transit",
        "leadType": "idea_lead",
        "localRelevance": "Burlington, Aldershot and Appleby sit on the Lakeshore West clock.",
        "sources": ["Metrolinx / GO status", "CN/CP corridor context", "existing Burlington News GO tools"],
        "visual": "Lakeshore West delay diagram",
    },
}

REJECT_TITLE = re.compile(
    r"\b(popular youtuber|youtuber visits|i stayed|i visited|day in my life|vlog|reaction|challenge|unboxing|highlights recap|global national|front burner|voicemail from|dolly parton|ivf treatment)\b",
    re.I,
)


def classify_lead(video: dict, concept: dict) -> str:
    text = f"{video.get('title') or ''} {video.get('description') or ''}".lower()
    if concept.get("leadType") == "worth_watching":
        return "worth_watching"
    if REJECT_TITLE.search(video.get("title") or "") or re.search(r"\b(vlog|reaction|challenge)\b", text):
        if float(video.get("articlePotential") or 0) < 2.5:
            return "worth_watching"
        return "reject"
    if float(video.get("articlePotential") or 0) < 2.0:
        return "worth_watching"
    if "found" in text and any(term in text for term in ("exclusive", "investigation", "we obtained")):
        return "creator_investigation"
    return concept.get("leadType") or "idea_lead"


def extract_concept(video: dict) -> dict:
    hay = hay_for_entity(video)
    entity = ""
    for key, aliases in ENTITY_ALIASES.items():
        if any(alias_hit(hay, alias) for alias in aliases):
            entity = key
            break
    if entity and entity in CONCEPTS:
        concept = dict(CONCEPTS[entity])
        concept["entity"] = entity
    else:
        concept = _generic_concept(video)
        concept["entity"] = entity or "generic"
    if REJECT_TITLE.search(video.get("title") or "") and concept["entity"] == "generic":
        concept = {
            "headline": "",
            "hook": "",
            "angle": "Reject as a derivative YouTuber-visit story unless an independent question exists.",
            "topic": "reject",
            "leadType": "reject",
            "localRelevance": "",
            "sources": [],
            "visual": "",
            "entity": "reject",
        }
    concept["leadType"] = classify_lead({**video, **concept}, concept)
    concept["centralQuestion"] = _question(concept.get("headline") or video.get("title") or "")
    return concept


def _generic_concept(video: dict) -> dict:
    title = re.sub(r"\s+", " ", video.get("title") or "").strip()
    if not title:
        return {"headline": "", "hook": "", "angle": "", "topic": "unknown", "leadType": "reject", "localRelevance": "", "sources": [], "visual": ""}
    headline = title
    if REJECT_TITLE.search(title):
        headline = ""
    elif title.endswith("?"):
        headline = title[:110]
    elif re.match(r"^(how|why|what)\b", title, re.I):
        headline = title.rstrip(".") + "?"
        headline = headline[:110]
    else:
        headline = ""
    return {
        "headline": headline,
        "hook": _hook_from_description(video),
        "angle": "Find the public-record question underneath the video. Do not retell the creator's itinerary.",
        "topic": (video.get("watchlistTopics") or ["general"])[0],
        "leadType": "idea_lead",
        "localRelevance": "",
        "sources": ["official operator or government page", "primary planning or archival record", "one established newsroom account"],
        "visual": "original map, chart, or Burlington News illustration — not a paused YouTube frame",
    }


def _hook_from_description(video: dict) -> str:
    text = re.sub(r"\s+", " ", video.get("description") or "").strip()
    if not text:
        return "The video is a lead, not a source. The article still needs an independent fact."
    sentence = re.split(r"(?<=[.!?])\s+", text)[0]
    words = sentence.split()
    if 8 <= len(words) <= 22:
        return sentence
    return " ".join(words[:16]).rstrip(",;:") + "."


def _question(headline: str) -> str:
    if "?" in headline:
        return headline
    return f"What is the independent public-record story inside “{headline}”?"


def claim_ledger(video: dict, excerpts: list[str]) -> list[dict]:
    claims = []
    for excerpt in excerpts[:5]:
        claims.append({
            "claim": excerpt,
            "videoTimestamp": "",
            "creator": video.get("channel") or "",
            "verificationStatus": "creator_claim",
            "verificationSource": "",
            "confidence": "low",
        })
    if not claims:
        claims.append({
            "claim": video.get("title") or "",
            "videoTimestamp": "",
            "creator": video.get("channel") or "",
            "verificationStatus": "creator_claim",
            "verificationSource": "",
            "confidence": "low",
        })
    return claims
