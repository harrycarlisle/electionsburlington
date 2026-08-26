"""X/Twitter is not a production dependency.

Official agency accounts may be useful as discovery, but this adapter does
not scrape X and does not call an unofficial API. If a permitted official
feed is added later, wire it here. Until then, skip gracefully.
"""

from __future__ import annotations

from typing import Any


def collect(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
    return []
