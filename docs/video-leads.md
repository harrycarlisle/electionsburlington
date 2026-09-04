# Video Leads

Internal discovery system for article *ideas*. It does not publish.

A YouTube video is a lead. It is never the finished Burlington News story.

The finished story must add independent reporting, verification, analysis, local relevance, maps or data, primary documents, or original framing. A transcript paraphrase is not a Burlington News article.

## What it does

1. Discover recent videos from official YouTube channel RSS, optional YouTube Data API search, optional official Google Programmable Search, Reddit mentions already stored in newsroom files, and YouTube URLs already sitting in those files.
2. Score them.
3. Cluster duplicates by topic/entity.
4. Pull creator description / chapters. Official caption *listing* is used when an API key exists. Caption *download* is not used without OAuth.
5. Extract an article concept, a claim ledger, and a research packet.
6. Write `data/editorial/video-leads.json`.

It never writes an article, never updates the homepage, and never sets `autoPublish` true.

`approved` in the queue does **not** generate a draft here. Draft generation is a separate, explicit later task and must rely on the research packet and primary sources, not transcript prose.

## Providers

| Kind | Implemented | Source |
|---|---|---|
| VideoDiscoveryProvider | YouTube RSS | official `feeds/videos.xml` |
| VideoDiscoveryProvider | YouTube Data API | `search.list` + `videos.list` when `YOUTUBE_API_KEY` is set |
| VideoDiscoveryProvider | Existing URL scan | YouTube links already in `data/` or `monitoring/` |
| VideoDiscoveryProvider | Reddit mentions | YouTube URLs already stored in Reddit-derived newsroom files. Signal only. |
| VideoDiscoveryProvider | Google CSE | Official Programmable Search JSON API when `GOOGLE_CSE_KEY` and `GOOGLE_CSE_CX` are set |
| TranscriptProvider | Creator text | title, description, chapters |
| TranscriptProvider | Official captions | `captions.list` only |
| VerificationProvider | Research packet | marks claims `creator_claim` until a human checks primary sources |

Rejected: unofficial timedtext, Invidious, Piped, commercial caption-export sites, Google HTML scraping. See `scripts/providers/transcripts/rejected.py`.

## Transcript policy

Priority 1: official YouTube caption listing via the Data API. Download is OAuth-only and is not implemented.

Priority 2: creator title, description, and chapters.

Priority 3–4: public third-party transcript sites and alternative frontends were evaluated and rejected. Automation is not clearly permitted, and using them would bypass YouTube caption controls.

Priority 5: if nothing usable exists, mark `TRANSCRIPT UNAVAILABLE` and continue from metadata. The pipeline does not break.

Full third-party transcripts are not stored and are not committed.

## Score

`overall = 0.25 local + 0.20 velocity + 0.15 novelty + 0.15 appeal + 0.15 article potential + 0.10 source quality`

This is a ranking aid, not fake precision.

Velocity is views per hour, floored at two hours, compared with the channel median in the same harvest. Lifetime view count cannot win on its own. Likes relative to views add a small engagement term.

Geography uses this order: Burlington, Halton, Hamilton/Oakville, GTA/Toronto, Ontario, Canada. Broader stories need a Burlington relevance reason or unusually strong appeal.

Canada-wide items need a Burlington relevance reason or they are down-ranked.

## Clustering

Videos that share a known entity (Rogers Centre hotel, PATH, QEW/Skyway, CNE/GO, and similar) collapse to one lead with supporting videos. Short tokens such as `cne` must be whole words so a national news short cannot steal a local template.

## Claim ledger

Each meaningful claim is stored as:

- claim
- video timestamp (when available)
- creator
- verification status (`creator_claim` until checked)
- verification source
- confidence

The video is not primary verification. A creator number becomes a Burlington News fact only after a government, company, filing, or other independent record confirms it.

## Queue

Internal JSON only. Not a public page. Statuses: `new`, `review`, `researching`, `approved`, `rejected`, `published`, `duplicate`.

Fields include the video metadata, scores, suggested headline/angle, transcript status, claim ledger, research packet, existing Burlington News coverage, and SEO/AEO notes. The JSON must never contain API keys or full transcripts.

## Slow news day

Use this order. Never publish a weak derivative because Burlington was quiet.

1. Breaking Burlington
2. Major Burlington original
3. New Burlington reporting
4. Useful Burlington evergreen
5. Strong Halton / Hamilton / Oakville story
6. Major Toronto / Ontario story with Burlington relevance
7. Video-discovered independently reported explainer
8. Hidden Burlington / history / development backlog
9. Worth Watching

## Worth Watching

If the video is stronger than a derivative article, keep a small queue object: title, one or two sentences, official YouTube embed, creator credit, link. Do not auto-add it to the homepage. Do not rehost the video. Do not use a paused frame as a hero image.

## Cadence

GitHub Action every 6 hours on `main`, plus `workflow_dispatch`. Watchlist RSS is cheap. API search is capped at 8 queries × 5 results so quota is not burned.

GitHub cron can lag. That is acceptable for idea discovery. This is not a breaking-news clock.

## Secrets

Server-side only. Never put these in client JavaScript or in the JSON queue.

- `YOUTUBE_API_KEY` — optional. Enables search, statistics, and caption listing.
- `GOOGLE_CSE_KEY` / `GOOGLE_CSE_CX` — optional. Official Programmable Search only.

## Monitoring

Each harvest records videos scanned, qualified leads, duplicates clustered, transcript success rate, and whether the API/CSE providers were available. Concept approval rate stays null until editors mark `approved`. Articles published stays 0 because this pipeline cannot publish.
