"""Normalized discovery adapters for Burlington News live and breaking surfaces."""

from .model import quick_update, SCHEMA_FIELDS
from .score import breaking_score, passes_breaking_threshold, recency_score
from .relevance import burlington_relevance, police_relevance
from .verify import corroborate, cluster_updates
from .utility import choose_default_mode, is_critical_utility

__all__ = [
    "SCHEMA_FIELDS",
    "breaking_score",
    "burlington_relevance",
    "choose_default_mode",
    "cluster_updates",
    "corroborate",
    "is_critical_utility",
    "passes_breaking_threshold",
    "police_relevance",
    "quick_update",
    "recency_score",
]
