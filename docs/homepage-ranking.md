# Homepage ranking

Burlington News keeps separate scores. It does not use one number for every slot.

| Slot | What it means | Clock |
|---|---|---|
| Breaking Now | What is happening right now | minutes |
| Newest | Genuinely new reporting | last 6 hours |
| Hero | Editorial lead | impact + originality + relevance + freshness |
| Top picks | Editorial curation until real readership exists | days |
| Popular now | Recent reading velocity | last 6–24 hours, age out after 72 hours |

## Newest

Eligibility uses `lastMeaningfulUpdate` when a substantive update exists, otherwise `published` / `datePublished`.

Default window: **6 hours**. A 12-hour story is not used to fill an empty slot. If nothing qualifies, the Newest rail is hidden.

Light category diversity may break a same-category tie only when the alternative is within 90 minutes. Freshness outranks diversity.

Meaningful updates include a new official fact, a road reopening, a vote, or a GO disruption resolving. They do not include typos, image swaps, meta edits or automated timestamp refreshes.

## Popular now / Most read

The site currently has **no first-party readership pipeline**. Article pages store anonymous on-device events and open counts. That is not enough to label a public module Most Read.

Until a first-party aggregate endpoint exists:

- keep the label **Top picks**
- keep editorial ranking as the primary sort
- blend in on-device counts only as a weak cold-start signal

Do not invent popularity.

Cold start:

- under 8 reads: 80% editorial / 20% behaviour
- under 40 reads: 70% editorial / 30% behaviour
- 40+ reads: behaviour can dominate, and a Most Read / Popular now label becomes honest

## Breaking Now

The module stays in the homepage. It is not a permanent empty card.

- 0 qualified items or a failed feed: render nothing
- 1 item: one compact row
- 2+ items: show the top two only

Desktop (1200px and up) uses a short kicker plus two equal columns. Narrower desktop/tablet stacks the rows. Mobile keeps the compact card with a live dot, kicker, dividers and chevrons.

## Refresh

| Layer | Current cadence | Note |
|---|---|---|
| Breaking Now GitHub Action | every 15 minutes | GitHub cron can lag; not true realtime |
| Local radar Action | every 30 minutes | ranking input, not a live clock |
| GO status Action | every 30 minutes in service hours | good enough for scheduled trains |
| Client homepage JSON | `cache: 'no-store'`, refetch every 5 minutes while the tab is visible | pauses when hidden |

Recommended production path for time-sensitive state: keep GitHub Actions for batch ranking, and use an existing server/cron only if a feed must be fresher than Actions can guarantee. Do not add a new expensive system for this pass.

## Cache

Live JSON (`home-surface.json`, `breaking-now.json`, `traffic-surface.json`, `go-status.json`) is fetched with `no-store`. Static article assets stay cacheable. Do not disable caching sitewide.
