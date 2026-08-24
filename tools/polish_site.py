from pathlib import Path
import re

VERSION = "20260824a"


def version_assets(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text = re.sub(r'href="site-extra\.css(?:\?v=[^"]+)?"', f'href="site-extra.css?v={VERSION}"', text)
    text = re.sub(r'src="site-extra\.js(?:\?v=[^"]+)?"', f'src="site-extra.js?v={VERSION}"', text)
    path.write_text(text, encoding="utf-8")


for filename in ("election-guide.html", "head-to-head.html"):
    version_assets(Path(filename))
