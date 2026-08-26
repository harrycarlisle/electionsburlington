# Search Console and analytics after this pass

Manual steps. Nothing here was submitted from this environment.

1. Add `https://burlingtonnews.ca/sitemap.xml` and `https://burlingtonnews.ca/news-sitemap.xml` in Search Console.
2. Inspect `/`, `/elections/compare/`, `/elections/ward/`, `/go/burlington-to-union/`, `/development/`, `/taxes/`, `/parking/`, `/beach/`, `/explore/weekend/`, `/events/ribfest-2026/`, `/stories/how-bad-is-burlington-crime/`.
3. Confirm Google Preferred Sources eligibility by searching `burlingtonnews.ca` in https://www.google.com/preferences/source. The footer deeplink is live either way.
4. News sitemap includes only recent news URLs, not evergreen utilities.
5. Compare analytics on clean hub paths versus leftover `.html` URLs. Do not treat a redirect as a second pageview if the host already consolidates them.
6. Watch Event rich-result errors: structured data matches visible date, venue and price.
7. Do not add FAQ schema or `llms.txt`.
