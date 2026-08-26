# Public URL routing

Canonical public URLs are trailing-slash directories on `https://burlingtonnews.ca/`.

See **[url-migration.md](url-migration.md)** for the full old→new map, GitHub Pages redirect limits, and Search Console checklist.

Machine-readable map: [`/redirects.json`](../redirects.json).

Do **not** run `scripts/sync_public_urls.py` to copy `.html` files onto story indexes. That script is retired. Directory `index.html` files are the source of truth; leftover `.html` files are long-lived redirect stubs.
