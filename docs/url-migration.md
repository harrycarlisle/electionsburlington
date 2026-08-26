# Clean URL + technical SEO migration

**Date:** 2026-08-26  
**Host:** GitHub Pages, custom domain `burlingtonnews.ca` (`CNAME`)  
**Canonical host:** `https://burlingtonnews.ca/`  
**Trailing-slash policy:** trailing slash everywhere (`/explore/`, not `/explore`)

This is a routing and technical-SEO pass. Editorial copy, homepage design, traffic/Explore/elections/sports UI, and article styling were not redesigned.

## Architecture decision: articles stay under `/stories/`

Articles already used `/stories/<slug>/` as the public canonical. This pass **does not** move them to `/news/<slug>/`.

`/news/` is the archive hub. Moving established story URLs a second time would add a hop and split equity for little reader value. The primary goal is removing `.html`, not inventing a new information architecture.

Example:

| Old | Canonical |
|---|---|
| `/articles/how-bad-is-burlington-crime.html` | `/stories/how-bad-is-burlington-crime/` |

There is no historic `/how-bad-is-crime-in-burlington.html` in this repo, so no invented alias was added.

Thin election ward landing pages (`/elections/ward-1/` …) and thin development project URLs were **not** created. Substantial project coverage already lives in stories and `/development/`. `/elections/mayor/` is an optional alias to `/elections/compare/`, not a new page.

`/independent/` stays its own page. It is not merged into `/about/`.

## Redirect implementation (GitHub Pages)

GitHub Pages does not support `vercel.json` / `_redirects` HTTP 301s. This repo uses the existing stub pattern:

- `rel=canonical` to the final URL
- `meta http-equiv=refresh`
- `location.replace('/final/')`
- `robots: noindex,follow`

Stubs hop **once** to the final canonical. They do not point at other stubs.

Keep these stubs indefinitely (at least one year) for inbound links, newsletters, and indexed `.html` URLs.

If Cloudflare (or another edge) is added later, apply **308** redirects from `redirects.json` and keep the HTML stubs as a fallback.

`www` / `http` host normalization is DNS + GitHub Pages settings, not HTML. Preferred host is already `burlingtonnews.ca` (no `www` in `CNAME`). Confirm in the GitHub Pages domain panel that HTTPS and the apex host are enforced.

## Trailing slash and duplicates

Canonicals use trailing slashes. GitHub Pages typically serves `page/index.html` at `/page/` and redirects `/page` → `/page/` for directories. `/page.html` is a stub. `/page/index.html` is the file GitHub Pages serves for `/page/` and is not a separate public URL.

Query strings (Explore filters, UTM, traffic destination) are functional. They are not given unique canonicals. News topic chips are client-side filters on `/news/`. Site search is client-side on existing pages; there is no indexable `/search/` route and no fake `SearchAction`.

## Complete hub / utility map

| Current / old URL | File (old) | Type | New URL | Redirect | Indexable |
|---|---|---|---|---|---|
| `/` | `index.html` | Home | `/` | n/a | yes |
| `/explore.html` | `explore.html` | Hub | `/explore/` | stub | no (stub) |
| `/sports.html` | `sports.html` | Hub | `/sports/` | stub | no |
| `/updates.html` | `updates.html` | News archive | `/news/` | stub | no |
| `/election-guide.html` | `election-guide.html` | Elections hub | `/elections/` | stub | no |
| `/skyway-traffic.html` | `skyway-traffic.html` | Traffic | `/traffic/` | stub | no |
| `/puzzles.html` | `puzzles.html` | Games | `/games/` | stub | no |
| `/puzzles/` | `puzzles/index.html` | Alias | `/games/` | stub | no |
| `/about.html` | `about.html` | About (older root) | `/about/` | stub | no |
| `/methodology.html` | `methodology.html` | Sources | `/sources/` | stub | no |
| `/help.html` | `help.html` | Accessibility | `/accessibility/` | stub | no |
| `/privacy.html` | `privacy.html` | Legal | `/privacy/` | stub | no |
| `/terms.html` | `terms.html` | Legal | `/terms/` | stub | no |
| `/independent.html` | `independent.html` | Independence | `/independent/` | stub | no |
| `/ballot.html` | `ballot.html` | Election tool | `/elections/ballot/` | stub | no |
| `/head-to-head.html` | `head-to-head.html` | Pairwise compare | `/elections/head-to-head/` | stub | no |
| `/elections-for-beginners.html` | `elections-for-beginners.html` | Explainer | `/elections/beginners/` | stub | no |
| `/promises.html` | `promises.html` | Promise tracker | `/elections/promises/` | stub | no |
| `/ward.html` | `ward.html` | Ward finder | `/elections/ward/` | stub | no |
| `/food-passport.html` | `food-passport.html` | Food | `/food-passport/` | stub | no |
| `/guides/burlington-food-spots.html` | same | Food alias | `/food-passport/` | stub | no |
| `/guides/best-of-burlington.html` | same | Guide | `/guides/best-of-burlington/` | stub | no |
| `/work-with-us.html` | `work-with-us.html` | Contact | `/work-with-us/` | stub | no |
| `/elections/mayor/` | `elections/mayor/index.html` | Alias | `/elections/compare/` | stub | no |
| `/articles/<slug>.html` | `articles/*.html` | Story alias | `/stories/<slug>/` | stub | no |
| `/404` (missing paths) | `404.html` | Error | n/a | no auto-redirect | **noindex** |

Existing clean hubs unchanged: `/news/`, `/explore/`, `/explore/weekend/`, `/elections/`, `/elections/compare/`, `/elections/ward/`, `/traffic/`, `/go/`, `/go/burlington-to-union/`, `/go/which-station/`, `/development/`, `/taxes/`, `/parking/`, `/beach/`, `/safety/`, `/food/`, `/sports/`, `/games/`, `/about/`, `/editorial-standards/`, `/corrections/`, `/ai-policy/`, `/feedback/`, `/work-with-us/`, `/live/`, `/events/<slug>/`.

New crawlable hub: `/events/` lists leaf event pages only. Explore calendar filters stay on `/explore/` and are not indexed as separate URLs.

## News sitemap

`news-sitemap.xml` includes recent **news** stories only (currently crime analysis and nostalgia cafe). Evergreen utilities, election tools, food passport, and event leaves stay in `sitemap.xml`, not the News sitemap.

Inclusion rule: recent original news reporting with a publication date, not hubs or explainers.

## Search Console — manual after deploy

Nothing in this environment was submitted to Search Console.

1. Submit `https://burlingtonnews.ca/sitemap.xml` and `https://burlingtonnews.ca/news-sitemap.xml`.
2. Inspect `/`, `/news/`, `/explore/`, `/events/`, `/elections/`, `/traffic/`, `/food-passport/`, `/stories/how-bad-is-burlington-crime/`, newest major story, `/events/ribfest-2026/`, `/development/`.
3. Inspect the matching old `.html` URLs and confirm they resolve to the clean URL.
4. Monitor indexing, 404s, redirect errors, and Google-selected canonicals.
5. Compare analytics on old vs new paths. Do not treat a stub refresh as a second content pageview if the host later adds real 301/308s.
6. Confirm apex HTTPS and non-www in the GitHub Pages domain settings.

## Analytics

After deploy, segment by page path. Old `.html` traffic should fall as Google recrawls. If GitHub Pages continues to serve stubs as HTTP 200, Search Console may still show the old URL until an edge 308 is added. That is a platform limit, not a second editorial URL.

## 404 behaviour

Missing paths use `404.html`. GitHub Pages returns HTTP 404 for unknown routes. The page is `noindex` and does **not** canonicalize to the homepage. It offers News, Explore, Elections, Sports, Puzzles, Home. It does not auto-redirect.

## Preferred Sources

Footer / About already include:

`https://www.google.com/preferences/source?q=burlingtonnews.ca`

The homepage footer now includes the same low-key link.

## What this pass did not do

- No FAQ schema, `llms.txt`, or keyword-variant landing pages.
- No `/news/<slug>/` migration.
- No thin `/elections/ward-1/` pages.
- No thin `/development/<address>/` pages.
- No computer-vision traffic model.
- No invented authors, dates, or social profiles.
- No RSS file exists to update.
- `site.webmanifest` `start_url` was already `/`.
