from pathlib import Path
import re

EXTRA_CSS_VERSION = "20260824a"
BUNDLE_CSS_VERSION = "20260824m"
SHELL_CSS_VERSION = "20260824m"
EXTRA_JS_VERSION = "20260824m"


def version_assets(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text = re.sub(
        r'href="/?site-extra\.css(?:\?v=[^"]+)?"',
        f'href="site-extra.css?v={EXTRA_CSS_VERSION}"',
        text,
    )
    shell = (
        f'<link rel="stylesheet" href="/site-bundle.css?v={BUNDLE_CSS_VERSION}" '
        'data-style="site-bundle">'
        f'<link rel="stylesheet" href="/site-shell.css?v={SHELL_CSS_VERSION}" '
        'data-style="site-shell">'
        f'<script src="/site-extra.js?v={EXTRA_JS_VERSION}" defer></script>'
    )
    text = re.sub(
        r'(?:<link rel="stylesheet" href="/site-bundle\.css\?v=[^"]+" data-style="site-bundle">)?'
        r'(?:<link rel="stylesheet" href="/site-shell\.css\?v=[^"]+" data-style="site-shell">)?'
        r'<script src="/?site-extra\.js(?:\?v=[^"]+)?" defer></script>',
        shell,
        text,
    )
    path.write_text(text, encoding="utf-8")


for filename in ("election-guide.html", "head-to-head.html"):
    version_assets(Path(filename))
