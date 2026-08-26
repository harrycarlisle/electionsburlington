# Search Console and analytics after this pass

Manual steps. Nothing here was submitted from this environment.

1. Add or resubmit `https://burlingtonnews.ca/sitemap.xml` and `https://burlingtonnews.ca/news-sitemap.xml` in Search Console.
2. Inspect `/`, `/news/`, `/explore/`, `/events/`, `/elections/`, `/elections/compare/`, `/elections/ward/`, `/traffic/`, `/food-passport/`, `/go/burlington-to-union/`, `/development/`, `/taxes/`, `/parking/`, `/beach/`, `/explore/weekend/`, `/events/ribfest-2026/`, `/stories/how-bad-is-burlington-crime/`.
3. Inspect the corresponding old `.html` URLs (`/explore.html`, `/updates.html`, `/election-guide.html`, `/articles/how-bad-is-burlington-crime.html`, and at least ten other article stubs) and confirm they resolve to the clean canonical.
4. Confirm Google Preferred Sources eligibility by searching `burlingtonnews.ca` in https://www.google.com/preferences/source. The footer deeplink is live either way.
5. News sitemap includes only recent news URLs, not evergreen utilities.
6. Compare analytics on clean hub paths versus leftover `.html` URLs. HTML stubs currently return HTTP 200 on GitHub Pages; treat them as redirects, not extra content pageviews, if an edge 308 is added later.
7. Watch Event rich-result errors: structured data matches visible date, venue and price.
8. Watch canonical selection during the migration window.
9. Do not add FAQ schema or `llms.txt`.
