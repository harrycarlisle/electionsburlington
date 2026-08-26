"""Facebook is not a production dependency.

Do not scrape private groups or login walls. Official public pages may be
added later through a permitted feed. Skip gracefully.
"""

from __future__ import annotations

from typing import Any


def collect(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
    return []
