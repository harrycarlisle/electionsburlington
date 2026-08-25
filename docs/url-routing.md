# Public URL routing

Burlington News is a static GitHub Pages site. Clean directory URLs are published as `index.html` copies of the existing pages.

## Public paths

| Public URL | Source file | Old URL still works |
|---|---|---|
| `/` | `index.html` | `/index.html` |
| `/news/` | `updates.html` | `/updates.html` |
| `/explore/` | `explore.html` | `/explore.html` |
| `/elections/` | `election-guide.html` | `/election-guide.html` |
| `/traffic/` | `skyway-traffic.html` | `/skyway-traffic.html` |
| `/sports/` | `sports.html` | `/sports.html` |
| `/games/` | `puzzles.html` | `/puzzles.html` |
| `/stories/<slug>/` | `articles/<slug>.html` | `/articles/<slug>.html` |

Canonical tags point at the clean URLs. Internal navigation uses the clean paths.

Regenerate the public copies with:

```bash
python scripts/sync_public_urls.py
```

Fully extensionless URLs such as `/news` without a trailing slash also work on GitHub Pages when a matching `.html` file exists, but the trailing-slash directory form is the documented public URL.
